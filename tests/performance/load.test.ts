import autocannon from 'autocannon';
import server from '../../src/server';

describe('Load Testing', () => {
  let serverInstance: any;
  
  beforeAll(async () => {
    // Start server for load testing
    serverInstance = server.listen(0); // Use random port
    const address = serverInstance.address();
    const port = typeof address === 'string' ? address : address?.port;
    process.env.TEST_PORT = port?.toString();
  });

  afterAll(async () => {
    if (serverInstance) {
      await new Promise<void>((resolve) => {
        serverInstance.close(() => resolve());
      });
    }
  });

  describe('Health endpoint performance', () => {
    it('should handle moderate load on /health endpoint', async () => {
      const port = process.env.TEST_PORT;
      
      const result = await autocannon({
        url: `http://localhost:${port}/health`,
        connections: 10,
        pipelining: 1,
        duration: 10, // 10 seconds
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(100); // Should handle at least 100 req/sec
      expect(result.latency.mean).toBeLessThan(100); // Average latency should be < 100ms
    }, 15000); // 15 second timeout

    it('should handle high load on /health endpoint', async () => {
      const port = process.env.TEST_PORT;
      
      const result = await autocannon({
        url: `http://localhost:${port}/health`,
        connections: 50,
        pipelining: 5,
        duration: 5, // 5 seconds
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(500); // Should handle at least 500 req/sec
      expect(result.latency.p99).toBeLessThan(500); // 99th percentile should be < 500ms
    }, 10000);

    it('should maintain stability under sustained load', async () => {
      const port = process.env.TEST_PORT;
      
      const result = await autocannon({
        url: `http://localhost:${port}/health`,
        connections: 20,
        pipelining: 2,
        duration: 30, // 30 seconds sustained
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      
      // Check for consistent performance
      const latencyStdDev = calculateStandardDeviation([
        result.latency.min,
        result.latency.mean,
        result.latency.max
      ]);
      
      // Standard deviation should not be too high (indicating consistent performance)
      expect(latencyStdDev).toBeLessThan(result.latency.mean * 0.5);
    }, 35000);
  });

  describe('API documentation performance', () => {
    it('should serve Swagger documentation efficiently', async () => {
      const port = process.env.TEST_PORT;
      
      const result = await autocannon({
        url: `http://localhost:${port}/api-docs.json`,
        connections: 5,
        pipelining: 1,
        duration: 5,
      });

      expect(result.errors).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.latency.mean).toBeLessThan(200); // Documentation should load quickly
    });
  });

  describe('Error handling performance', () => {
    it('should handle 404 errors efficiently', async () => {
      const port = process.env.TEST_PORT;
      
      const result = await autocannon({
        url: `http://localhost:${port}/non-existent-endpoint`,
        connections: 10,
        duration: 5,
      });

      expect(result.errors).toBe(0);
      expect(result['2xx']).toBe(0);
      expect(result['4xx']).toBeGreaterThan(0);
      expect(result.latency.mean).toBeLessThan(50); // Error responses should be fast
    });
  });

  describe('Memory and resource usage', () => {
    it('should not cause memory leaks under load', async () => {
      const port = process.env.TEST_PORT;
      const initialMemory = process.memoryUsage();
      
      // Run multiple load tests
      for (let i = 0; i < 3; i++) {
        await autocannon({
          url: `http://localhost:${port}/health`,
          connections: 25,
          duration: 5,
        });
        
        // Allow garbage collection
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 25000);
  });

  describe('Concurrent request handling', () => {
    it('should handle mixed endpoint load', async () => {
      const port = process.env.TEST_PORT;
      
      // Run multiple autocannon instances concurrently
      const results = await Promise.all([
        autocannon({
          url: `http://localhost:${port}/health`,
          connections: 15,
          duration: 8,
        }),
        autocannon({
          url: `http://localhost:${port}/ready`,
          connections: 10,
          duration: 8,
        }),
        autocannon({
          url: `http://localhost:${port}/health/detailed`,
          connections: 5,
          duration: 8,
        }),
      ]);

      results.forEach((result, index) => {
        expect(result.errors).toBe(0);
        expect(result.timeouts).toBe(0);
        expect(result.non2xx).toBe(0);
        
        // Each endpoint should maintain reasonable performance
        expect(result.latency.mean).toBeLessThan(200);
      });
    }, 15000);
  });
});

// Helper function to calculate standard deviation
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}