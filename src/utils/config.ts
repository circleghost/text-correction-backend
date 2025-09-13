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
    .pattern(/^sk-proj-[a-zA-Z0-9_-]{50,}$|^sk-[a-zA-Z0-9]{32,}$/)
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
      Joi.array().items(Joi.string().uri()),
      Joi.string().custom((value, helpers) => {
        // Support comma-separated URLs
        if (value.includes(',')) {
          const origins = value.split(',').map((origin: string) => origin.trim());
          for (const origin of origins) {
            try {
              new URL(origin);
            } catch {
              return helpers.error('cors.invalidUrl', { origin });
            }
          }
        }
        return value;
      })
    )
    .default('http://localhost:3000')
    .messages({
      'alternatives.match': 'CORS_ORIGIN must be a valid URL, "*", comma-separated URLs, or array of URLs',
      'cors.invalidUrl': 'Invalid URL in CORS_ORIGIN: {{#origin}}'
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
  
  // Google Docs API credentials (optional)
  GOOGLE_CREDENTIALS_JSON: Joi.string()
    .optional()
    .custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.type || !parsed.client_email || !parsed.private_key) {
          return helpers.error('google.invalid');
        }
        return value;
      } catch {
        return helpers.error('google.invalid');
      }
    })
    .messages({
      'google.invalid': 'GOOGLE_CREDENTIALS_JSON must be a valid Google Service Account JSON'
    }),

  GOOGLE_CLIENT_EMAIL: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'GOOGLE_CLIENT_EMAIL must be a valid email address'
    }),

  GOOGLE_PRIVATE_KEY: Joi.string()
    .optional()
    .pattern(/-----BEGIN PRIVATE KEY-----/)
    .messages({
      'string.pattern.base': 'GOOGLE_PRIVATE_KEY must be a valid private key starting with "-----BEGIN PRIVATE KEY-----"'
    }),

  GOOGLE_PROJECT_ID: Joi.string()
    .optional()
    .alphanum()
    .messages({
      'string.alphanum': 'GOOGLE_PROJECT_ID must contain only alphanumeric characters'
    }),

  GOOGLE_CLIENT_ID: Joi.string()
    .optional()
    .pattern(/^[0-9]+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com$/)
    .messages({
      'string.pattern.base': 'GOOGLE_CLIENT_ID must be a valid Google OAuth client ID'
    }),

  GOOGLE_CLIENT_SECRET: Joi.string()
    .optional()
    .min(24)
    .messages({
      'string.min': 'GOOGLE_CLIENT_SECRET must be at least 24 characters long'
    }),

  SUPABASE_URL: Joi.string()
    .optional()
    .uri({ scheme: ['https'] })
    .pattern(/^https:\/\/[a-z0-9]+\.supabase\.co$/)
    .messages({
      'string.uri': 'SUPABASE_URL must be a valid HTTPS URL',
      'string.pattern.base': 'SUPABASE_URL must be a valid Supabase project URL'
    }),

  SUPABASE_ANON_KEY: Joi.string()
    .optional()
    .pattern(/^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/)
    .messages({
      'string.pattern.base': 'SUPABASE_ANON_KEY must be a valid JWT token'
    }),

  SUPABASE_SERVICE_ROLE_KEY: Joi.string()
    .optional()
    .pattern(/^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/)
    .messages({
      'string.pattern.base': 'SUPABASE_SERVICE_ROLE_KEY must be a valid JWT token'
    }),

  // 新 Supabase API 金鑰系統
  SUPABASE_PUBLISHABLE_KEY: Joi.string()
    .optional()
    .pattern(/^sb_publishable_[A-Za-z0-9_-]+$/)
    .messages({
      'string.pattern.base': 'SUPABASE_PUBLISHABLE_KEY must be a valid publishable key starting with sb_publishable_'
    }),

  SUPABASE_SECRET_KEY: Joi.string()
    .optional()
    .pattern(/^sb_secret_[A-Za-z0-9_-]+$/)
    .messages({
      'string.pattern.base': 'SUPABASE_SECRET_KEY must be a valid secret key starting with sb_secret_'
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
  GOOGLE_CREDENTIALS_JSON,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_PROJECT_ID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY,
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