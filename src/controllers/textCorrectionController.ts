import { Request, Response } from 'express';
import { TextCorrectionService } from '../services/textCorrectionService';
import { logger } from '../utils/logger';

export class TextCorrectionController {
  private textCorrectionService: TextCorrectionService;

  constructor() {
    this.textCorrectionService = new TextCorrectionService();
  }

  /**
   * Correct a single text
   */
  async correctText(req: Request, res: Response): Promise<void> {
    try {
      const { text, options } = req.body;
      
      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Text is required and must be a string',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.textCorrectionService.correctText(text, options);
      const processingTime = `${Date.now() - startTime}ms`;

      res.json({
        success: true,
        data: {
          correctedText: result.correctedText,
          corrections: result.corrections,
          statistics: {
            totalChars: text.length,
            correctionCount: result.corrections.length,
            processingTime
          }
        }
      });

      logger.info('Text correction completed', {
        textLength: text.length,
        correctionsCount: result.corrections.length,
        processingTime
      });

    } catch (error) {
      logger.error('Text correction failed', { error });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CORRECTION_FAILED',
          message: 'Failed to correct text',
          details: error instanceof Error ? { message: error.message } : undefined,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Batch correct multiple paragraphs
   */
  async batchCorrectParagraphs(req: Request, res: Response): Promise<void> {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      logger.info('🚀 Batch correction request received', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
      });

      const { paragraphs, options } = req.body;
      
      logger.info('📦 Request payload analyzed', {
        requestId,
        paragraphsCount: paragraphs?.length || 0,
        options: options || {},
        paragraphsSample: paragraphs?.slice(0, 2)?.map((p: any) => ({
          id: p.id,
          textLength: p.text?.length || 0,
          textPreview: p.text?.substring(0, 50) + '...'
        }))
      });

      if (!paragraphs || !Array.isArray(paragraphs)) {
        logger.error('❌ Invalid input: paragraphs not array', { requestId });
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Paragraphs must be an array',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Validate paragraph structure
      for (const paragraph of paragraphs) {
        if (!paragraph.id || !paragraph.text || typeof paragraph.text !== 'string') {
          logger.error('❌ Invalid paragraph structure', { 
            requestId, 
            paragraph: { id: paragraph.id, hasText: !!paragraph.text, textType: typeof paragraph.text }
          });
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAGRAPH',
              message: 'Each paragraph must have an id and text',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      }

      logger.info('✅ Input validation passed, starting processing...', { requestId });
      const startTime = Date.now();
      
      const result = await this.textCorrectionService.batchCorrectParagraphs(paragraphs, options);
      
      const processingTime = `${Date.now() - startTime}ms`;
      const completedCount = result.filter(r => r.status === 'completed').length;
      const totalCorrections = result.reduce((sum, r) => 
        sum + (r.corrections?.length || 0), 0
      );

      logger.info('📊 Processing completed, preparing response', {
        requestId,
        processingTime,
        completedCount,
        totalCorrections,
        resultSample: result.slice(0, 2).map(r => ({
          paragraphId: r.paragraphId,
          status: r.status,
          correctionsCount: r.corrections?.length || 0,
          hasError: !!r.error
        }))
      });

      const responseData = {
        success: true,
        data: {
          results: result,
          summary: {
            totalParagraphs: paragraphs.length,
            completedCount,
            totalCorrections
          }
        }
      };

      logger.info('📤 Sending successful response', { 
        requestId, 
        responseSize: JSON.stringify(responseData).length 
      });

      res.json(responseData);

      logger.info('✅ Batch correction completed successfully', {
        requestId,
        totalParagraphs: paragraphs.length,
        completedCount,
        totalCorrections,
        processingTime
      });

    } catch (error) {
      logger.error('❌ Batch correction failed', { 
        requestId, 
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error 
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_CORRECTION_FAILED',
          message: 'Failed to correct paragraphs',
          details: error instanceof Error ? { message: error.message } : undefined,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const textCorrectionController = new TextCorrectionController();