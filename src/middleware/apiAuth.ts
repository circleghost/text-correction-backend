import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

// 擴展 Request interface 以包含 API key 資訊
export interface AuthenticatedRequest extends Request {
  apiKeyId?: string;
  isAuthenticated?: boolean;
}

/**
 * Simple API Key authentication middleware
 * 檢查 X-API-Key header 或 Authorization Bearer token
 */
export const apiKeyAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // 從 header 取得 API key
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      logger.warn('API request without API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Please provide X-API-Key header or Authorization Bearer token.',
        code: 'MISSING_API_KEY'
      });
      return;
    }

    // 驗證 API key 格式（應該以 sk- 開頭）
    if (!apiKey.startsWith('sk-') || apiKey.length < 32) {
      logger.warn('Invalid API key format', {
        ip: req.ip,
        keyPrefix: apiKey.substring(0, 7) + '...',
        endpoint: req.path
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key format.',
        code: 'INVALID_API_KEY_FORMAT'
      });
      return;
    }

    // 驗證 API key 是否在有效列表中
    const validApiKeys = process.env['VALID_API_KEYS']?.split(',') || [];
    
    if (validApiKeys.length === 0) {
      logger.error('No valid API keys configured', {
        endpoint: req.path
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'API authentication not properly configured.',
        code: 'AUTH_CONFIG_ERROR'
      });
      return;
    }

    const isValidKey = validApiKeys.some(validKey => validKey.trim() === apiKey);
    
    if (!isValidKey) {
      logger.warn('Invalid API key provided', {
        ip: req.ip,
        keyPrefix: apiKey.substring(0, 7) + '...',
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    // API key 驗證通過
    req.apiKeyId = apiKey.substring(0, 7) + '...'; // 只存儲前綴供日誌使用
    req.isAuthenticated = true;

    logger.info('API request authenticated', {
      ip: req.ip,
      keyId: req.apiKeyId,
      endpoint: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('API authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      endpoint: req.path
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication system error.',
      code: 'AUTH_SYSTEM_ERROR'
    });
  }
};

/**
 * Optional API Key authentication - 不強制要求但會記錄
 * 用於逐步遷移現有端點
 */
export const optionalApiKeyAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string || 
                 req.headers.authorization?.replace('Bearer ', '');

  if (apiKey) {
    // 如果提供了 API key，就驗證它
    apiKeyAuth(req, res, next);
  } else {
    // 沒有提供 API key，記錄但允許通過
    logger.warn('API request without authentication', {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    
    req.isAuthenticated = false;
    next();
  }
};

/**
 * 檢查請求是否已認證的輔助函數
 */
export const isAuthenticated = (req: AuthenticatedRequest): boolean => {
  return req.isAuthenticated === true;
};

/**
 * 取得 API key ID（遮罩後）的輔助函數
 */
export const getApiKeyId = (req: AuthenticatedRequest): string | null => {
  return req.apiKeyId || null;
};