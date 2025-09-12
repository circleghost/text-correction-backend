import OpenAI from 'openai';
import { logger } from '../utils/logger';

interface TextCorrection {
  original: string;
  corrected: string;
  position: {
    start: number;
    end: number;
  };
  type: 'spelling' | 'grammar' | 'punctuation' | 'style';
  confidence?: number;
}

interface CorrectionOptions {
  language?: string;
  preserveFormatting?: boolean;
  correctionLevel?: 'basic' | 'standard' | 'advanced';
  concurrent?: number;
}

interface BatchParagraph {
  id: string;
  text: string;
}

interface BatchResult {
  paragraphId: string;
  status: 'completed' | 'error';
  correctedText?: string;
  corrections?: TextCorrection[];
  processingTime?: string;
  error?: string;
  errorDetails?: {
    originalError: string;
    errorType: string;
    statusCode?: number;
    textLength: number;
  };
}

export class TextCorrectionService {
  private readonly azureOpenaiClient: OpenAI | null;
  private readonly openaiClient: OpenAI | null;
  // private readonly preferAzure: boolean;
  private readonly defaultOptions: CorrectionOptions = {
    language: 'zh-TW',
    preserveFormatting: true,
    correctionLevel: 'standard',
    concurrent: 3
  };

  constructor() {
    // Initialize Azure OpenAI client (primary)
    const azureApiKey = process.env['AZURE_OPENAI_API_KEY'];
    const azureEndpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    
    if (azureApiKey && azureEndpoint) {
      // Azure OpenAI requires different configuration than standard OpenAI
      this.azureOpenaiClient = new OpenAI({
        apiKey: azureApiKey,
        baseURL: `${azureEndpoint}/openai/deployments/${process.env['AZURE_OPENAI_DEPLOYMENT_NAME']}`,
        defaultQuery: { 'api-version': process.env['AZURE_OPENAI_API_VERSION'] || '2025-01-01-preview' },
        defaultHeaders: {
          'api-key': azureApiKey,
          'Content-Type': 'application/json'
        },
      });
      // this.preferAzure = false; // Use Azure as fallback, not primary
      logger.info('Azure OpenAI client initialized successfully', {
        endpoint: azureEndpoint,
        deployment: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
        apiVersion: process.env['AZURE_OPENAI_API_VERSION']
      });
    } else {
      this.azureOpenaiClient = null;
      // this.preferAzure = false;
      logger.info('Azure OpenAI configuration not found - OpenAI will be primary only');
    }

    // Initialize OpenAI client (fallback or primary if no Azure)
    const openaiApiKey = process.env['OPENAI_API_KEY'];
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiApiKey,
      });
      logger.info('OpenAI client initialized successfully');
    } else {
      this.openaiClient = null;
      if (!this.azureOpenaiClient) {
        logger.warn('Neither Azure OpenAI nor OpenAI API keys found - using mock mode');
      }
    }

    // Log final configuration
    if (this.azureOpenaiClient && this.openaiClient) {
      logger.info('Dual AI provider setup: OpenAI (primary) + Azure OpenAI (fallback)');
    } else if (this.azureOpenaiClient) {
      logger.info('Single AI provider: Azure OpenAI only');
    } else if (this.openaiClient) {
      logger.info('Single AI provider: OpenAI only');
    }
  }

  /**
   * Correct a single text using OpenAI API
   */
  async correctText(text: string, options?: CorrectionOptions): Promise<{
    correctedText: string;
    corrections: TextCorrection[];
  }> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      if (!this.azureOpenaiClient && !this.openaiClient) {
        // Provide a mock correction when no API client is available
        logger.warn('No AI client available, returning mock correction');
        return this.mockCorrection(text);
      }

      const correctedText = await this.callAI(text, mergedOptions);
      const corrections = this.generateCorrections(text, correctedText);

      return {
        correctedText,
        corrections
      };
    } catch (error) {
      logger.error('Text correction failed', { error, text: text.substring(0, 100) });
      // Fallback to mock correction on API failure
      logger.warn('Falling back to mock correction due to API error');
      return this.mockCorrection(text);
    }
  }

  /**
   * Batch correct multiple paragraphs with concurrency control
   */
  async batchCorrectParagraphs(
    paragraphs: BatchParagraph[],
    options?: CorrectionOptions
  ): Promise<BatchResult[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const concurrency = mergedOptions.concurrent || 3;
    
    logger.info('Starting batch correction', {
      paragraphCount: paragraphs.length,
      concurrency
    });

    const results: BatchResult[] = [];
    
    // Process paragraphs in batches with concurrency control
    for (let i = 0; i < paragraphs.length; i += concurrency) {
      const batch = paragraphs.slice(i, i + concurrency);
      const batchPromises = batch.map(paragraph => 
        this.correctSingleParagraph(paragraph, mergedOptions)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const paragraphId = batch[index]?.id || 'unknown';
          logger.error('Paragraph correction failed', { 
            paragraphId, 
            error: result.reason 
          });
          results.push({
            paragraphId,
            status: 'error',
            error: 'Failed to process paragraph',
            processingTime: '0ms'
          });
        }
      });
    }

    return results;
  }

  /**
   * Correct a single paragraph (internal method)
   */
  private async correctSingleParagraph(
    paragraph: BatchParagraph,
    options: CorrectionOptions
  ): Promise<BatchResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.correctText(paragraph.text, options);
      const processingTime = `${Date.now() - startTime}ms`;

      return {
        paragraphId: paragraph.id,
        status: 'completed',
        correctedText: result.correctedText,
        corrections: result.corrections,
        processingTime
      };
    } catch (error) {
      const processingTime = `${Date.now() - startTime}ms`;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.status || (error as any)?.response?.status;
      const errorType = (error as any)?.type || 'unknown';
      
      logger.error('Single paragraph correction failed', {
        paragraphId: paragraph.id,
        textLength: paragraph.text.length,
        textPreview: paragraph.text.substring(0, 100),
        error: errorMessage,
        errorType,
        statusCode,
        processingTime
      });
      
      // Provide more specific error messages based on error type
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('API key')) {
        userFriendlyError = 'API 認證失敗，請檢查設定';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
        userFriendlyError = 'API 請求超時，請稍後再試';
      } else if (errorMessage.includes('rate limit')) {
        userFriendlyError = 'API 調用頻率超限，請稍後再試';
      } else if (errorMessage.includes('model') && errorMessage.includes('does not exist')) {
        userFriendlyError = 'AI 模型配置錯誤，請聯絡管理員';
      } else if (statusCode >= 500) {
        userFriendlyError = 'AI 服務暫時不可用，請稍後再試';
      }
      
      return {
        paragraphId: paragraph.id,
        status: 'error',
        error: userFriendlyError,
        errorDetails: {
          originalError: errorMessage,
          errorType,
          statusCode,
          textLength: paragraph.text.length
        },
        processingTime
      };
    }
  }

  /**
   * Intelligent AI routing: Try OpenAI first, fallback to Azure OpenAI
   */
  private async callAI(text: string, options: CorrectionOptions): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(options);
    const userPrompt = this.buildUserPrompt(text, options);

    // Try OpenAI first (primary)
    if (this.openaiClient) {
      try {
        const model = process.env['OPENAI_MODEL'] || 'gpt-4.1-nano';
        
        logger.info('🟢 Using OpenAI API (Primary)', {
          provider: 'OpenAI',
          model: model,
          endpoint: 'https://api.openai.com/v1/chat/completions',
          textLength: text.length,
          correctionLevel: options.correctionLevel,
          usage: 'primary'
        });
        
        const result = await this.callOpenAI(text, options, systemPrompt, userPrompt);
        logger.info('✅ OpenAI API call completed successfully', {
          provider: 'OpenAI',
          model: model,
          usage: 'primary'
        });
        return result;
      } catch (error) {
        logger.warn('❌ OpenAI call failed, attempting Azure OpenAI fallback', { 
          provider: 'OpenAI → Azure OpenAI (fallback)',
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackAvailable: !!this.azureOpenaiClient
        });
        
        // If Azure fallback is not available, rethrow the error
        if (!this.azureOpenaiClient) {
          throw error;
        }
      }
    }

    // Fallback to Azure OpenAI if OpenAI fails or is not available
    if (this.azureOpenaiClient) {
      try {
        const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] || 'unknown';
        
        logger.info('🔷 Using Azure OpenAI API (Fallback)', {
          provider: 'Azure OpenAI',
          endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
          deployment: deployment,
          textLength: text.length,
          correctionLevel: options.correctionLevel,
          apiVersion: process.env['AZURE_OPENAI_API_VERSION'],
          usage: 'fallback'
        });
        
        const result = await this.callAzureOpenAI(text, options, systemPrompt, userPrompt);
        logger.info('✅ Azure OpenAI API call completed successfully', {
          provider: 'Azure OpenAI',
          deployment: deployment,
          usage: 'fallback'
        });
        return result;
      } catch (error) {
        logger.error('Azure OpenAI fallback also failed', { error });
        throw error;
      }
    }

    throw new Error('No AI client available');
  }

  /**
   * Call Azure OpenAI API for text correction
   */
  private async callAzureOpenAI(text: string, _options: CorrectionOptions, systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.azureOpenaiClient) {
      throw new Error('Azure OpenAI client not available');
    }

    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const deploymentName = process.env['AZURE_OPENAI_DEPLOYMENT_NAME']!;
        logger.info(`🔷 Calling Azure OpenAI API (Attempt ${attempt}/${maxRetries})`, {
          provider: 'Azure OpenAI',
          endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
          deployment: deploymentName,
          apiVersion: process.env['AZURE_OPENAI_API_VERSION']
        });
        
        // For Azure OpenAI, the model parameter should be the deployment name
        const response = await this.azureOpenaiClient.chat.completions.create({
          model: deploymentName, // This is the deployment name, not model name
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.3
        });

        const correctedText = response.choices[0]?.message?.content?.trim();
        if (!correctedText) {
          throw new Error('Empty response from Azure OpenAI API');
        }

        logger.info('✅ Azure OpenAI API call successful', {
          provider: 'Azure OpenAI',
          deployment: deploymentName,
          model: response.model,
          attempt,
          inputLength: text.length,
          outputLength: correctedText.length,
          usage: response.usage
        });

        return correctedText;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = (error as any)?.status || (error as any)?.response?.status;
        
        logger.warn(`🔷 Azure OpenAI API call failed (Attempt ${attempt}/${maxRetries})`, {
          provider: 'Azure OpenAI',
          attempt,
          maxRetries,
          isLastAttempt,
          error: errorMessage,
          statusCode,
          endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
          deployment: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
          apiVersion: process.env['AZURE_OPENAI_API_VERSION']
        });

        if (isLastAttempt) {
          throw error;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Azure OpenAI API call failed after all retries');
  }

  /**
   * Call OpenAI API for text correction using official SDK with retry mechanism
   */
  private async callOpenAI(text: string, _options: CorrectionOptions, systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      const model = process.env['OPENAI_MODEL'] || 'gpt-4.1-nano';
      try {
        const estimatedTokens = Math.ceil(text.length / 3.5); // Rough estimate for Chinese text
        
        logger.info(`🟢 Calling OpenAI API (Attempt ${attempt}/${maxRetries})`, {
          provider: 'OpenAI',
          model: model,
          endpoint: 'https://api.openai.com',
          textLength: text.length,
          estimatedInputTokens: estimatedTokens,
          maxTokens: Math.min(4000, Math.max(text.length * 2, 1000)),
          temperature: 0.5,
          requestTime: new Date().toISOString()
        });
        
        const response = await this.openaiClient.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.5, // Low temperature for consistent corrections
          max_tokens: Math.min(4000, Math.max(text.length * 2, 1000)),
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        });

        const correctedText = response.choices[0]?.message?.content?.trim();
        
        if (!correctedText) {
          logger.warn('Empty response from OpenAI API, returning original text');
          return text;
        }

        const responseTime = Date.now() - startTime;
        
        logger.info('✅ OpenAI API call successful', { 
          provider: 'OpenAI',
          model: response.model || model,
          attempt,
          responseTime: `${responseTime}ms`,
          originalLength: text.length,
          correctedLength: correctedText.length,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0
          },
          costEstimate: {
            inputCost: ((response.usage?.prompt_tokens || 0) * 0.00001).toFixed(6),
            outputCost: ((response.usage?.completion_tokens || 0) * 0.00003).toFixed(6),
            totalCost: (((response.usage?.prompt_tokens || 0) * 0.00001) + ((response.usage?.completion_tokens || 0) * 0.00003)).toFixed(6)
          },
          completedAt: new Date().toISOString()
        });

        return correctedText;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const shouldRetry = this.shouldRetryError(error);
        
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = (error as any)?.status || (error as any)?.response?.status;
        const errorType = (error as any)?.type || 'unknown';
        
        logger.error(`❌ OpenAI API call failed (Attempt ${attempt}/${maxRetries})`, { 
          provider: 'OpenAI',
          model: model,
          attempt,
          maxRetries,
          isLastAttempt,
          responseTime: `${responseTime}ms`,
          error: errorMessage,
          errorType,
          statusCode,
          textLength: text.length,
          textPreview: text.substring(0, 100),
          endpoint: 'https://api.openai.com',
          willRetry: !isLastAttempt && shouldRetry,
          failedAt: new Date().toISOString()
        });

        if (isLastAttempt || !shouldRetry) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.info(`Retrying OpenAI API call in ${delay}ms`, { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw new Error('Unexpected error: retry loop completed without success or final error');
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryError(error: any): boolean {
    if (!error) return false;
    
    // Retry on specific OpenAI error types
    if (error.code) {
      switch (error.code) {
        case 'rate_limit_exceeded':
        case 'api_error':
        case 'overloaded_error':
        case 'timeout':
          return true;
        case 'invalid_api_key':
        case 'insufficient_quota':
        case 'model_not_found':
        case 'invalid_request_error':
          return false;
        default:
          return true; // Retry on unknown error codes
      }
    }
    
    // Retry on network errors
    if (error.message) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || 
          message.includes('timeout') || 
          message.includes('econnreset') ||
          message.includes('enotfound')) {
        return true;
      }
    }
    
    // Retry on 5xx HTTP status codes
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Don't retry on 4xx errors (client errors)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    
    return true; // Default to retry for unknown errors
  }

  /**
   * Build system prompt for OpenAI based on options
   */
  private buildSystemPrompt(options: CorrectionOptions): string {
    const language = options.language || 'zh-TW';
    
    if (language.startsWith('zh')) {
      return '你是一個專業的中文文字校正助手。請仔細檢查用戶提供的文字，修正其中的錯字、語法錯誤和標點符號問題。只返回修正後的文字內容，不要添加任何解釋或說明。';
    } else {
      return 'You are a professional text editor. Correct spelling, grammar, and punctuation errors while preserving the original meaning and style.';
    }
  }

  /**
   * Build user prompt for the specific text
   */
  private buildUserPrompt(text: string, _options: CorrectionOptions): string {
    return `請將以下文字複寫，只需改錯字及語句不通順的地方。

<text>
${text}
</text>`;
  }

  /**
   * Generate corrections by comparing original and corrected text
   */
  private generateCorrections(original: string, corrected: string): TextCorrection[] {
    // This is a simplified implementation
    // In a real scenario, you would use a more sophisticated diff algorithm
    const corrections: TextCorrection[] = [];
    
    if (original !== corrected) {
      // For now, create a single correction representing the entire change
      corrections.push({
        original: original,
        corrected: corrected,
        position: {
          start: 0,
          end: original.length
        },
        type: 'grammar', // Default type
        confidence: 0.8
      });
    }

    return corrections;
  }

  /**
   * Mock correction for testing when OpenAI API is not available
   */
  private mockCorrection(text: string): { correctedText: string; corrections: TextCorrection[] } {
    // Simple mock: just add a few corrections as examples
    let correctedText = text;
    const corrections: TextCorrection[] = [];

    // Example corrections (you would replace this with actual logic)
    if (text.includes('，。')) {
      correctedText = correctedText.replace('，。', '。');
      const position = text.indexOf('，。');
      corrections.push({
        original: '，。',
        corrected: '。',
        position: { start: position, end: position + 2 },
        type: 'punctuation',
        confidence: 0.95
      });
    }

    if (text.includes('的的')) {
      correctedText = correctedText.replace('的的', '的');
      const position = text.indexOf('的的');
      corrections.push({
        original: '的的',
        corrected: '的',
        position: { start: position, end: position + 2 },
        type: 'grammar',
        confidence: 0.9
      });
    }

    return { correctedText, corrections };
  }
}