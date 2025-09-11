import express from 'express';
import { googleDocsController } from '../controllers/googleDocsController';
import { generalLimiter, createCustomRateLimiter } from '../middleware/rateLimiter';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types';

const router = express.Router();

// Custom rate limiter for Google Docs operations (stricter limits)
const googleDocsLimiter = createCustomRateLimiter(
  60 * 1000, // 1 minute
  20, // 20 requests per minute
  'Too many Google Docs requests. Please wait before trying again.'
);

// Validation middleware
const validateImportRequest = [
  body('url')
    .isString()
    .notEmpty()
    .withMessage('URL is required')
    .isURL()
    .withMessage('Must be a valid URL')
    .contains('docs.google.com/document')
    .withMessage('Must be a Google Docs URL')
    .isLength({ max: 2048 })
    .withMessage('URL is too long'),
];

const validateUrlRequest = [
  body('url')
    .isString()
    .notEmpty()
    .withMessage('URL is required')
    .isLength({ max: 2048 })
    .withMessage('URL is too long'),
];

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      error: JSON.stringify(errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg
      }))),
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  next();
};

/**
 * @swagger
 * /api/v1/google-docs/import:
 *   post:
 *     summary: Import document content from Google Docs URL
 *     description: Extracts text content from a Google Docs document using its sharing URL
 *     tags: [Google Docs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Google Docs sharing URL
 *                 example: "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
 *     responses:
 *       200:
 *         description: Document imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document imported successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Document title
 *                     content:
 *                       type: string
 *                       description: Extracted text content
 *                     documentId:
 *                       type: string
 *                       description: Google Docs document ID
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         lastModified:
 *                           type: string
 *                           format: date-time
 *                         wordCount:
 *                           type: integer
 *                         processingTime:
 *                           type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request or URL format
 *       403:
 *         description: Permission denied - document not accessible
 *       404:
 *         description: Document not found
 *       429:
 *         description: Too many requests
 *       503:
 *         description: Google Docs service unavailable
 */
router.post('/import', 
  generalLimiter,
  googleDocsLimiter,
  validateImportRequest,
  handleValidationErrors,
  googleDocsController.importDocument
);

/**
 * @swagger
 * /api/v1/google-docs/validate:
 *   post:
 *     summary: Validate Google Docs URL format
 *     description: Checks if the provided URL is a valid Google Docs URL without importing content
 *     tags: [Google Docs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL to validate
 *     responses:
 *       200:
 *         description: URL validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                     error:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Invalid request
 */
router.post('/validate',
  generalLimiter,
  validateUrlRequest,
  handleValidationErrors,
  googleDocsController.validateUrl
);

/**
 * @swagger
 * /api/v1/google-docs/status:
 *   get:
 *     summary: Get Google Docs service status
 *     description: Returns the current status and availability of the Google Docs integration
 *     tags: [Google Docs]
 *     responses:
 *       200:
 *         description: Service status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     message:
 *                       type: string
 *                     details:
 *                       type: object
 */
router.get('/status',
  generalLimiter,
  googleDocsController.getServiceStatus
);

export { router as googleDocsRoutes };