import request from 'supertest';
import server from '../src/server';

describe('Express Server', () => {
  const app = server.getApp();

  describe('Basic server functionality', () => {
    it('should respond to GET /', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name', 'Text Correction API');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Health check endpoints', () => {
    it('should respond to GET /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', 'healthy');
    });

    it('should respond to GET /ready', async () => {
      const response = await request(app)
        .get('/ready')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(response.body.data.status);
    });

    it('should respond to GET /health/detailed', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('services');
    });
  });

  describe('Security headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Request logging', () => {
    it('should include request ID in response headers', async () => {
      const response = await request(app).get('/');

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include response time in headers', async () => {
      const response = await request(app).get('/');

      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers['x-response-time']).toMatch(/^\d+\.?\d*ms$/);
    });
  });

  describe('API documentation', () => {
    it('should serve Swagger UI at /api-docs', async () => {
      await request(app)
        .get('/api-docs')
        .expect(301); // Redirect to /api-docs/

      // Follow redirect
      const redirectResponse = await request(app)
        .get('/api-docs/')
        .expect('Content-Type', /html/)
        .expect(200);

      expect(redirectResponse.text).toContain('swagger-ui');
    });

    it('should serve OpenAPI spec at /api-docs.json', async () => {
      const response = await request(app)
        .get('/api-docs.json')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
    });
  });

  describe('Error handling', () => {
    it('should handle JSON parsing errors gracefully', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });
});