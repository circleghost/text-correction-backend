import express from 'express';
import { body, query } from 'express-validator';
import { usageController } from '../controllers/usageController';
import { authenticateToken } from '../middleware/supabase-auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     UsageStats:
 *       type: object
 *       properties:
 *         totalRequests:
 *           type: integer
 *           description: Total number of requests
 *         totalCharacters:
 *           type: integer
 *           description: Total characters processed
 *         totalTokens:
 *           type: integer
 *           description: Total tokens consumed
 *         monthlyRequests:
 *           type: integer
 *           description: Requests in current month
 *         monthlyCharacters:
 *           type: integer
 *           description: Characters processed in current month
 *         dailyRequests:
 *           type: integer
 *           description: Requests today
 *         dailyCharacters:
 *           type: integer
 *           description: Characters processed today
 *         averageProcessingTime:
 *           type: number
 *           description: Average processing time in milliseconds
 *         totalErrors:
 *           type: integer
 *           description: Total number of errors
 *         lastActivity:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 *     
 *     QuotaStatus:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [monthly_corrections, monthly_characters, monthly_requests, daily_requests]
 *         limit:
 *           type: integer
 *           description: Quota limit
 *         used:
 *           type: integer
 *           description: Quota used
 *         remaining:
 *           type: integer
 *           description: Remaining quota
 *         resetDate:
 *           type: string
 *           format: date-time
 *           description: Next reset date
 *         tier:
 *           type: string
 *           enum: [free, premium, enterprise, admin]
 *         percentageUsed:
 *           type: number
 *           description: Percentage of quota used
 *         isExceeded:
 *           type: boolean
 *           description: Whether quota is exceeded
 * 
 *     UsageHistoryEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Entry ID
 *         actionType:
 *           type: string
 *           enum: [correction_request, text_processed, api_call]
 *         textLength:
 *           type: integer
 *           description: Length of processed text
 *         tokensUsed:
 *           type: integer
 *           description: Tokens consumed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp
 *         processingTimeMs:
 *           type: number
 *           description: Processing time in milliseconds
 *         errorCode:
 *           type: string
 *           description: Error code if any
 *         featureUsed:
 *           type: string
 *           description: Feature used
 *         metadata:
 *           type: object
 *           description: Additional metadata
 */

/**
 * @swagger
 * /api/usage/current:
 *   get:
 *     summary: Get current user's usage statistics
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, all]
 *           default: month
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UsageStats'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/current',
  query('period').optional().isIn(['day', 'week', 'month', 'all']),
  usageController.getCurrentUsage.bind(usageController)
);

/**
 * @swagger
 * /api/usage/history:
 *   get:
 *     summary: Get user's usage history with pagination
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of records to skip
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this date
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *           enum: [correction_request, text_processed, api_call]
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: Usage history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UsageHistoryEntry'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get('/history',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('actionType').optional().isIn(['correction_request', 'text_processed', 'api_call']),
  usageController.getUsageHistory.bind(usageController)
);

/**
 * @swagger
 * /api/usage/trends:
 *   get:
 *     summary: Get usage trends over time
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: month
 *         description: Time period to analyze
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: How to group the data
 *     responses:
 *       200:
 *         description: Usage trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                       totalRequests:
 *                         type: integer
 *                       totalCharacters:
 *                         type: integer
 *                       totalTokens:
 *                         type: integer
 *                       averageProcessingTime:
 *                         type: number
 *                       errorCount:
 *                         type: integer
 */
router.get('/trends',
  query('period').optional().isIn(['day', 'week', 'month']),
  query('groupBy').optional().isIn(['day', 'week', 'month']),
  usageController.getUsageTrends.bind(usageController)
);

/**
 * @swagger
 * /api/usage/track:
 *   post:
 *     summary: Track a usage event
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionType
 *             properties:
 *               actionType:
 *                 type: string
 *                 enum: [correction_request, text_processed, api_call]
 *               textLength:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               tokensUsed:
 *                 type: integer
 *                 minimum: 0
 *               metadata:
 *                 type: object
 *               quotaConsumed:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *     responses:
 *       200:
 *         description: Usage event tracked successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/track',
  body('actionType').isIn(['correction_request', 'text_processed', 'api_call']),
  body('textLength').optional().isInt({ min: 0 }),
  body('tokensUsed').optional().isInt({ min: 0 }),
  body('quotaConsumed').optional().isInt({ min: 1 }),
  body('metadata').optional().isObject(),
  usageController.trackUsageEvent.bind(usageController)
);

// Quota management routes
/**
 * @swagger
 * /api/usage/quota/status:
 *   get:
 *     summary: Get user's quota status
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quota status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QuotaStatus'
 */
router.get('/quota/status',
  usageController.getQuotaStatus.bind(usageController)
);

/**
 * @swagger
 * /api/usage/quota/check:
 *   post:
 *     summary: Check quota availability for specific action
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quotaType
 *             properties:
 *               quotaType:
 *                 type: string
 *                 enum: [monthly_corrections, monthly_characters, monthly_requests, daily_requests]
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *     responses:
 *       200:
 *         description: Quota check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     allowed:
 *                       type: boolean
 *                     quotaStatus:
 *                       $ref: '#/components/schemas/QuotaStatus'
 *                     reason:
 *                       type: string
 */
router.post('/quota/check',
  body('quotaType').isIn(['monthly_corrections', 'monthly_characters', 'monthly_requests', 'daily_requests']),
  body('amount').optional().isInt({ min: 1 }),
  usageController.checkQuota.bind(usageController)
);

// Admin only routes
/**
 * @swagger
 * /api/usage/admin/system:
 *   get:
 *     summary: Get system-wide usage statistics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: month
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: System usage statistics retrieved successfully
 *       403:
 *         description: Access denied. Admin privileges required.
 */
router.get('/admin/system',
  query('period').optional().isIn(['day', 'week', 'month']),
  usageController.getSystemUsage.bind(usageController)
);

/**
 * @swagger
 * /api/usage/admin/quota/update:
 *   post:
 *     summary: Update user quota (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - quotaType
 *               - newLimit
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Target user ID
 *               quotaType:
 *                 type: string
 *                 enum: [monthly_corrections, monthly_characters, monthly_requests, daily_requests]
 *               newLimit:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: User quota updated successfully
 *       403:
 *         description: Access denied. Admin privileges required.
 */
router.post('/admin/quota/update',
  body('userId').isUUID(),
  body('quotaType').isIn(['monthly_corrections', 'monthly_characters', 'monthly_requests', 'daily_requests']),
  body('newLimit').isInt({ min: 0 }),
  usageController.updateUserQuota.bind(usageController)
);

/**
 * @swagger
 * /api/usage/admin/tier/upgrade:
 *   post:
 *     summary: Upgrade user tier (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - newTier
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Target user ID
 *               newTier:
 *                 type: string
 *                 enum: [free, premium, enterprise, admin]
 *     responses:
 *       200:
 *         description: User tier upgraded successfully
 *       403:
 *         description: Access denied. Admin privileges required.
 */
router.post('/admin/tier/upgrade',
  body('userId').isUUID(),
  body('newTier').isIn(['free', 'premium', 'enterprise', 'admin']),
  usageController.upgradeUserTier.bind(usageController)
);

export default router;