// import { faker } from '@faker-js/faker'; // TODO: Fix ES module import issue
import { Application } from 'express';
import request from 'supertest';
import nock from 'nock';

// Test data generators using simple data for now (TODO: Use Faker when ES module issue is resolved)
export const testDataGenerators = {
  user: (overrides: Partial<any> = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  textCorrectionRequest: (overrides: Partial<any> = {}) => ({
    id: 'test-request-id',
    originalText: 'Original text to be corrected',
    correctedText: 'Corrected text',
    corrections: [],
    status: 'pending',
    userId: 'test-user-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  correction: (overrides: Partial<any> = {}) => ({
    id: 'test-correction-id',
    original: 'original',
    corrected: 'corrected',
    position: {
      start: 0,
      end: 8
    },
    type: 'spelling',
    confidence: 0.95,
    explanation: 'Test correction explanation',
    ...overrides
  }),

  apiKey: (overrides: Partial<any> = {}) => ({
    id: 'test-api-key-id',
    key: 'test-api-key-12345678901234567890',
    name: 'Test API Key',
    userId: 'test-user-id',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    ...overrides
  }),

  usage: (overrides: Partial<any> = {}) => ({
    id: 'test-usage-id',
    userId: 'test-user-id',
    requestCount: 100,
    date: new Date().toISOString(),
    ...overrides
  })
};

// Mock external API responses
export const mockExternalAPIs = {
  openAI: {
    textCorrection: (customResponse?: any) => {
      const mockResponse = customResponse || {
        choices: [{
          message: {
            content: JSON.stringify({
              correctedText: "這是修正後的文字。",
              corrections: [
                {
                  original: "錯字",
                  corrected: "錯誤",
                  position: { start: 0, end: 2 },
                  type: "spelling",
                  confidence: 0.95,
                  explanation: "拼字錯誤修正"
                }
              ]
            })
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80
        }
      };

      return nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, mockResponse);
    },

    error: (status: number = 500, message: string = 'Internal Server Error') => {
      return nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(status, { error: { message } });
    }
  },

  googleDocs: {
    success: (customResponse?: any) => {
      const mockResponse = customResponse || {
        documentId: 'test-doc-id',
        title: 'Test Document Title',
        content: 'Test document content with multiple paragraphs.'
      };

      return nock('https://docs.googleapis.com')
        .get(/\/v1\/documents\/.*/)
        .reply(200, mockResponse);
    },

    error: (status: number = 404, message: string = 'Document not found') => {
      return nock('https://docs.googleapis.com')
        .get(/\/v1\/documents\/.*/)
        .reply(status, { error: { message } });
    }
  }
};

// Database test utilities (when implemented)
export const dbTestUtils = {
  // These will be implemented when database is set up
  cleanDatabase: async () => {
    // Clean all test data from database
    console.log('Database cleaning not implemented yet');
  },

  seedDatabase: async (data: any) => {
    // Seed database with test data
    console.log('Database seeding not implemented yet', data);
  },

  createTestUser: async (userData?: any) => {
    // Create a test user in database
    return testDataGenerators.user(userData);
  }
};

// API test helpers
export const apiTestHelpers = {
  // Helper to make authenticated requests
  authenticatedRequest: (app: Application, token: string) => {
    return request(app).set('Authorization', `Bearer ${token}`);
  },

  // Helper to extract request ID from response
  getRequestId: (response: request.Response): string => {
    return response.headers['x-request-id'] || '';
  },

  // Helper to validate response format
  validateApiResponse: (response: request.Response, expectSuccess: boolean = true) => {
    expect(response.body).toHaveProperty('success', expectSuccess);
    expect(response.body).toHaveProperty('timestamp');
    
    if (expectSuccess) {
      expect(response.body).toHaveProperty('data');
    } else {
      expect(response.body).toHaveProperty('message');
    }
  },

  // Helper to test pagination
  validatePaginationResponse: (response: request.Response) => {
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data.pagination).toHaveProperty('page');
    expect(response.body.data.pagination).toHaveProperty('limit');
    expect(response.body.data.pagination).toHaveProperty('total');
    expect(response.body.data.pagination).toHaveProperty('totalPages');
  }
};

// Performance testing utilities
export const performanceTestUtils = {
  // Measure response time
  measureResponseTime: async (requestFn: () => Promise<any>) => {
    const startTime = Date.now();
    await requestFn();
    return Date.now() - startTime;
  },

  // Test endpoint performance
  testEndpointPerformance: async (
    app: Application, 
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ) => {
    const startTime = Date.now();
    
    let req: request.Test;
    switch (method) {
      case 'GET':
        req = request(app).get(endpoint);
        break;
      case 'POST':
        req = request(app).post(endpoint);
        break;
      case 'PUT':
        req = request(app).put(endpoint);
        break;
      case 'DELETE':
        req = request(app).delete(endpoint);
        break;
      default:
        req = request(app).get(endpoint);
    }

    if (data) {
      req = req.send(data);
    }

    const response = await req;
    const responseTime = Date.now() - startTime;
    
    return {
      response,
      responseTime,
      status: response.status
    };
  }
};

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R;
      toHaveValidApiResponse(): R;
    }
  }
}

// Setup and teardown helpers
export const setupTestEnvironment = () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Clean up nock interceptors
    nock.cleanAll();
  });

  afterEach(async () => {
    // Clean up any test data
    await dbTestUtils.cleanDatabase();
    
    // Ensure all nock interceptors were used
    if (!nock.isDone()) {
      console.warn('Unused nock interceptors:', nock.pendingMocks());
      nock.cleanAll();
    }
  });

  afterAll(() => {
    // Final cleanup
    nock.restore();
  });
};

export default {
  testDataGenerators,
  mockExternalAPIs,
  dbTestUtils,
  apiTestHelpers,
  performanceTestUtils,
  setupTestEnvironment
};