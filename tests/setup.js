"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
// Load test environment variables
(0, dotenv_1.config)({ path: '.env.test' });
// Ensure we're in test environment
process.env.NODE_ENV = 'test';
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
//# sourceMappingURL=setup.js.map