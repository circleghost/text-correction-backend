import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { createServer, Server } from 'http';

// Import configurations and utilities
import { PORT, NODE_ENV, CORS_ORIGIN, validateConfig } from '@utils/config';
import { logger, logStartup, logShutdown } from '@utils/logger';
import { swaggerSpec, swaggerUiOptions } from '@utils/swagger';

// Import middleware
import { errorHandler, notFoundHandler } from '@middleware/errorHandler';
import { generalLimiter } from '@middleware/rateLimiter';
import { 
  requestLogger, 
  performanceMonitor, 
  requestSizeMonitor, 
  securityLogger,
  apiVersionLogger 
} from '@middleware/requestLogger';

// Import routes
import routes from '@routes/index';

class ExpressServer {
  private app: Express;
  private server: Server | null = null;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
  }

  private initializeMiddleware(): void {
    // Trust proxy for proper IP detection behind load balancers
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
          fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
          connectSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'API-Version',
        'X-Request-ID'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Response-Time',
        'API-Version'
      ],
      maxAge: 86400 // 24 hours
    }));

    // Compression middleware
    this.app.use(compression({
      threshold: 1024, // Only compress if > 1KB
      level: 6, // Compression level (0-9)
      filter: (req: Request, _res: Response) => {
        // Don't compress if the request includes a 'x-no-compression' header
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use compression filter function from compression module
        return compression.filter(req, _res);
      }
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, _res: Response, buf: Buffer) => {
        // Store raw body for webhook validation if needed
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Custom middleware
    this.app.use(requestLogger);
    this.app.use(performanceMonitor);
    this.app.use(requestSizeMonitor);
    this.app.use(securityLogger);
    this.app.use(apiVersionLogger);
    this.app.use(generalLimiter);

    logger.info('Middleware initialized successfully');
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/', routes);

    // 404 handler for unmatched routes
    this.app.use('*', notFoundHandler);

    logger.info('Routes initialized successfully');
  }

  private initializeSwagger(): void {
    // Swagger documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    
    // Swagger JSON endpoint
    this.app.get('/api-docs.json', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    logger.info('Swagger documentation initialized at /api-docs');
  }

  private initializeErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(errorHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown
      this.shutdown('UNCAUGHT_EXCEPTION', error.message);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      logger.error('Unhandled Rejection:', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString()
      });
      
      // Graceful shutdown
      this.shutdown('UNHANDLED_REJECTION', String(reason));
    });

    logger.info('Error handling initialized successfully');
  }

  private setupGracefulShutdown(): void {
    // Graceful shutdown on various signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
    
    signals.forEach((signal) => {
      process.on(signal, () => {
        this.shutdown(signal);
      });
    });
  }

  private async shutdown(signal: string, reason?: string): Promise<void> {
    logShutdown(signal, reason);
    
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    if (this.server) {
      // Stop accepting new connections
      this.server.close((error) => {
        if (error) {
          logger.error('Error during server close:', error);
          process.exit(1);
        }

        logger.info('Server closed successfully');
        
        // Close database connections, Redis, etc.
        this.cleanup()
          .then(() => {
            logger.info('Graceful shutdown completed');
            process.exit(0);
          })
          .catch((cleanupError) => {
            logger.error('Error during cleanup:', cleanupError);
            process.exit(1);
          });
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  }

  private async cleanup(): Promise<void> {
    // Cleanup tasks: close database connections, Redis connections, etc.
    const cleanupPromises: Promise<void>[] = [];

    // Database cleanup (when implemented)
    // cleanupPromises.push(prismaClient.$disconnect());

    // Redis cleanup (when implemented)
    // cleanupPromises.push(redisClient.quit());

    try {
      await Promise.all(cleanupPromises);
      logger.info('All connections closed successfully');
    } catch (error) {
      logger.error('Error during connection cleanup:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Create logs directory if it doesn't exist
      if (NODE_ENV !== 'development') {
        const fs = await import('fs');
        const path = await import('path');
        const logsDir = path.join(process.cwd(), 'logs');
        
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
      }

      // Start the server
      this.server = createServer(this.app);
      
      this.server.listen(PORT, '0.0.0.0', () => {
        logStartup(PORT);
        console.log(`
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│  🚀 Text Correction API Server Started Successfully!       │
│                                                             │
│  📊 Environment: ${NODE_ENV.padEnd(12)} 🌍 Port: ${PORT.toString().padStart(4)}        │
│                                                             │
│  📖 API Documentation: http://localhost:${PORT}/api-docs        │
│  ❤️  Health Check:     http://localhost:${PORT}/health          │
│  ⚡ Ready Check:       http://localhost:${PORT}/ready           │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
        `);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

        switch (error.code) {
          case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
          case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
          default:
            throw error;
        }
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public getApp(): Express {
    return this.app;
  }

  public getServer(): Server | null {
    return this.server;
  }
}

// Create and start server
const server = new ExpressServer();

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  server.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default server;