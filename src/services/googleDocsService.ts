import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

interface GoogleDocContent {
  title: string;
  content: string;
  documentId: string;
  lastModified?: string;
  wordCount?: number;
}

interface GoogleDocsError {
  type: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INVALID_URL' | 'API_ERROR' | 'CREDENTIALS_ERROR';
  message: string;
  details?: any;
}

export class GoogleDocsService {
  private auth: GoogleAuth | null = null;
  private docs: any = null;
  private drive: any = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const credentialsPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
      
      if (!credentialsPath) {
        logger.warn('Google Docs service disabled: GOOGLE_APPLICATION_CREDENTIALS not configured');
        return;
      }

      // Check if credentials file exists
      const fullPath = path.resolve(credentialsPath);
      if (!fs.existsSync(fullPath)) {
        logger.error('Google Docs credentials file not found', { path: fullPath });
        return;
      }

      // Initialize Google Auth
      this.auth = new GoogleAuth({
        keyFile: fullPath,
        scopes: [
          'https://www.googleapis.com/auth/documents.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
      });

      // Initialize Google APIs
      this.docs = google.docs({ version: 'v1', auth: this.auth });
      this.drive = google.drive({ version: 'v3', auth: this.auth });

      logger.info('Google Docs service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Google Docs service', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Extract document ID from Google Docs URL
   */
  private extractDocumentId(url: string): string | null {
    try {
      const patterns = [
        // Standard Google Docs URL
        /\/document\/d\/([a-zA-Z0-9-_]+)/,
        // Alternative formats
        /\/document\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/,
        // Edit mode
        /\/document\/d\/([a-zA-Z0-9-_]+)\/edit/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      logger.error('Error extracting document ID from URL', { url, error });
      return null;
    }
  }

  /**
   * Validate Google Docs URL format
   */
  public validateDocumentUrl(url: string): { isValid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL is required' };
    }

    // Check if it's a Google Docs URL
    if (!url.includes('docs.google.com/document')) {
      return { isValid: false, error: 'Not a valid Google Docs URL' };
    }

    // Extract document ID
    const documentId = this.extractDocumentId(url);
    if (!documentId) {
      return { isValid: false, error: 'Could not extract document ID from URL' };
    }

    return { isValid: true };
  }

  /**
   * Check if Google Docs service is available
   */
  public isAvailable(): boolean {
    return this.auth !== null && this.docs !== null && this.drive !== null;
  }

  /**
   * Import document content from Google Docs URL
   */
  async importDocument(url: string): Promise<GoogleDocContent> {
    if (!this.isAvailable()) {
      throw this.createError('CREDENTIALS_ERROR', 'Google Docs service is not available');
    }

    // Validate URL
    const validation = this.validateDocumentUrl(url);
    if (!validation.isValid) {
      throw this.createError('INVALID_URL', validation.error!);
    }

    // Extract document ID
    const documentId = this.extractDocumentId(url);
    if (!documentId) {
      throw this.createError('INVALID_URL', 'Could not extract document ID from URL');
    }

    logger.info('Importing Google Doc', { documentId, url });

    try {
      // Get document content and metadata in parallel
      const [docResponse, metadataResponse] = await Promise.all([
        this.docs.documents.get({ documentId }),
        this.getDocumentMetadata(documentId)
      ]);

      // Extract text content from document structure
      const content = this.extractTextContent(docResponse.data);
      
      const result: GoogleDocContent = {
        title: docResponse.data.title || 'Untitled Document',
        content,
        documentId,
        lastModified: metadataResponse.modifiedTime,
        wordCount: this.countWords(content)
      };

      logger.info('Document imported successfully', {
        documentId,
        title: result.title,
        contentLength: content.length,
        wordCount: result.wordCount
      });

      return result;

    } catch (error: any) {
      logger.error('Failed to import Google Doc', { documentId, error: error.message });

      // Handle specific Google API errors
      if (error.code === 403) {
        throw this.createError('PERMISSION_DENIED', 'Permission denied. Make sure the document is shared with "Anyone with the link can view" or the service account has access.');
      } else if (error.code === 404) {
        throw this.createError('NOT_FOUND', 'Document not found or URL is invalid.');
      } else if (error.code >= 500) {
        throw this.createError('API_ERROR', 'Google Docs API is temporarily unavailable. Please try again later.');
      } else {
        throw this.createError('API_ERROR', `Failed to access document: ${error.message}`);
      }
    }
  }

  /**
   * Get document metadata from Google Drive
   */
  private async getDocumentMetadata(documentId: string): Promise<any> {
    try {
      const response = await this.drive.files.get({
        fileId: documentId,
        fields: 'modifiedTime,createdTime,owners,permissions'
      });
      return response.data;
    } catch (error) {
      logger.warn('Could not fetch document metadata', { documentId, error });
      return {};
    }
  }

  /**
   * Extract plain text content from Google Docs structure
   */
  private extractTextContent(document: any): string {
    if (!document.body || !document.body.content) {
      return '';
    }

    let text = '';
    
    const extractFromContent = (content: any[]): string => {
      let result = '';
      
      for (const element of content) {
        if (element.paragraph) {
          // Handle paragraph elements
          if (element.paragraph.elements) {
            for (const paragraphElement of element.paragraph.elements) {
              if (paragraphElement.textRun && paragraphElement.textRun.content) {
                result += paragraphElement.textRun.content;
              }
            }
          }
        } else if (element.table) {
          // Handle table elements
          if (element.table.tableRows) {
            for (const row of element.table.tableRows) {
              if (row.tableCells) {
                for (const cell of row.tableCells) {
                  if (cell.content) {
                    result += extractFromContent(cell.content) + ' ';
                  }
                }
              }
              result += '\n';
            }
          }
        } else if (element.sectionBreak) {
          // Handle section breaks
          result += '\n\n';
        }
      }
      
      return result;
    };

    text = extractFromContent(document.body.content);
    
    // Clean up the text
    text = text
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .trim();

    return text;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Create standardized error object
   */
  private createError(type: GoogleDocsError['type'], message: string, details?: any): GoogleDocsError {
    return {
      type,
      message,
      details
    };
  }

  /**
   * Health check for Google Docs service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; details?: any }> {
    try {
      if (!this.isAvailable()) {
        return {
          status: 'unhealthy',
          message: 'Google Docs service not available - credentials not configured'
        };
      }

      // Try to access Google Docs API
      await this.auth!.getAccessToken();
      
      return {
        status: 'healthy',
        message: 'Google Docs service is working correctly'
      };
    } catch (error) {
      logger.error('Google Docs health check failed', { error });
      return {
        status: 'unhealthy',
        message: 'Google Docs service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const googleDocsService = new GoogleDocsService();