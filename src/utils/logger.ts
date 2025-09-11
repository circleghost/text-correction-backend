import winston from 'winston';
import { NODE_ENV, LOG_LEVEL } from '@utils/config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logEntry: Record<string, any> = {
      timestamp,
      level: level.toUpperCase(),
      message
    };
    
    if (stack) {
      logEntry['stack'] = stack;
    }
    
    if (Object.keys(meta).length > 0) {
      logEntry['meta'] = meta;
    }
    
    return JSON.stringify(logEntry, null, NODE_ENV === 'development' ? 2 : 0);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `[${timestamp}] ${level}: ${message}`;
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Create winston logger
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: {
    service: 'text-correction-api'
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: NODE_ENV === 'development' ? consoleFormat : logFormat,
      silent: NODE_ENV === 'test'
    }),
    
    // File transports for non-development environments
    ...(NODE_ENV !== 'development' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: NODE_ENV === 'development' ? consoleFormat : logFormat
    }),
    ...(NODE_ENV !== 'development' ? [
      new winston.transports.File({
        filename: 'logs/exceptions.log',
        format: logFormat
      })
    ] : [])
  ],
  
  rejectionHandlers: [
    new winston.transports.Console({
      format: NODE_ENV === 'development' ? consoleFormat : logFormat
    }),
    ...(NODE_ENV !== 'development' ? [
      new winston.transports.File({
        filename: 'logs/rejections.log',
        format: logFormat
      })
    ] : [])
  ]
});

// Request logging helper
export const logRequest = (req: any, res: any, responseTime: number): void => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    ...(req.user && { userId: req.user.userId })
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

// Error logging helper
export const logError = (error: Error, req?: any, additionalInfo?: Record<string, unknown>): void => {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(req && {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      ...(req.user && { userId: req.user.userId })
    }),
    ...additionalInfo
  };
  
  logger.error('Application Error', errorData);
};

// Service health logging
export const logServiceHealth = (serviceName: string, status: 'up' | 'down' | 'degraded', responseTime?: number, error?: string): void => {
  const logData = {
    service: serviceName,
    status,
    ...(responseTime && { responseTime: `${responseTime}ms` }),
    ...(error && { error })
  };
  
  if (status === 'down') {
    logger.error('Service Health Check', logData);
  } else if (status === 'degraded') {
    logger.warn('Service Health Check', logData);
  } else {
    logger.info('Service Health Check', logData);
  }
};

// Graceful shutdown logging
export const logShutdown = (signal: string, reason?: string): void => {
  logger.info('Application Shutdown', {
    signal,
    reason,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

// Startup logging
export const logStartup = (port: number): void => {
  logger.info('Application Started', {
    port,
    nodeVersion: process.version,
    platform: process.platform,
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
};

export default logger;