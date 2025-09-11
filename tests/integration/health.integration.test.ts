import request from 'supertest';
import server from '../../src/server';
import { apiTestHelpers, setupTestEnvironment } from '../utils/test-helpers';

describe('Health Endpoints Integration Tests', () => {
  const app = server.getApp();
  
  setupTestEnvironment();

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      apiTestHelpers.validateApiResponse(response, true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });

    it('should include request ID in headers', async () => {
      const response = await request(app)
        .get('/health');

      const requestId = apiTestHelpers.getRequestId(response);
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^[a-f0-9\-]+$/i);
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const responseTime = Date.now() - startTime;

      // Health check should respond within 100ms
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      apiTestHelpers.validateApiResponse(response, response.status === 200);
      expect(response.body.data).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.body.data.status);
    });

    it('should include dependency status when healthy', async () => {
      const response = await request(app)
        .get('/ready');

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('dependencies');
        expect(typeof response.body.data.dependencies).toBe('object');
      }
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed system information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      apiTestHelpers.validateApiResponse(response, true);
      
      const { data } = response.body;
      expect(data).toHaveProperty('system');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('timestamp');
      
      // System information
      expect(data.system).toHaveProperty('nodeVersion');
      expect(data.system).toHaveProperty('platform');
      expect(data.system).toHaveProperty('uptime');
      expect(data.system).toHaveProperty('memory');
      
      // Memory information
      expect(data.system.memory).toHaveProperty('used');
      expect(data.system.memory).toHaveProperty('total');
      expect(data.system.memory).toHaveProperty('percentage');
      expect(typeof data.system.memory.percentage).toBe('number');
      expect(data.system.memory.percentage).toBeGreaterThan(0);
      expect(data.system.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should include service status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      const { services } = response.body.data;
      expect(typeof services).toBe('object');
      
      // Each service should have status and response time
      Object.values(services).forEach((service: any) => {
        expect(service).toHaveProperty('status');
        expect(['healthy', 'unhealthy', 'degraded']).toContain(service.status);
        
        if (service.responseTime !== undefined) {
          expect(typeof service.responseTime).toBe('number');
          expect(service.responseTime).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);

      apiTestHelpers.validateApiResponse(response, false);
      expect(response.body.message).toContain('Invalid JSON');
    });
  });

  describe('Security headers', () => {
    it('should include security headers in all health responses', async () => {
      const endpoints = ['/health', '/ready', '/health/detailed'];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
        expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
        expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      }
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent health check requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        apiTestHelpers.validateApiResponse(response, true);
      });
    });

    it('should maintain performance under load', async () => {
      const requestCount = 50;
      const requests = [];
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        const healthRequest = request(app).get('/health').then(() => {
          responseTimes.push(Date.now() - startTime);
        });
        requests.push(healthRequest);
      }

      await Promise.all(requests);

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(50);
      expect(maxResponseTime).toBeLessThan(200);
    });
  });
});