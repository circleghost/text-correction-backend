import swaggerJSDoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';
import { PORT, NODE_ENV } from '@utils/config';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI-Powered Chinese Text Correction API',
    version: '1.0.0',
    description: `
      A comprehensive API for AI-powered Chinese text correction and processing.
      This service provides intelligent text analysis, error detection, and correction suggestions
      using advanced language models optimized for Chinese text.
      
      ## Features
      - Real-time text correction with AI-powered suggestions
      - Paragraph-based processing for large documents
      - Google Docs integration for seamless document handling
      - Character-level difference detection and visualization
      - Export functionality for multiple formats
      
      ## Authentication
      Most endpoints require authentication via JWT tokens.
      Include the token in the Authorization header: \`Bearer <token>\`
    `,
    contact: {
      name: 'Text Correction API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: NODE_ENV === 'production' 
        ? 'https://api.textcorrection.example.com' 
        : `http://localhost:${PORT}`,
      description: NODE_ENV === 'production' ? 'Production server' : 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication'
      }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the request was successful'
          },
          data: {
            type: 'object',
            description: 'Response data (varies by endpoint)'
          },
          message: {
            type: 'string',
            description: 'Human-readable response message'
          },
          error: {
            type: 'string',
            description: 'Error message (only present on failure)'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Response timestamp in ISO format'
          },
          requestId: {
            type: 'string',
            description: 'Unique request identifier for tracking'
          }
        }
      },
      HealthCheckResult: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded'],
            description: 'Overall service health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          },
          uptime: {
            type: 'number',
            description: 'Service uptime in seconds'
          },
          services: {
            type: 'object',
            additionalProperties: {
              $ref: '#/components/schemas/ServiceStatus'
            },
            description: 'Status of individual service dependencies'
          }
        }
      },
      ServiceStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['up', 'down', 'degraded'],
            description: 'Service status'
          },
          responseTime: {
            type: 'number',
            description: 'Response time in milliseconds'
          },
          error: {
            type: 'string',
            description: 'Error message if service is down'
          },
          lastCheck: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp of last health check'
          }
        }
      },
      TextCorrectionRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            description: 'Text to be corrected',
            example: '我今天去了學校，但是我忘記帶書包了。'
          },
          language: {
            type: 'string',
            enum: ['zh-CN', 'zh-TW'],
            default: 'zh-CN',
            description: 'Target Chinese variant'
          },
          preserveFormatting: {
            type: 'boolean',
            default: true,
            description: 'Whether to preserve original formatting'
          },
          batchSize: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Number of paragraphs to process in each batch'
          }
        }
      },
      TextCorrectionResponse: {
        type: 'object',
        properties: {
          originalText: {
            type: 'string',
            description: 'Original input text'
          },
          correctedText: {
            type: 'string',
            description: 'AI-corrected text'
          },
          corrections: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Correction'
            },
            description: 'List of individual corrections made'
          },
          processingTime: {
            type: 'number',
            description: 'Processing time in milliseconds'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Overall confidence score of corrections'
          }
        }
      },
      Correction: {
        type: 'object',
        properties: {
          original: {
            type: 'string',
            description: 'Original text segment'
          },
          corrected: {
            type: 'string',
            description: 'Corrected text segment'
          },
          position: {
            type: 'object',
            properties: {
              start: {
                type: 'number',
                description: 'Start position in original text'
              },
              end: {
                type: 'number',
                description: 'End position in original text'
              }
            }
          },
          type: {
            type: 'string',
            enum: ['spelling', 'grammar', 'punctuation', 'style'],
            description: 'Type of correction made'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score for this correction'
          },
          explanation: {
            type: 'string',
            description: 'Optional explanation of the correction'
          }
        }
      },
      ValidationError: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Field that failed validation'
          },
          message: {
            type: 'string',
            description: 'Validation error message'
          },
          value: {
            description: 'Value that failed validation'
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check and monitoring endpoints'
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Text Correction',
      description: 'AI-powered text correction and processing'
    },
    {
      name: 'Documents',
      description: 'Google Docs integration and document processing'
    },
    {
      name: 'Export',
      description: 'Export functionality for processed text'
    }
  ]
};

// Options for the swagger docs
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

// Initialize swagger-jsdoc
export const swaggerSpec = swaggerJSDoc(options);

// Swagger UI options
export const swaggerUiOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
  `,
  customSiteTitle: 'Text Correction API Documentation',
  customfavIcon: '/favicon.ico',
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'nord'
    }
  }
};