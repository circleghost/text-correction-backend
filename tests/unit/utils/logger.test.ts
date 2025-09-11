import winston from 'winston';
import { 
  logger, 
  logRequest, 
  logError, 
  logServiceHealth, 
  logShutdown, 
  logStartup 
} from '../../../src/utils/logger';

// Mock winston
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    }
  };
});

describe('Logger Utils', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = winston.createLogger();
    jest.clearAllMocks();
  });

  describe('logRequest', () => {
    it('should log successful HTTP requests as info', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        get: jest.fn((header) => {
          if (header === 'User-Agent') return 'test-agent';
          return undefined;
        }),
        ip: '127.0.0.1'
      };

      const mockRes = {
        statusCode: 200
      };

      logRequest(mockReq, mockRes, 150);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', {
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        responseTime: '150ms',
        userAgent: 'test-agent',
        ip: '127.0.0.1'
      });
    });

    it('should log client errors as warnings', () => {
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/test',
        get: jest.fn(() => 'test-agent'),
        ip: '127.0.0.1'
      };

      const mockRes = {
        statusCode: 400
      };

      logRequest(mockReq, mockRes, 50);

      expect(mockLogger.warn).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
        method: 'POST',
        statusCode: 400,
        responseTime: '50ms'
      }));
    });

    it('should log server errors as warnings', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        get: jest.fn(() => 'test-agent'),
        ip: '127.0.0.1'
      };

      const mockRes = {
        statusCode: 500
      };

      logRequest(mockReq, mockRes, 1000);

      expect(mockLogger.warn).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
        statusCode: 500,
        responseTime: '1000ms'
      }));
    });

    it('should include user ID when available', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        get: jest.fn(() => 'test-agent'),
        ip: '127.0.0.1',
        user: { userId: 'user123' }
      };

      const mockRes = {
        statusCode: 200
      };

      logRequest(mockReq, mockRes, 100);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
        userId: 'user123'
      }));
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logError(error);

      expect(mockLogger.error).toHaveBeenCalledWith('Application Error', {
        name: 'Error',
        message: 'Test error',
        stack: error.stack
      });
    });

    it('should include request information when provided', () => {
      const error = new Error('Test error');
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/test',
        get: jest.fn(() => 'test-agent'),
        ip: '127.0.0.1'
      };

      logError(error, mockReq);

      expect(mockLogger.error).toHaveBeenCalledWith('Application Error', expect.objectContaining({
        name: 'Error',
        message: 'Test error',
        method: 'POST',
        url: '/api/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1'
      }));
    });

    it('should include additional info when provided', () => {
      const error = new Error('Test error');
      const additionalInfo = { context: 'test', operationId: '123' };

      logError(error, undefined, additionalInfo);

      expect(mockLogger.error).toHaveBeenCalledWith('Application Error', expect.objectContaining({
        name: 'Error',
        message: 'Test error',
        context: 'test',
        operationId: '123'
      }));
    });
  });

  describe('logServiceHealth', () => {
    it('should log healthy service status as info', () => {
      logServiceHealth('database', 'up', 50);

      expect(mockLogger.info).toHaveBeenCalledWith('Service Health Check', {
        service: 'database',
        status: 'up',
        responseTime: '50ms'
      });
    });

    it('should log degraded service status as warning', () => {
      logServiceHealth('cache', 'degraded', 500, 'High latency detected');

      expect(mockLogger.warn).toHaveBeenCalledWith('Service Health Check', {
        service: 'cache',
        status: 'degraded',
        responseTime: '500ms',
        error: 'High latency detected'
      });
    });

    it('should log down service status as error', () => {
      logServiceHealth('external-api', 'down', undefined, 'Connection refused');

      expect(mockLogger.error).toHaveBeenCalledWith('Service Health Check', {
        service: 'external-api',
        status: 'down',
        error: 'Connection refused'
      });
    });
  });

  describe('logShutdown', () => {
    it('should log graceful shutdown', () => {
      logShutdown('SIGTERM', 'Process manager restart');

      expect(mockLogger.info).toHaveBeenCalledWith('Application Shutdown', expect.objectContaining({
        signal: 'SIGTERM',
        reason: 'Process manager restart'
      }));
    });

    it('should include uptime in shutdown log', () => {
      const originalUptime = process.uptime;
      process.uptime = jest.fn(() => 3600); // 1 hour

      logShutdown('SIGINT');

      expect(mockLogger.info).toHaveBeenCalledWith('Application Shutdown', expect.objectContaining({
        uptime: 3600
      }));

      process.uptime = originalUptime;
    });
  });

  describe('logStartup', () => {
    it('should log application startup', () => {
      const originalVersion = process.version;
      const originalPlatform = process.platform;
      
      Object.defineProperty(process, 'version', { value: 'v18.0.0' });
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      logStartup(3000);

      expect(mockLogger.info).toHaveBeenCalledWith('Application Started', expect.objectContaining({
        port: 3000,
        nodeVersion: 'v18.0.0',
        platform: 'darwin'
      }));

      Object.defineProperty(process, 'version', { value: originalVersion });
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should include timestamp in startup log', () => {
      logStartup(3000);

      expect(mockLogger.info).toHaveBeenCalledWith('Application Started', expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      }));
    });
  });

  describe('Logger configuration', () => {
    it('should create logger with correct configuration', () => {
      // Winston createLogger is called during module import, so just verify the logger exists
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should handle different log levels', () => {
      logger.info('info message');
      logger.warn('warning message');
      logger.error('error message');
      logger.debug('debug message');

      expect(mockLogger.info).toHaveBeenCalledWith('info message');
      expect(mockLogger.warn).toHaveBeenCalledWith('warning message');
      expect(mockLogger.error).toHaveBeenCalledWith('error message');
      expect(mockLogger.debug).toHaveBeenCalledWith('debug message');
    });
  });
});