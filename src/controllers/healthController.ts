import type { Request, Response } from 'express';
import type { HealthCheckResult, ServiceStatus, ApiResponse } from '../types/index';
import { logServiceHealth } from '@utils/logger';
import { asyncHandler } from '@middleware/errorHandler';

// Health check controller
class HealthController {
  // Basic health check - returns 200 if service is running
  public health = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const healthResponse: ApiResponse<{ status: string; uptime: number; timestamp: string }> = {
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      message: 'Service is healthy',
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(healthResponse);
  });
  
  // Readiness check - comprehensive service dependency check
  public ready = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    // Check all service dependencies
    const services = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      openai: await this.checkOpenAI()
    };
    
    // Determine overall status
    const allHealthy = Object.values(services).every(service => service.status === 'up');
    const hasUnhealthy = Object.values(services).some(service => service.status === 'down');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    let httpStatus: number;
    
    if (allHealthy) {
      overallStatus = 'healthy';
      httpStatus = 200;
    } else if (hasUnhealthy) {
      overallStatus = 'unhealthy';
      httpStatus = 503;
    } else {
      overallStatus = 'degraded';
      httpStatus = 200;
    }
    
    const healthCheck: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services
    };
    
    const response: ApiResponse<HealthCheckResult> = {
      success: httpStatus < 400,
      data: healthCheck,
      message: `Service is ${overallStatus}`,
      timestamp: new Date().toISOString()
    };
    
    // Log health check results
    logServiceHealth('application', overallStatus === 'healthy' ? 'up' : overallStatus === 'unhealthy' ? 'down' : 'degraded', Date.now() - startTime);
    
    res.status(httpStatus).json(response);
  });
  
  // Detailed health check with metrics
  public detailed = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Service checks
    const services = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      openai: await this.checkOpenAI()
    };
    
    const detailedHealth = {
      status: Object.values(services).every(s => s.status === 'up') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
      system: {
        memory: {
          used: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      responseTime: `${Date.now() - startTime}ms`
    };
    
    const response: ApiResponse = {
      success: true,
      data: detailedHealth,
      message: 'Detailed health check completed',
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  });
  
  // Database connectivity check
  private async checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // This would be implemented when Prisma is set up
      // For now, return a mock response
      const responseTime = Date.now() - startTime;
      
      logServiceHealth('database', 'up', responseTime);
      
      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      
      logServiceHealth('database', 'down', responseTime, errorMessage);
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage,
        lastCheck: new Date().toISOString()
      };
    }
  }
  
  // Redis connectivity check
  private async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // This would be implemented when Redis client is set up
      // For now, return a mock response
      const responseTime = Date.now() - startTime;
      
      logServiceHealth('redis', 'up', responseTime);
      
      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';
      
      logServiceHealth('redis', 'down', responseTime, errorMessage);
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage,
        lastCheck: new Date().toISOString()
      };
    }
  }
  
  // OpenAI API connectivity check
  private async checkOpenAI(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // This would make a simple API call to OpenAI
      // For now, return a mock response
      const responseTime = Date.now() - startTime;
      
      logServiceHealth('openai', 'up', responseTime);
      
      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown OpenAI error';
      
      logServiceHealth('openai', 'down', responseTime, errorMessage);
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

export default new HealthController();