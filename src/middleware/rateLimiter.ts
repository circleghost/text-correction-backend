import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '@utils/logger';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, NODE_ENV } from '@utils/config';
import type { ApiResponse, AuthRequest } from '../types/index';

// Custom key generator for rate limiting
const keyGenerator = (req: Request): string => {
  // Use user ID if authenticated, otherwise fall back to IP
  const authReq = req as AuthRequest;
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }
  return req.ip || 'unknown';
};

// Custom rate limit handler
const rateLimitHandler = (req: Request, res: Response): void => {
  const clientId = keyGenerator(req);
  
  logger.warn('Rate limit exceeded', {
    clientId,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent')
  });
  
  const response: ApiResponse = {
    success: false,
    message: 'Too many requests, please try again later',
    timestamp: new Date().toISOString()
  };
  
  res.status(429).json(response);
};

// General rate limiter for all API endpoints
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting in test environment
    if (NODE_ENV === 'test') {
      return true;
    }
    // Skip for health check endpoints
    return req.path === '/health' || req.path === '/ready';
  }
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 attempts per window
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Strict rate limiter for text correction endpoints (expensive operations)
export const textCorrectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 corrections per minute
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Premium user rate limiter (higher limits)
export const premiumLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS * 5, // 5x the normal limit
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request) => {
    return NODE_ENV === 'test';
  }
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 3, // 3 uploads per minute
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Health check rate limiter (very lenient)
export const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60, // 1 request per second on average
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: false,
  legacyHeaders: false
});

// Dynamic rate limiter based on user type
export const dynamicRateLimiter = (_req: Request, res: Response, next: any): void => {
  // Check if user is premium (this would come from your user service/database)
  // const authReq = req as AuthRequest;
  // const isPremiumUser = authReq.user?.plan === 'premium';
  
  // For now, just use the general limiter
  generalLimiter(_req, res, next);
};

// Custom rate limiter for specific endpoints
export const createCustomRateLimiter = (
  windowMs: number,
  limit: number,
  message: string = 'Rate limit exceeded'
) => {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    handler: (req: Request, res: Response) => {
      const clientId = keyGenerator(req);
      
      logger.warn('Custom rate limit exceeded', {
        clientId,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        message
      });
      
      const response: ApiResponse = {
        success: false,
        message,
        timestamp: new Date().toISOString()
      };
      
      res.status(429).json(response);
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};