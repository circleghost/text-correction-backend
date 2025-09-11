import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Ensure we're in test environment
process.env['NODE_ENV'] = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  info: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(10000);

// Mock external services for testing
jest.mock('@utils/config', () => ({
  ...jest.requireActual('@utils/config'),
  NODE_ENV: 'test'
}));