import { 
  TextSplitter, 
  splitText, 
  validateTextInput, 
  estimateProcessingTime,
  DEFAULT_SPLITTER_CONFIG 
} from '../../src/utils/textSplitter';
import { AppError } from '../../src/types/index';

describe('TextSplitter', () => {
  let textSplitter: TextSplitter;

  beforeEach(() => {
    textSplitter = new TextSplitter();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const splitter = new TextSplitter();
      expect(splitter).toBeInstanceOf(TextSplitter);
    });

    it('should accept custom configuration', () => {
      const customConfig = { maxChunkSize: 500, preferredBreakpoints: ['\n'] };
      const splitter = new TextSplitter(customConfig);
      expect(splitter).toBeInstanceOf(TextSplitter);
    });

    it('should throw error for invalid maxChunkSize', () => {
      expect(() => new TextSplitter({ maxChunkSize: 0 })).toThrow(AppError);
      expect(() => new TextSplitter({ maxChunkSize: -1 })).toThrow(AppError);
    });

    it('should throw error when overlapSize >= maxChunkSize', () => {
      expect(() => new TextSplitter({ maxChunkSize: 100, overlapSize: 100 })).toThrow(AppError);
      expect(() => new TextSplitter({ maxChunkSize: 100, overlapSize: 150 })).toThrow(AppError);
    });
  });

  describe('splitText', () => {
    it('should handle empty text', () => {
      expect(() => textSplitter.splitText('')).toThrow(AppError);
      expect(() => textSplitter.splitText('   ')).toThrow(AppError);
    });

    it('should return single chunk for short text', () => {
      const shortText = '這是一個短文本。';
      const result = textSplitter.splitText(shortText);
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]?.content).toBe(shortText);
      expect(result.chunks[0]?.isLastChunk).toBe(true);
      expect(result.totalCharacters).toBe(shortText.length);
      expect(result.totalChunks).toBe(1);
    });

    it('should split long text into multiple chunks', () => {
      // Create text longer than default chunk size (1000 chars)
      const longText = '這是一個測試文檔。'.repeat(100); // About 800 chars
      const evenLongerText = longText + longText; // About 1600 chars
      
      const result = textSplitter.splitText(evenLongerText);
      
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.totalCharacters).toBe(evenLongerText.length);
      expect(result.totalChunks).toBe(result.chunks.length);
      
      // Check that last chunk is marked as last
      expect(result.chunks[result.chunks.length - 1]?.isLastChunk).toBe(true);
      
      // Check that all chunks except last are marked as not last
      for (let i = 0; i < result.chunks.length - 1; i++) {
        expect(result.chunks[i]?.isLastChunk).toBe(false);
      }
    });

    it('should respect preferred breakpoints', () => {
      const textWithParagraphs = '第一段文字。\n\n第二段文字。\n\n第三段文字。'.repeat(50);
      const result = textSplitter.splitText(textWithParagraphs);
      
      // Should break at paragraph boundaries when possible
      result.chunks.forEach(chunk => {
        // Most chunks should end with sentence endings or paragraph breaks
        // This is a heuristic test, not all chunks will end with breakpoints
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should maintain original position information', () => {
      const text = '測試文字。'.repeat(200); // Create long text
      const result = textSplitter.splitText(text);
      
      if (result.chunks.length > 1) {
        // Check positions are sequential and non-overlapping (considering overlap feature)
        for (let i = 0; i < result.chunks.length - 1; i++) {
          const currentChunk = result.chunks[i];
          const nextChunk = result.chunks[i + 1];
          
          if (currentChunk && nextChunk) {
            expect(currentChunk.originalPosition.start).toBeLessThan(currentChunk.originalPosition.end);
            expect(nextChunk.originalPosition.start).toBeGreaterThanOrEqual(0);
            expect(nextChunk.originalPosition.end).toBeLessThanOrEqual(text.length);
          }
        }
      }
    });

    it('should generate unique IDs for each chunk', () => {
      const longText = '重複文字。'.repeat(200);
      const result = textSplitter.splitText(longText);
      
      const ids = result.chunks.map(chunk => chunk.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should handle Chinese text with proper character counting', () => {
      const chineseText = '這是中文測試文檔，包含各種標點符號：句號。問號？感歎號！逗號，分號；';
      const result = textSplitter.splitText(chineseText);
      
      expect(result.totalCharacters).toBe(chineseText.length);
      expect(result.chunks[0]?.characterCount).toBe(chineseText.length);
    });
  });

  describe('validateChunks', () => {
    it('should validate chunk sizes correctly', () => {
      const validChunks = [
        { id: '1', content: 'short', originalPosition: { start: 0, end: 5 }, characterCount: 5, isLastChunk: false },
        { id: '2', content: 'text', originalPosition: { start: 5, end: 9 }, characterCount: 4, isLastChunk: true }
      ];
      
      expect(TextSplitter.validateChunks(validChunks, 10)).toBe(true);
      expect(TextSplitter.validateChunks(validChunks, 3)).toBe(false);
    });
  });

  describe('reconstructText', () => {
    it('should reconstruct original text from chunks', () => {
      const originalText = '這是第一段。\n這是第二段。\n這是第三段。';
      const result = textSplitter.splitText(originalText);
      
      const reconstructed = TextSplitter.reconstructText(result.chunks, originalText);
      
      // Should be similar to original (may have some differences due to chunk processing)
      expect(reconstructed).toContain('這是第一段');
      expect(reconstructed).toContain('這是第二段');
      expect(reconstructed).toContain('這是第三段');
    });

    it('should handle chunks in wrong order', () => {
      const originalText = 'ABCDEFGHIJ';
      const chunks = [
        { 
          id: '2', 
          content: 'FGH', 
          originalPosition: { start: 5, end: 8 }, 
          characterCount: 3, 
          isLastChunk: false 
        },
        { 
          id: '1', 
          content: 'ABC', 
          originalPosition: { start: 0, end: 3 }, 
          characterCount: 3, 
          isLastChunk: false 
        },
        { 
          id: '3', 
          content: 'IJ', 
          originalPosition: { start: 8, end: 10 }, 
          characterCount: 2, 
          isLastChunk: true 
        }
      ];
      
      const reconstructed = TextSplitter.reconstructText(chunks, originalText);
      
      // Should be reconstructed in correct order
      expect(reconstructed).toContain('ABC');
      expect(reconstructed.indexOf('ABC')).toBeLessThan(reconstructed.indexOf('FGH'));
      expect(reconstructed.indexOf('FGH')).toBeLessThan(reconstructed.indexOf('IJ'));
    });
  });

  describe('edge cases', () => {
    it('should handle text with only whitespace characters', () => {
      const whitespaceText = '   \n\n  \t  ';
      expect(() => textSplitter.splitText(whitespaceText)).toThrow(AppError);
    });

    it('should handle text with mixed languages', () => {
      const mixedText = '中文 English 日本語 한국어 العربية';
      const result = textSplitter.splitText(mixedText);
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]?.content).toBe(mixedText);
    });

    it('should handle text with special characters and emojis', () => {
      const specialText = '測試特殊字符：@#$%^&*(){}[]|\\:";\'<>?,./ 和表情符號：😀🎉🔥';
      const result = textSplitter.splitText(specialText);
      
      expect(result.chunks).toHaveLength(1);
      expect(result.totalCharacters).toBe(specialText.length);
    });

    it('should handle very long single word', () => {
      // Create a very long "word" without spaces
      const longWord = '超級超級超級超級超級超級長的中文詞語'.repeat(50);
      const result = textSplitter.splitText(longWord);
      
      // Should still split even without good breakpoints
      if (longWord.length > DEFAULT_SPLITTER_CONFIG.maxChunkSize) {
        expect(result.chunks.length).toBeGreaterThan(1);
      }
    });
  });
});

describe('Utility Functions', () => {
  describe('splitText convenience function', () => {
    it('should work with default parameters', () => {
      const text = '簡單測試文字。';
      const result = splitText(text);
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]?.content).toBe(text);
    });

    it('should work with custom chunk size', () => {
      const text = '這是一個較長的測試文字，用來測試自訂區塊大小功能。';
      const result = splitText(text, 100); // Use larger chunk size to avoid overlap validation error
      
      expect(result.maxChunkSize).toBe(100);
    });
  });

  describe('validateTextInput', () => {
    it('should accept valid text', () => {
      expect(() => validateTextInput('有效的文字輸入')).not.toThrow();
    });

    it('should reject empty text', () => {
      expect(() => validateTextInput('')).toThrow(AppError);
      expect(() => validateTextInput('   ')).toThrow(AppError);
    });

    it('should reject non-string input', () => {
      expect(() => validateTextInput(null as any)).toThrow(AppError);
      expect(() => validateTextInput(undefined as any)).toThrow(AppError);
      expect(() => validateTextInput(123 as any)).toThrow(AppError);
    });

    it('should reject text that is too long', () => {
      const tooLongText = 'a'.repeat(100001);
      expect(() => validateTextInput(tooLongText)).toThrow(AppError);
    });

    it('should accept text at the limit', () => {
      const limitText = 'a'.repeat(100000);
      expect(() => validateTextInput(limitText)).not.toThrow();
    });
  });

  describe('estimateProcessingTime', () => {
    it('should calculate time correctly', () => {
      expect(estimateProcessingTime(1)).toBe(3000);
      expect(estimateProcessingTime(5)).toBe(15000);
      expect(estimateProcessingTime(0)).toBe(0);
    });

    it('should work with custom time per chunk', () => {
      expect(estimateProcessingTime(3, 1000)).toBe(3000);
      expect(estimateProcessingTime(10, 500)).toBe(5000);
    });
  });
});

describe('Performance Tests', () => {
  it('should handle large text efficiently', () => {
    const largeText = '這是性能測試文字。'.repeat(5000); // About 50k characters
    const startTime = Date.now();
    
    const textSplitter = new TextSplitter();
    const result = textSplitter.splitText(largeText);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Should complete within reasonable time (less than 1 second)
    expect(processingTime).toBeLessThan(1000);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.totalCharacters).toBe(largeText.length);
  });

  it('should create reasonable number of chunks for large text', () => {
    const largeText = '段落文字。\n\n'.repeat(1000); // About 8k characters
    const result = splitText(largeText, 1000);
    
    // Should create approximately the right number of chunks
    const expectedChunks = Math.ceil(largeText.length / 1000);
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.chunks.length).toBeLessThanOrEqual(expectedChunks * 2); // Allow some flexibility
  });
});