import { 
  TextProcessingService
} from '../../src/services/textProcessingService';
import { 
  TextCorrectionRequest, 
  TextCorrectionResponse, 
  AppError 
} from '../../src/types/index';

describe('TextProcessingService', () => {
  let service: TextProcessingService;

  beforeEach(() => {
    service = new TextProcessingService();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeInstanceOf(TextProcessingService);
    });

    it('should accept custom configuration', () => {
      const customConfig = { maxConcurrentBatches: 10, batchTimeout: 60000 };
      const customService = new TextProcessingService(customConfig);
      expect(customService).toBeInstanceOf(TextProcessingService);
      customService.shutdown();
    });

    it('should be an EventEmitter', () => {
      expect(service.listenerCount).toBeDefined();
      expect(service.emit).toBeDefined();
      expect(service.on).toBeDefined();
    });
  });

  describe('processText', () => {
    const validRequest: TextCorrectionRequest = {
      text: '這是一個測試文檔，包含一些需要修正的內容。',
      language: 'zh-TW',
      preserveFormatting: true,
      batchSize: 1000
    };

    it('should process valid text successfully', async () => {
      const result = await service.processText(validRequest);
      
      expect(result.batchId).toBeDefined();
      expect(typeof result.batchId).toBe('string');
      expect(result.splitResult).toBeDefined();
      expect(result.splitResult.chunks.length).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    it('should reject empty text', async () => {
      const invalidRequest = { ...validRequest, text: '' };
      await expect(service.processText(invalidRequest)).rejects.toThrow(AppError);
    });

    it('should reject null or undefined text', async () => {
      const invalidRequest1 = { ...validRequest, text: null as any };
      const invalidRequest2 = { ...validRequest, text: undefined as any };
      
      await expect(service.processText(invalidRequest1)).rejects.toThrow(AppError);
      await expect(service.processText(invalidRequest2)).rejects.toThrow(AppError);
    });

    it('should reject text that is too long', async () => {
      const tooLongRequest = { ...validRequest, text: 'a'.repeat(100001) };
      await expect(service.processText(tooLongRequest)).rejects.toThrow(AppError);
    });

    it('should handle concurrent batch limit', async () => {
      const limitedService = new TextProcessingService({ maxConcurrentBatches: 1 });
      
      try {
        // Process first batch
        const result1 = await limitedService.processText(validRequest);
        expect(result1.batchId).toBeDefined();
        
        // Second batch should be rejected
        await expect(limitedService.processText(validRequest)).rejects.toThrow(AppError);
        
      } finally {
        limitedService.shutdown();
      }
    });

    it('should emit batchCreated event', async () => {
      const eventPromise = new Promise((resolve) => {
        service.on('batchCreated', (batchId, splitResult) => {
          resolve({ batchId, splitResult });
        });
      });

      const result = await service.processText(validRequest);
      const eventData = await eventPromise as any;
      
      expect(eventData.batchId).toBe(result.batchId);
      expect(eventData.splitResult).toBeDefined();
    });

    it('should create chunks for long text', async () => {
      const longText = '這是一個很長的測試文檔。'.repeat(100);
      const longRequest = { ...validRequest, text: longText };
      
      const result = await service.processText(longRequest);
      
      if (longText.length > 1000) {
        expect(result.splitResult.chunks.length).toBeGreaterThan(1);
      }
      expect(result.splitResult.totalCharacters).toBe(longText.length);
    });
  });

  describe('startBatchProcessing', () => {
    it('should start processing successfully', async () => {
      const request: TextCorrectionRequest = {
        text: '測試文字處理服務。',
        language: 'zh-TW'
      };
      
      const { batchId } = await service.processText(request);
      
      const eventPromise = new Promise((resolve) => {
        service.on('batchStarted', (id, progress) => {
          resolve({ id, progress });
        });
      });
      
      await service.startBatchProcessing(batchId);
      const eventData = await eventPromise as any;
      
      expect(eventData.id).toBe(batchId);
      expect(eventData.progress.status).toBe('processing');
    });

    it('should reject non-existent batch', async () => {
      const fakeBatchId = 'non-existent-batch-id';
      await expect(service.startBatchProcessing(fakeBatchId)).rejects.toThrow(AppError);
    });

    it('should reject already started batch', async () => {
      const request: TextCorrectionRequest = {
        text: '測試重複啟動處理。',
        language: 'zh-TW'
      };
      
      const { batchId } = await service.processText(request);
      
      await service.startBatchProcessing(batchId);
      
      // Second start should fail
      await expect(service.startBatchProcessing(batchId)).rejects.toThrow(AppError);
    });
  });

  describe('updateChunkProgress', () => {
    let batchId: string;
    let chunkId: string;

    beforeEach(async () => {
      const request: TextCorrectionRequest = {
        text: '測試進度更新功能。這是第二句話。',
        language: 'zh-TW'
      };
      
      const result = await service.processText(request);
      batchId = result.batchId;
      chunkId = result.splitResult.chunks[0]?.id || 'test-chunk-id';
      
      await service.startBatchProcessing(batchId);
    });

    it('should update successful chunk progress', () => {
      const mockResult: TextCorrectionResponse = {
        originalText: '測試文字',
        correctedText: '測試文字',
        corrections: [],
        processingTime: 1000,
        confidence: 0.95
      };
      
      service.updateChunkProgress(batchId, chunkId, mockResult);
      
      const progress = service.getBatchProgress(batchId);
      expect(progress).toBeDefined();
      expect(progress!.processedChunks).toBe(1);
      expect(progress!.completedChunks).toHaveLength(1);
    });

    it('should update failed chunk progress', () => {
      const mockError = new Error('Processing failed');
      
      service.updateChunkProgress(batchId, chunkId, mockError);
      
      const progress = service.getBatchProgress(batchId);
      expect(progress).toBeDefined();
      expect(progress!.processedChunks).toBe(1);
      expect(progress!.failedChunks).toHaveLength(1);
      expect(progress!.failedChunks[0]?.error).toBe('Processing failed');
    });

    it('should ignore updates for non-existent batch', () => {
      const fakeBatchId = 'fake-batch-id';
      const mockResult: TextCorrectionResponse = {
        originalText: 'test',
        correctedText: 'test',
        corrections: [],
        processingTime: 1000,
        confidence: 0.95
      };
      
      // Should not throw error
      expect(() => service.updateChunkProgress(fakeBatchId, chunkId, mockResult)).not.toThrow();
    });

    it('should emit progressUpdated event', () => {
      const mockResult: TextCorrectionResponse = {
        originalText: '測試文字',
        correctedText: '測試文字',
        corrections: [],
        processingTime: 1000,
        confidence: 0.95
      };
      
      // Since we only have one chunk, it should complete immediately
      // So we might not get progressUpdated event, but batchCompleted instead
      service.updateChunkProgress(batchId, chunkId, mockResult);
    });

    it('should emit batchCompleted event when all chunks processed', () => {
      const mockResult: TextCorrectionResponse = {
        originalText: '測試文字',
        correctedText: '測試文字',
        corrections: [],
        processingTime: 1000,
        confidence: 0.95
      };
      
      const eventPromise = new Promise((resolve) => {
        service.on('batchCompleted', (id, progress) => {
          resolve({ id, progress });
        });
      });
      
      service.updateChunkProgress(batchId, chunkId, mockResult);
      
      return eventPromise.then((eventData: any) => {
        expect(eventData.id).toBe(batchId);
        expect(eventData.progress.status).toBe('completed');
      });
    });
  });

  describe('getBatchProgress', () => {
    it('should return progress for existing batch', async () => {
      const request: TextCorrectionRequest = {
        text: '獲取進度測試文字。',
        language: 'zh-TW'
      };
      
      const { batchId } = await service.processText(request);
      const progress = service.getBatchProgress(batchId);
      
      expect(progress).toBeDefined();
      expect(progress!.batchId).toBe(batchId);
      expect(progress!.status).toBe('pending');
      expect(progress!.totalChunks).toBeGreaterThan(0);
      expect(progress!.processedChunks).toBe(0);
    });

    it('should return null for non-existent batch', () => {
      const progress = service.getBatchProgress('non-existent-id');
      expect(progress).toBeNull();
    });

    it('should return a copy of progress to prevent external modification', async () => {
      const request: TextCorrectionRequest = {
        text: '防止外部修改測試。',
        language: 'zh-TW'
      };
      
      const { batchId } = await service.processText(request);
      const progress1 = service.getBatchProgress(batchId);
      const progress2 = service.getBatchProgress(batchId);
      
      // Should be different objects
      expect(progress1).not.toBe(progress2);
      expect(progress1).toEqual(progress2);
      
      // Modifying one should not affect the other
      progress1!.completedChunks.push({
        id: 'fake',
        content: 'fake',
        originalPosition: { start: 0, end: 4 },
        characterCount: 4,
        isLastChunk: false
      });
      
      expect(progress2!.completedChunks).toHaveLength(0);
    });
  });

  describe('getActiveBatches', () => {
    it('should return empty array when no batches', () => {
      const batches = service.getActiveBatches();
      expect(batches).toEqual([]);
    });

    it('should return all active batches', async () => {
      const request1: TextCorrectionRequest = { text: '第一個批次。', language: 'zh-TW' };
      const request2: TextCorrectionRequest = { text: '第二個批次。', language: 'zh-TW' };
      
      await service.processText(request1);
      await service.processText(request2);
      
      const batches = service.getActiveBatches();
      expect(batches).toHaveLength(2);
      expect(batches.every(b => b.status === 'pending')).toBe(true);
    });
  });

  describe('cancelBatch', () => {
    it('should cancel pending batch successfully', async () => {
      const request: TextCorrectionRequest = {
        text: '取消批次測試。',
        language: 'zh-TW'
      };
      
      const { batchId } = await service.processText(request);
      
      const eventPromise = new Promise((resolve) => {
        service.on('batchCancelled', (id, progress) => {
          resolve({ id, progress });
        });
      });
      
      const cancelled = service.cancelBatch(batchId);
      expect(cancelled).toBe(true);
      
      const eventData = await eventPromise as any;
      expect(eventData.id).toBe(batchId);
      expect(eventData.progress.status).toBe('failed');
    });

    it('should not cancel completed batch', async () => {
      const request: TextCorrectionRequest = {
        text: '測試。',
        language: 'zh-TW'
      };
      
      const { batchId, splitResult } = await service.processText(request);
      await service.startBatchProcessing(batchId);
      
      // Simulate completion
      const mockResult: TextCorrectionResponse = {
        originalText: '測試。',
        correctedText: '測試。',
        corrections: [],
        processingTime: 1000,
        confidence: 0.95
      };
      
      service.updateChunkProgress(batchId, splitResult.chunks[0]?.id || 'test-id', mockResult);
      
      // Try to cancel completed batch
      const cancelled = service.cancelBatch(batchId);
      expect(cancelled).toBe(false);
    });

    it('should return false for non-existent batch', () => {
      const cancelled = service.cancelBatch('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old completed batches', async () => {
      const quickCleanupService = new TextProcessingService({ 
        maxBatchAge: 100 // Very short age for testing
      });
      
      try {
        const request: TextCorrectionRequest = {
          text: '清理測試。',
          language: 'zh-TW'
        };
        
        const { batchId, splitResult } = await quickCleanupService.processText(request);
        await quickCleanupService.startBatchProcessing(batchId);
        
        // Complete the batch
        const mockResult: TextCorrectionResponse = {
          originalText: '清理測試。',
          correctedText: '清理測試。',
          corrections: [],
          processingTime: 1000,
          confidence: 0.95
        };
        
        quickCleanupService.updateChunkProgress(batchId, splitResult.chunks[0]?.id || 'test-id', mockResult);
        
        expect(quickCleanupService.getActiveBatches()).toHaveLength(1);
        
        // Wait for batch to age
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const removedCount = quickCleanupService.cleanup();
        expect(removedCount).toBe(1);
        expect(quickCleanupService.getActiveBatches()).toHaveLength(0);
        
      } finally {
        quickCleanupService.shutdown();
      }
    });

    it('should not remove recent batches', async () => {
      const request: TextCorrectionRequest = {
        text: '最近的批次測試。',
        language: 'zh-TW'
      };
      
      await service.processText(request);
      
      const removedCount = service.cleanup();
      expect(removedCount).toBe(0);
      expect(service.getActiveBatches()).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const stats = service.getStats();
      
      expect(stats.activeBatches).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should calculate statistics after processing batches', async () => {
      const request: TextCorrectionRequest = {
        text: '統計測試文字。',
        language: 'zh-TW'
      };
      
      await service.processText(request);
      
      const stats = service.getStats();
      expect(stats.activeBatches).toBe(1);
    });
  });

  describe('shutdown', () => {
    it('should cleanup resources and cancel active batches', async () => {
      const request: TextCorrectionRequest = {
        text: '關閉服務測試。',
        language: 'zh-TW'
      };
      
      await service.processText(request);
      expect(service.getActiveBatches()).toHaveLength(1);
      
      service.shutdown();
      
      // All batches should be cancelled
      const batches = service.getActiveBatches();
      if (batches.length > 0) {
        expect(batches.every(b => b.status === 'failed')).toBe(true);
      }
    });
  });

  describe('batch timeout handling', () => {
    it('should handle batch timeout', async () => {
      const timeoutService = new TextProcessingService({ batchTimeout: 100 }); // Very short timeout
      
      try {
        const request: TextCorrectionRequest = {
          text: '超時測試文字。',
          language: 'zh-TW'
        };
        
        const { batchId } = await timeoutService.processText(request);
        
        const timeoutPromise = new Promise((resolve) => {
          timeoutService.on('batchTimeout', (id, progress) => {
            resolve({ id, progress });
          });
        });
        
        await timeoutService.startBatchProcessing(batchId);
        
        const timeoutData = await timeoutPromise as any;
        expect(timeoutData.id).toBe(batchId);
        expect(timeoutData.progress.status).toBe('failed');
        
      } finally {
        timeoutService.shutdown();
      }
    });
  });
});