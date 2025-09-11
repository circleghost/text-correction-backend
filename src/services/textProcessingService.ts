import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  TextChunk,
  TextSplitResult,
  BatchProcessingProgress,
  TextCorrectionRequest,
  TextCorrectionResponse,
  AppError
} from '../types/index';
import { TextSplitter, validateTextInput, estimateProcessingTime } from '../utils/textSplitter';
import { logger } from '../utils/logger';

/**
 * Text Processing Service Configuration
 */
export interface TextProcessingServiceConfig {
  maxConcurrentBatches: number;
  batchTimeout: number;
  progressUpdateInterval: number;
  cleanupInterval: number;
  maxBatchAge: number;
}

/**
 * Default service configuration
 */
export const DEFAULT_SERVICE_CONFIG: TextProcessingServiceConfig = {
  maxConcurrentBatches: 5,
  batchTimeout: 300000, // 5 minutes
  progressUpdateInterval: 1000, // 1 second
  cleanupInterval: 60000, // 1 minute
  maxBatchAge: 3600000 // 1 hour
};

/**
 * Text Processing Service for handling batch text corrections
 */
export class TextProcessingService extends EventEmitter {
  private config: TextProcessingServiceConfig;
  private activeBatches: Map<string, BatchProcessingProgress> = new Map();
  private textSplitter: TextSplitter;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<TextProcessingServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.textSplitter = new TextSplitter();
    this.startCleanupTimer();

    logger.info('TextProcessingService initialized', {
      maxConcurrentBatches: this.config.maxConcurrentBatches,
      batchTimeout: this.config.batchTimeout
    });
  }

  /**
   * Process text by splitting into chunks and managing batch processing
   */
  public async processText(request: TextCorrectionRequest): Promise<{
    batchId: string;
    splitResult: TextSplitResult;
    estimatedTime: number;
  }> {
    try {
      // Validate input
      validateTextInput(request.text);
      
      // Check concurrent batch limit
      if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
        throw new AppError('Maximum concurrent batches reached. Please try again later.', 429);
      }

      // Split text into chunks
      const splitResult = this.textSplitter.splitText(request.text);
      
      // Create batch processing request
      const batchId = uuidv4();

      // Initialize progress tracking
      const progress: BatchProcessingProgress = {
        batchId,
        processedChunks: 0,
        totalChunks: splitResult.totalChunks,
        completedChunks: [],
        failedChunks: [],
        status: 'pending',
        startTime: new Date(),
        estimatedCompletionTime: new Date(Date.now() + estimateProcessingTime(splitResult.totalChunks))
      };

      this.activeBatches.set(batchId, progress);

      logger.info('Text processing batch created', {
        batchId,
        totalChunks: splitResult.totalChunks,
        textLength: request.text.length
      });

      // Emit batch created event
      this.emit('batchCreated', batchId, splitResult);

      return {
        batchId,
        splitResult,
        estimatedTime: estimateProcessingTime(splitResult.totalChunks)
      };

    } catch (error) {
      logger.error('Text processing failed', { error, textLength: request.text?.length });
      throw error instanceof AppError ? error : new AppError('Text processing failed', 500);
    }
  }

  /**
   * Start processing a batch
   */
  public async startBatchProcessing(batchId: string): Promise<void> {
    const progress = this.activeBatches.get(batchId);
    if (!progress) {
      throw new AppError('Batch not found', 404);
    }

    if (progress.status !== 'pending') {
      throw new AppError(`Batch is already ${progress.status}`, 400);
    }

    try {
      progress.status = 'processing';
      progress.startTime = new Date();
      
      logger.info('Starting batch processing', { batchId, totalChunks: progress.totalChunks });
      
      // Emit processing started event
      this.emit('batchStarted', batchId, progress);

      // Set timeout for batch processing
      setTimeout(() => {
        this.handleBatchTimeout(batchId);
      }, this.config.batchTimeout);

    } catch (error) {
      logger.error('Failed to start batch processing', { error, batchId });
      progress.status = 'failed';
      throw new AppError('Failed to start batch processing', 500);
    }
  }

  /**
   * Update progress for a specific chunk
   */
  public updateChunkProgress(
    batchId: string,
    chunkId: string,
    result: TextCorrectionResponse | Error
  ): void {
    const progress = this.activeBatches.get(batchId);
    if (!progress) {
      logger.warn('Attempted to update progress for non-existent batch', { batchId, chunkId });
      return;
    }

    try {
      if (result instanceof Error) {
        // Handle failed chunk - create a placeholder chunk if needed
        let failedChunk = progress.completedChunks.find(c => c.id === chunkId);
        
        if (!failedChunk) {
          // Create placeholder chunk for failed processing
          failedChunk = {
            id: chunkId,
            content: 'Failed processing',
            originalPosition: { start: 0, end: 0 },
            characterCount: 0,
            isLastChunk: false
          };
        }
        
        if (!progress.failedChunks.find(f => f.chunk.id === chunkId)) {
          progress.failedChunks.push({
            chunk: failedChunk,
            error: result.message
          });
        }
      } else {
        // Handle successful chunk
        const chunk = progress.completedChunks.find(c => c.id === chunkId);
        if (chunk) {
          // Chunk was already processed successfully
          return;
        }

        // Find chunk in original chunks (this would need to be stored in progress)
        // For now, we'll create a placeholder chunk
        const completedChunk: TextChunk = {
          id: chunkId,
          content: result.correctedText,
          originalPosition: { start: 0, end: result.correctedText.length },
          characterCount: result.correctedText.length,
          isLastChunk: false
        };
        
        progress.completedChunks.push(completedChunk);
      }

      progress.processedChunks = progress.completedChunks.length + progress.failedChunks.length;

      // Update status based on progress
      if (progress.processedChunks >= progress.totalChunks) {
        progress.status = progress.failedChunks.length === 0 ? 'completed' : 'failed';
        progress.endTime = new Date();
        
        logger.info('Batch processing completed', {
          batchId,
          totalChunks: progress.totalChunks,
          completedChunks: progress.completedChunks.length,
          failedChunks: progress.failedChunks.length
        });

        // Emit completion event
        this.emit('batchCompleted', batchId, progress);
      } else {
        // Update estimated completion time
        const avgTimePerChunk = (Date.now() - progress.startTime.getTime()) / progress.processedChunks;
        const remainingChunks = progress.totalChunks - progress.processedChunks;
        progress.estimatedCompletionTime = new Date(Date.now() + (avgTimePerChunk * remainingChunks));

        // Emit progress update event
        this.emit('progressUpdated', batchId, progress);
      }

    } catch (error) {
      logger.error('Failed to update chunk progress', { error, batchId, chunkId });
    }
  }

  /**
   * Get progress for a specific batch
   */
  public getBatchProgress(batchId: string): BatchProcessingProgress | null {
    const progress = this.activeBatches.get(batchId);
    if (!progress) {
      return null;
    }

    // Return a copy to prevent external modification
    return {
      ...progress,
      completedChunks: [...progress.completedChunks],
      failedChunks: [...progress.failedChunks]
    };
  }

  /**
   * Get all active batches
   */
  public getActiveBatches(): BatchProcessingProgress[] {
    return Array.from(this.activeBatches.values()).map(progress => ({
      ...progress,
      completedChunks: [...progress.completedChunks],
      failedChunks: [...progress.failedChunks]
    }));
  }

  /**
   * Cancel a batch
   */
  public cancelBatch(batchId: string): boolean {
    const progress = this.activeBatches.get(batchId);
    if (!progress) {
      return false;
    }

    if (progress.status === 'completed') {
      return false; // Cannot cancel completed batch
    }

    progress.status = 'failed';
    progress.endTime = new Date();
    
    logger.info('Batch cancelled', { batchId });
    this.emit('batchCancelled', batchId, progress);
    
    return true;
  }

  /**
   * Clean up completed and old batches
   */
  public cleanup(): number {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [batchId, progress] of this.activeBatches.entries()) {
      const age = now - progress.startTime.getTime();
      
      if ((progress.status === 'completed' || progress.status === 'failed') && age > this.config.maxBatchAge) {
        toRemove.push(batchId);
      }
    }

    toRemove.forEach(batchId => {
      this.activeBatches.delete(batchId);
      logger.debug('Cleaned up old batch', { batchId });
    });

    if (toRemove.length > 0) {
      logger.info('Batch cleanup completed', { removedBatches: toRemove.length });
    }

    return toRemove.length;
  }

  /**
   * Handle batch timeout
   */
  private handleBatchTimeout(batchId: string): void {
    const progress = this.activeBatches.get(batchId);
    if (!progress || progress.status !== 'processing') {
      return; // Batch already completed or doesn't exist
    }

    logger.warn('Batch processing timeout', { batchId, processedChunks: progress.processedChunks });
    
    progress.status = 'failed';
    progress.endTime = new Date();
    
    this.emit('batchTimeout', batchId, progress);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Shutdown service and cleanup resources
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Cancel all active batches
    for (const batchId of this.activeBatches.keys()) {
      this.cancelBatch(batchId);
    }

    this.removeAllListeners();
    logger.info('TextProcessingService shutdown completed');
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    activeBatches: number;
    totalProcessed: number;
    averageProcessingTime: number;
    successRate: number;
  } {
    const activeBatches = this.activeBatches.size;
    const allBatches = Array.from(this.activeBatches.values());
    
    const completedBatches = allBatches.filter(b => b.status === 'completed' || b.status === 'failed');
    const successfulBatches = allBatches.filter(b => b.status === 'completed');
    
    const totalProcessingTime = completedBatches.reduce((sum, batch) => {
      if (batch.endTime) {
        return sum + (batch.endTime.getTime() - batch.startTime.getTime());
      }
      return sum;
    }, 0);
    
    const averageProcessingTime = completedBatches.length > 0 
      ? totalProcessingTime / completedBatches.length 
      : 0;
    
    const successRate = completedBatches.length > 0 
      ? (successfulBatches.length / completedBatches.length) * 100 
      : 0;

    return {
      activeBatches,
      totalProcessed: completedBatches.length,
      averageProcessingTime,
      successRate
    };
  }
}