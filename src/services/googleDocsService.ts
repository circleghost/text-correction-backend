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
      // Method 1: Try environment variable with JSON credentials (production)
      const credentialsJson = process.env['GOOGLE_CREDENTIALS_JSON'];
      
      if (credentialsJson) {
        try {
          const credentials = JSON.parse(credentialsJson);
          logger.info('Using Google Docs credentials from environment variable');
          
          this.auth = new GoogleAuth({
            credentials,
            scopes: [
              'https://www.googleapis.com/auth/documents.readonly',
              'https://www.googleapis.com/auth/drive.readonly'
            ]
          });
          
          await this.testConnection();
          return;
        } catch (parseError) {
          logger.error('Failed to parse Google credentials JSON from environment variable', { 
            error: parseError instanceof Error ? parseError.message : parseError 
          });
        }
      }

      // Method 2: Try individual environment variables (alternative production method)
      const clientEmail = process.env['GOOGLE_CLIENT_EMAIL'];
      const privateKey = process.env['GOOGLE_PRIVATE_KEY'];
      const projectId = process.env['GOOGLE_PROJECT_ID'];

      if (clientEmail && privateKey && projectId) {
        try {
          logger.info('Using Google Docs credentials from individual environment variables');
          
          // Replace escaped newlines with actual newlines in private key
          const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
          
          this.auth = new GoogleAuth({
            credentials: {
              client_email: clientEmail,
              private_key: formattedPrivateKey,
              project_id: projectId,
              type: 'service_account'
            },
            scopes: [
              'https://www.googleapis.com/auth/documents.readonly',
              'https://www.googleapis.com/auth/drive.readonly'
            ]
          });
          
          await this.testConnection();
          return;
        } catch (credError) {
          logger.error('Failed to initialize Google Auth with individual environment variables', { 
            error: credError instanceof Error ? credError.message : credError 
          });
        }
      }

      // Method 3: Try file path (development fallback)
      const credentialsPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
      
      if (credentialsPath) {
        const fullPath = path.resolve(credentialsPath);
        if (fs.existsSync(fullPath)) {
          logger.info('Using Google Docs credentials from file path (development)', { path: fullPath });
          
          this.auth = new GoogleAuth({
            keyFile: fullPath,
            scopes: [
              'https://www.googleapis.com/auth/documents.readonly',
              'https://www.googleapis.com/auth/drive.readonly'
            ]
          });
          
          await this.testConnection();
          return;
        } else {
          logger.error('Google Docs credentials file not found', { path: fullPath });
        }
      }

      // No credentials found - disable service
      logger.warn('Google Docs service disabled: No valid credentials found');
      logger.info('To enable Google Docs service, set one of:');
      logger.info('1. GOOGLE_CREDENTIALS_JSON (recommended for production)');
      logger.info('2. GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY + GOOGLE_PROJECT_ID');
      logger.info('3. GOOGLE_APPLICATION_CREDENTIALS (file path for development)');

    } catch (error) {
      logger.error('Failed to initialize Google Docs service', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Test the connection and initialize Google APIs
   */
  private async testConnection(): Promise<void> {
    if (!this.auth) {
      throw new Error('Google Auth not initialized');
    }

    // Initialize Google APIs
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });

    // Test the connection by making a simple API call
    try {
      await this.auth.getClient();
      const projectId = await this.auth.getProjectId();
      
      logger.info('Google Docs service initialized successfully', {
        projectId,
        hasDocsApi: !!this.docs,
        hasDriveApi: !!this.drive
      });
    } catch (testError) {
      logger.error('Google Docs service authentication failed', {
        error: testError instanceof Error ? testError.message : testError
      });
      throw testError;
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