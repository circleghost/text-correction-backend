import { v4 as uuidv4 } from 'uuid';
import { TextChunk, TextSplitResult } from '../types/index';
import { AppError } from '../types/index';
import { logger } from './logger';

/**
 * Configuration for text splitting
 */
export interface TextSplitterConfig {
  maxChunkSize: number;
  preferredBreakpoints: string[];
  preserveParagraphs: boolean;
  overlapSize: number;
}

/**
 * Default configuration for Chinese text splitting
 */
export const DEFAULT_SPLITTER_CONFIG: TextSplitterConfig = {
  maxChunkSize: 1000,
  preferredBreakpoints: ['\n\n', '\n', '。', '！', '？', '；', '，', ' '],
  preserveParagraphs: true,
  overlapSize: 50
};

/**
 * Text splitter utility for processing long texts into manageable chunks
 */
export class TextSplitter {
  private config: TextSplitterConfig;

  constructor(config: Partial<TextSplitterConfig> = {}) {
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
    
    if (this.config.maxChunkSize <= 0) {
      throw new AppError('maxChunkSize must be greater than 0', 400);
    }
    
    if (this.config.overlapSize >= this.config.maxChunkSize) {
      throw new AppError('overlapSize must be less than maxChunkSize', 400);
    }
  }

  /**
   * Split text into chunks based on configuration
   */
  public splitText(text: string): TextSplitResult {
    try {
      logger.debug('Starting text splitting', {
        textLength: text.length,
        maxChunkSize: this.config.maxChunkSize,
        preserveParagraphs: this.config.preserveParagraphs
      });

      if (!text || text.trim().length === 0) {
        throw new AppError('Text cannot be empty', 400);
      }

      const chunks: TextChunk[] = [];
      
      if (text.length <= this.config.maxChunkSize) {
        // Text fits in a single chunk
        chunks.push(this.createChunk(text, 0, text.length, true));
      } else {
        // Split text into multiple chunks
        const splitChunks = this.performSplit(text);
        chunks.push(...splitChunks);
      }

      const result: TextSplitResult = {
        chunks,
        totalCharacters: text.length,
        totalChunks: chunks.length,
        maxChunkSize: this.config.maxChunkSize
      };

      logger.info('Text splitting completed', {
        originalLength: text.length,
        totalChunks: chunks.length,
        avgChunkSize: Math.round(text.length / chunks.length)
      });

      return result;
    } catch (error) {
      logger.error('Text splitting failed', { error });
      throw error instanceof AppError ? error : new AppError('Text splitting failed', 500);
    }
  }

  /**
   * Perform the actual text splitting logic
   */
  private performSplit(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      const remainingText = text.length - currentPosition;
      const targetSize = Math.min(this.config.maxChunkSize, remainingText);
      
      let chunkEnd = currentPosition + targetSize;
      let chunkText: string;

      if (chunkEnd >= text.length) {
        // This is the last chunk
        chunkText = text.substring(currentPosition);
        chunkEnd = text.length;
      } else {
        // Find the best breakpoint
        const breakpoint = this.findOptimalBreakpoint(text, currentPosition, chunkEnd);
        chunkEnd = breakpoint;
        chunkText = text.substring(currentPosition, chunkEnd);
      }

      // Create chunk
      const isLastChunk = chunkEnd >= text.length;
      chunks.push(this.createChunk(chunkText, currentPosition, chunkEnd, isLastChunk));

      // Move to next position with overlap consideration
      if (!isLastChunk && this.config.overlapSize > 0) {
        const overlapStart = Math.max(0, chunkEnd - this.config.overlapSize);
        currentPosition = overlapStart;
      } else {
        currentPosition = chunkEnd;
      }
    }

    return chunks;
  }

  /**
   * Find the optimal breakpoint for splitting text
   */
  private findOptimalBreakpoint(text: string, start: number, maxEnd: number): number {
    // If we're at the end of text, return maxEnd
    if (maxEnd >= text.length) {
      return text.length;
    }

    // Try to find breakpoint using preferred characters
    for (const breakChar of this.config.preferredBreakpoints) {
      const searchStart = Math.max(start, maxEnd - 200); // Look back up to 200 chars
      const lastIndex = text.lastIndexOf(breakChar, maxEnd);
      
      if (lastIndex > searchStart) {
        // Found a good breakpoint, include the break character
        return lastIndex + breakChar.length;
      }
    }

    // If no good breakpoint found, split at word boundary if possible
    const wordBoundary = this.findWordBoundary(text, maxEnd);
    return wordBoundary !== -1 ? wordBoundary : maxEnd;
  }

  /**
   * Find a word boundary near the target position
   */
  private findWordBoundary(text: string, targetPos: number): number {
    const searchRange = 50; // Look within 50 characters
    const start = Math.max(0, targetPos - searchRange);
    const end = Math.min(text.length, targetPos + searchRange);

    // Look for whitespace characters
    for (let i = targetPos; i >= start; i--) {
      const char = text[i];
      if (char && /\s/.test(char)) {
        return i + 1; // Return position after whitespace
      }
    }

    // If no whitespace found, look forward
    for (let i = targetPos; i < end; i++) {
      const char = text[i];
      if (char && /\s/.test(char)) {
        return i;
      }
    }

    return -1; // No word boundary found
  }

  /**
   * Create a text chunk with proper metadata
   */
  private createChunk(
    content: string, 
    startPos: number, 
    endPos: number, 
    isLastChunk: boolean
  ): TextChunk {
    return {
      id: uuidv4(),
      content: content.trim(),
      originalPosition: {
        start: startPos,
        end: endPos
      },
      characterCount: content.length,
      isLastChunk
    };
  }

  /**
   * Validate chunk size constraints
   */
  public static validateChunks(chunks: TextChunk[], maxSize: number): boolean {
    return chunks.every(chunk => chunk.characterCount <= maxSize);
  }

  /**
   * Reconstruct original text from chunks (for testing purposes)
   */
  public static reconstructText(chunks: TextChunk[], originalText: string): string {
    // Sort chunks by original position
    const sortedChunks = chunks.sort((a, b) => a.originalPosition.start - b.originalPosition.start);
    
    let reconstructed = '';
    let lastEnd = 0;

    for (const chunk of sortedChunks) {
      // Add any gap between chunks
      if (chunk.originalPosition.start > lastEnd) {
        reconstructed += originalText.substring(lastEnd, chunk.originalPosition.start);
      }
      
      reconstructed += chunk.content;
      lastEnd = chunk.originalPosition.end;
    }

    return reconstructed;
  }
}

/**
 * Convenience function to split text with default configuration
 */
export function splitText(text: string, maxChunkSize: number = 1000): TextSplitResult {
  const splitter = new TextSplitter({ maxChunkSize });
  return splitter.splitText(text);
}

/**
 * Calculate estimated processing time based on chunk count and average processing time
 */
export function estimateProcessingTime(chunkCount: number, avgProcessingTimePerChunk: number = 3000): number {
  return chunkCount * avgProcessingTimePerChunk;
}

/**
 * Validate text input before processing
 */
export function validateTextInput(text: string): void {
  if (!text || typeof text !== 'string') {
    throw new AppError('Text input must be a non-empty string', 400);
  }

  if (text.trim().length === 0) {
    throw new AppError('Text input cannot be empty or contain only whitespace', 400);
  }

  if (text.length > 100000) { // 100k character limit
    throw new AppError('Text input too large (maximum 100,000 characters)', 413);
  }
}