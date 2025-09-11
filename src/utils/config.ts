import { config } from 'dotenv';
import Joi from 'joi';
import type { EnvConfig } from '../types/index';

// Load environment variables
config();

// Environment variables validation schema
const envSchema = Joi.object<EnvConfig>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .port()
    .default(process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001),
  
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .optional()
    .default('postgresql://dummy:dummy@localhost:5432/dummy')
    .messages({
      'string.uri': 'DATABASE_URL must be a valid PostgreSQL connection string'
    }),
  
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters long',
      'any.required': 'JWT_SECRET is required'
    }),
  
  JWT_EXPIRES_IN: Joi.string()
    .default('7d')
    .pattern(/^(\d+[smhdw]?)+$/)
    .messages({
      'string.pattern.base': 'JWT_EXPIRES_IN must be a valid time string (e.g., "7d", "24h", "3600s")'
    }),
  
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional()
    .messages({
      'string.uri': 'REDIS_URL must be a valid Redis connection string'
    }),
  
  OPENAI_API_KEY: Joi.string()
    .pattern(/^sk-proj-[a-zA-Z0-9_-]{100,}$|^sk-[a-zA-Z0-9]{32,}$/)
    .required()
    .messages({
      'string.pattern.base': 'OPENAI_API_KEY must be a valid OpenAI API key (sk-... or sk-proj-... format)',
      'any.required': 'OPENAI_API_KEY is required'
    }),
  
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string()
    .optional()
    .description('Path to Google service account JSON file'),
  
  CORS_ORIGIN: Joi.alternatives()
    .try(
      Joi.string().uri(),
      Joi.string().valid('*'),
      Joi.array().items(Joi.string().uri())
    )
    .default('http://localhost:3000')
    .messages({
      'alternatives.match': 'CORS_ORIGIN must be a valid URL, "*", or array of URLs'
    }),
  
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .max(3600000)
    .default(900000) // 15 minutes
    .messages({
      'number.min': 'RATE_LIMIT_WINDOW_MS must be at least 1000ms (1 second)',
      'number.max': 'RATE_LIMIT_WINDOW_MS must be at most 3600000ms (1 hour)'
    }),
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(100)
    .messages({
      'number.min': 'RATE_LIMIT_MAX_REQUESTS must be at least 1',
      'number.max': 'RATE_LIMIT_MAX_REQUESTS must be at most 10000'
    }),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .messages({
      'any.only': 'LOG_LEVEL must be one of: error, warn, info, debug'
    })
}).options({
  stripUnknown: true,
  abortEarly: false
});

// Validate and export configuration
const { error, value: validatedEnv } = envSchema.validate(process.env);

if (error) {
  const errorMessages = error.details.map(detail => {
    return `❌ ${detail.path.join('.')}: ${detail.message}`;
  });
  
  console.error('❌ Environment validation failed:');
  console.error(errorMessages.join('\n'));
  process.exit(1);
}

export const envConfig: EnvConfig = validatedEnv;

// Export individual config values for convenience
export const {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REDIS_URL,
  OPENAI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOG_LEVEL
} = envConfig;

// Configuration validation utility
export const validateConfig = (): void => {
  console.log('✅ Configuration validated successfully');
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`📊 Log Level: ${LOG_LEVEL}`);
  console.log(`🔒 CORS Origin: ${CORS_ORIGIN}`);
  console.log(`⏱️  Rate Limit: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS}ms`);
  
  // Sensitive information check
  const sensitiveVars = ['JWT_SECRET', 'OPENAI_API_KEY', 'DATABASE_URL'];
  const missingVars = sensitiveVars.filter(varName => 
    !process.env[varName] || process.env[varName]!.length < 10
  );
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Warning: Some sensitive variables may be missing or too short:');
    console.warn(`   ${missingVars.join(', ')}`);
  }
};