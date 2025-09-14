import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest, logger } from '@utils/logger';
import type { AuthRequest } from '../types/index';

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to headers
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  
  // Log incoming request
  const authReq = req as AuthRequest;
  logger.info('Incoming Request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    ...(authReq.user && { userId: authReq.user.id })
  });
  
  // Override the res.end method to log when response is sent
  const originalEnd = res.end.bind(res);
  res.end = (chunk?: any, encoding?: any) => {
    const responseTime = Date.now() - startTime;
    
    // Log the response
    logRequest(req, res, responseTime);
    
    // Call original end method
    return originalEnd(chunk, encoding);
  };
  
  next();
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  
  // Set the header before sending the response
  const originalEnd = res.end.bind(res);
  res.end = (chunk?: any, encoding?: any) => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
    
    // Set performance header before ending response
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (duration > 1000) { // Log if request takes more than 1 second
      logger.warn('Slow Request Detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        ip: req.ip,
        ...(((req as AuthRequest).user) && { userId: (req as AuthRequest).user!.id })
      });
    }
    
    return originalEnd(chunk, encoding);
  };
  
  next();
};

// Request size monitoring middleware
export const requestSizeMonitor = (req: Request, _res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB limit
  
  if (contentLength > maxSize) {
    logger.warn('Large Request Received', {
      method: req.method,
      url: req.originalUrl,
      contentLength: `${(contentLength / 1024 / 1024).toFixed(2)}MB`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};

// Security headers middleware
export const securityLogger = (req: Request, _res: Response, next: NextFunction): void => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /admin/i,
    /\.env/i,
    /config/i,
    /password/i,
    /token/i,
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /union.*select/i
  ];
  
  const url = req.originalUrl.toLowerCase();
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));
  
  if (isSuspicious) {
    logger.warn('Suspicious Request Pattern Detected', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      headers: {
        authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
        cookie: req.get('Cookie') ? '[REDACTED]' : undefined,
        referer: req.get('Referer'),
        'x-forwarded-for': req.get('X-Forwarded-For')
      }
    });
  }
  
  next();
};

// API version logging middleware
export const apiVersionLogger = (req: Request, res: Response, next: NextFunction): void => {
  const apiVersion = req.get('API-Version') || req.query['version'] || 'v1';
  
  // Add API version to response headers
  res.setHeader('API-Version', String(apiVersion));
  
  // Log API version usage
  if (req.path.startsWith('/api')) {
    logger.debug('API Version Used', {
      version: apiVersion,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};