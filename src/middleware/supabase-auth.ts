import type { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken } from '../config/supabase';
import { logger } from '../utils/logger';
import type { SupabaseAuthUser, AuthRequest } from '../types/index';

/**
 * Extract Bearer token from Authorization header
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication token required',
        message: 'Please provide a valid Bearer token in the Authorization header',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { user, error } = await verifySupabaseToken(token);
    
    if (error || !user) {
      logger.warn('Authentication failed:', error?.message || 'User not found');
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Please sign in again to access this resource',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Attach user to request object
    (req as AuthRequest).user = user as SupabaseAuthUser;
    
    logger.debug('User authenticated successfully:', user.id);
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
      message: 'Please try again later',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware for optional authentication (doesn't fail if no token provided)
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const { user, error } = await verifySupabaseToken(token);
    
    if (!error && user) {
      // Valid token, attach user to request
      (req as AuthRequest).user = user as SupabaseAuthUser;
      logger.debug('Optional auth successful for user:', user.id);
    } else {
      // Invalid token, but continue without failing
      logger.debug('Optional auth failed, continuing without user context');
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    // Don't fail the request, just continue without user context
    next();
  }
};

/**
 * Middleware to check if user is authenticated (after using authenticateToken)
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthRequest;
  
  if (!authReq.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'This endpoint requires authentication',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user has specific email (for admin access)
 */
export const requireAdmin = (adminEmails: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Admin access requires authentication',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!adminEmails.includes(authReq.user.email || '')) {
      logger.warn('Admin access denied for user:', authReq.user.email);
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.debug('Admin access granted to user:', authReq.user.email);
    next();
  };
};

/**
 * Middleware to extract user ID from authenticated request
 */
export const getCurrentUserId = (req: Request): string | null => {
  const authReq = req as AuthRequest;
  return authReq.user?.id || null;
};

/**
 * Middleware to extract user email from authenticated request
 */
export const getCurrentUserEmail = (req: Request): string | null => {
  const authReq = req as AuthRequest;
  return authReq.user?.email || null;
};

/**
 * Middleware to check rate limiting based on user authentication status
 */
export const authBasedRateLimit = (
  authenticatedLimit: number,
  anonymousLimit: number
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    // Add auth context to request for rate limiting
    (req as any).rateLimitContext = {
      isAuthenticated: !!authReq.user,
      userId: authReq.user?.id || null,
      limit: authReq.user ? authenticatedLimit : anonymousLimit,
    };
    
    next();
  };
};