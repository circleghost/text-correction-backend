import { Request, Response } from 'express';
import { googleDocsService } from '../services/googleDocsService';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types';

export class GoogleDocsController {
  /**
   * Import document content from Google Docs URL
   */
  async importDocument(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      // Validate request body
      if (!url || typeof url !== 'string') {
        const response: ApiResponse = {
          success: false,
          message: 'Google Docs URL is required',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      logger.info('Google Docs import request', { 
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''), 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Check if service is available
      if (!googleDocsService.isAvailable()) {
        logger.warn('Google Docs service not available - credentials not configured', { 
          url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
          ip: req.ip 
        });
        
        const response: ApiResponse = {
          success: false,
          message: 'Google Docs integration is not available. Please contact administrator.',
          error: 'Google Docs credentials not configured',
          timestamp: new Date().toISOString()
        };
        res.status(503).json(response);
        return;
      }

      // Validate URL format first
      const validation = googleDocsService.validateDocumentUrl(url);
      if (!validation.isValid) {
        const response: ApiResponse = {
          success: false,
          message: validation.error || 'Invalid Google Docs URL',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Import document
      const startTime = Date.now();
      const docContent = await googleDocsService.importDocument(url);
      const processingTime = Date.now() - startTime;

      logger.info('Document imported successfully', {
        documentId: docContent.documentId,
        title: docContent.title,
        contentLength: docContent.content.length,
        wordCount: docContent.wordCount,
        processingTime: `${processingTime}ms`
      });

      const response: ApiResponse<{
        title: string;
        content: string;
        documentId: string;
        metadata: {
          lastModified?: string;
          wordCount?: number;
          processingTime: string;
        };
      }> = {
        success: true,
        message: 'Document imported successfully',
        data: {
          title: docContent.title,
          content: docContent.content,
          documentId: docContent.documentId,
          metadata: {
            ...(docContent.lastModified && { lastModified: docContent.lastModified }),
            ...(docContent.wordCount && { wordCount: docContent.wordCount }),
            processingTime: `${processingTime}ms`
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Google Docs import failed', { 
        url: req.body.url,
        error: error.message,
        type: error.type 
      });

      // Handle different types of errors
      let statusCode = 500;
      let errorMessage = 'Failed to import document';

      // Check for specific Google API errors
      if (error.message && error.message.includes('Google Docs API has not been used')) {
        statusCode = 503;
        errorMessage = 'Google Docs API is not enabled for this project. Please contact administrator.';
      } else if (error.message && error.message.includes('API has not been used')) {
        statusCode = 503;
        errorMessage = 'Google Docs API is not properly configured. Please contact administrator.';
      } else if (error.type) {
        switch (error.type) {
          case 'INVALID_URL':
            statusCode = 400;
            errorMessage = error.message;
            break;
          case 'PERMISSION_DENIED':
            statusCode = 403;
            errorMessage = error.message;
            break;
          case 'NOT_FOUND':
            statusCode = 404;
            errorMessage = error.message;
            break;
          case 'API_ERROR':
            statusCode = 502;
            errorMessage = error.message;
            break;
          case 'CREDENTIALS_ERROR':
            statusCode = 503;
            errorMessage = 'Google Docs integration is temporarily unavailable';
            break;
          default:
            statusCode = 500;
            errorMessage = 'An unexpected error occurred while importing the document';
        }
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        timestamp: new Date().toISOString()
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * Validate Google Docs URL without importing
   */
  async validateUrl(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        const response: ApiResponse = {
          success: false,
          message: 'URL is required',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const validation = googleDocsService.validateDocumentUrl(url);

      const response: ApiResponse<{
        isValid: boolean;
        error?: string;
      }> = {
        success: true,
        message: validation.isValid ? 'URL is valid' : 'URL is invalid',
        data: {
          isValid: validation.isValid,
          ...(validation.error && { error: validation.error })
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      logger.error('URL validation failed', { error });

      const response: ApiResponse = {
        success: false,
        message: 'Failed to validate URL',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get Google Docs service status
   */
  async getServiceStatus(_req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await googleDocsService.healthCheck();

      const response: ApiResponse<{
        available: boolean;
        status: string;
        message: string;
        details?: any;
      }> = {
        success: true,
        message: 'Service status retrieved',
        data: {
          available: googleDocsService.isAvailable(),
          status: healthCheck.status,
          message: healthCheck.message,
          details: healthCheck.details
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to get service status', { error });

      const response: ApiResponse = {
        success: false,
        message: 'Failed to get service status',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}

export const googleDocsController = new GoogleDocsController();