import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

// Environment configuration interface
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REDIS_URL?: string;
  OPENAI_API_KEY: string;
  GOOGLE_APPLICATION_CREDENTIALS?: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
}

// Custom error types
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// JWT User payload
export interface JwtUser extends JwtPayload {
  userId: string;
  email: string;
}

// Extended Express Request with user
export interface AuthRequest extends Request {
  user?: JwtUser;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Text correction types
export interface TextCorrectionRequest {
  text: string;
  language?: 'zh-CN' | 'zh-TW';
  preserveFormatting?: boolean;
  batchSize?: number;
}

export interface TextCorrectionResponse {
  originalText: string;
  correctedText: string;
  corrections: Correction[];
  processingTime: number;
  confidence: number;
}

export interface Correction {
  original: string;
  corrected: string;
  position: {
    start: number;
    end: number;
  };
  type: 'spelling' | 'grammar' | 'punctuation' | 'style';
  confidence: number;
  explanation?: string;
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    openai: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Validation schemas
export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

// Text processing types
export interface TextChunk {
  id: string;
  content: string;
  originalPosition: {
    start: number;
    end: number;
  };
  characterCount: number;
  isLastChunk: boolean;
}

export interface BatchProcessingRequest {
  chunks: TextChunk[];
  batchId: string;
  totalChunks: number;
  options: TextCorrectionRequest;
}

export interface BatchProcessingProgress {
  batchId: string;
  processedChunks: number;
  totalChunks: number;
  completedChunks: TextChunk[];
  failedChunks: Array<{
    chunk: TextChunk;
    error: string;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  estimatedCompletionTime?: Date;
}

export interface TextSplitResult {
  chunks: TextChunk[];
  totalCharacters: number;
  totalChunks: number;
  maxChunkSize: number;
}