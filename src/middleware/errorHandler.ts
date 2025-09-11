import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/index';
import type { ApiResponse } from '../types/index';
import { logger, logError } from '@utils/logger';
import { NODE_ENV } from '@utils/config';

// Global error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void => {
  // Log the error
  logError(error, req);
  
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;
  
  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    isOperational = true;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    isOperational = true;
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
    isOperational = true;
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON payload';
    isOperational = true;
  } else if (error.name === 'MongoError' || error.name === 'CastError') {
    statusCode = 400;
    message = 'Database operation failed';
    isOperational = true;
  } else if ('code' in error && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    isOperational = true;
  }
  
  // Prepare error response
  const errorResponse: ApiResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('x-request-id') as string
  };
  
  // Include error details in development mode
  if (NODE_ENV === 'development') {
    errorResponse.error = error.message;
    if (error.stack) {
      (errorResponse as any).stack = error.stack;
    }
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
  
  // Log critical errors for monitoring
  if (!isOperational || statusCode >= 500) {
    logger.error('Critical Application Error', {
      error: error.message,
      stack: error.stack,
      statusCode,
      isOperational,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  _res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable') {
    super(message, 503);
  }
}

// Error response helper
export const sendErrorResponse = (
  res: Response<ApiResponse>,
  statusCode: number,
  message: string,
  error?: string
): void => {
  const errorResponse: ApiResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    requestId: res.getHeader('x-request-id') as string
  };
  
  if (error && NODE_ENV === 'development') {
    errorResponse.error = error;
  }
  
  res.status(statusCode).json(errorResponse);
};