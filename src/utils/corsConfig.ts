import { CorsOptions } from 'cors';
import { logger } from './logger';

/**
 * 安全的 CORS 配置
 * 防止生產環境使用通配符和未授權域名存取
 */
export const createSecureCorsConfig = (): CorsOptions => {
  const corsOrigin = process.env['CORS_ORIGIN'];
  const nodeEnv = process.env['NODE_ENV'];

  // 允許的域名白名單
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://localhost:3000',
    'https://localhost:3001'
  ];

  // 根據環境添加生產域名
  if (corsOrigin && corsOrigin !== '*') {
    // 支持多個域名，用逗號分隔
    const origins = corsOrigin.split(',').map(origin => origin.trim());
    allowedOrigins.push(...origins);
  }

  // 生產環境安全檢查
  if (nodeEnv === 'production') {
    if (corsOrigin === '*') {
      const error = 'SECURITY ERROR: Wildcard CORS origin (*) is not allowed in production';
      logger.error(error);
      throw new Error(error);
    }

    // 確保生產環境有指定的 CORS 域名
    if (!corsOrigin || corsOrigin.includes('localhost')) {
      logger.warn('Production environment detected but localhost domains in CORS configuration', {
        corsOrigin,
        nodeEnv
      });
    }
  }

  const corsConfig: CorsOptions = {
    origin: (origin, callback) => {
      // 允許無 origin 的請求（如 Postman、移動應用等）
      if (!origin) {
        callback(null, true);
        return;
      }

      // 檢查是否在允許列表中
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS: Blocked request from unauthorized origin', {
          origin,
          allowedOrigins,
          userAgent: 'unknown' // Request object not available here
        });
        
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key', // 新增 API Key header
      'API-Version',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Response-Time',
      'API-Version',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: nodeEnv === 'production' ? 86400 : 300, // 生產環境快取 24 小時，開發環境 5 分鐘
    optionsSuccessStatus: 200, // 支援舊版瀏覽器
    preflightContinue: false
  };

  logger.info('CORS configuration initialized', {
    allowedOrigins: allowedOrigins.length,
    environment: nodeEnv,
    credentialsEnabled: corsConfig.credentials,
    maxAge: corsConfig.maxAge
  });

  return corsConfig;
};

/**
 * 驗證 CORS 配置的輔助函數
 */
export const validateCorsOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    
    // 基本安全檢查
    const isHttps = url.protocol === 'https:';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const hasValidPort = !url.port || (parseInt(url.port) > 0 && parseInt(url.port) <= 65535);
    
    // 生產環境必須使用 HTTPS（除非是本地開發）
    if (process.env['NODE_ENV'] === 'production' && !isHttps && !isLocalhost) {
      return false;
    }
    
    return hasValidPort;
  } catch {
    return false;
  }
};

/**
 * 取得當前 CORS 配置摘要（用於健康檢查）
 */
export const getCorsConfigSummary = () => {
  const corsOrigin = process.env['CORS_ORIGIN'];
  const nodeEnv = process.env['NODE_ENV'];
  
  return {
    environment: nodeEnv,
    corsOrigin: corsOrigin === '*' ? 'WILDCARD' : corsOrigin || 'NOT_SET',
    isSecure: corsOrigin !== '*' && nodeEnv === 'production',
    timestamp: new Date().toISOString()
  };
};