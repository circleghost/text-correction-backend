import { Router } from 'express';
import healthController from '@controllers/healthController';
import { healthCheckLimiter } from '@middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns a simple health status indicating if the service is running
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     uptime:
 *                       type: number
 *                       example: 3600.45
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', healthCheckLimiter, healthController.health);

/**
 * @swagger
 * /ready:
 *   get:
 *     summary: Readiness check
 *     description: Comprehensive health check including all service dependencies
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is ready and all dependencies are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/HealthCheckResult'
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Service is unhealthy - one or more dependencies are down
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   $ref: '#/components/schemas/HealthCheckResult'
 *                 message:
 *                   type: string
 *                   example: Service is unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/ready', healthCheckLimiter, healthController.ready);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Comprehensive health check with system metrics and detailed service information
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Detailed health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       example: 3600.45
 *                     services:
 *                       type: object
 *                       additionalProperties:
 *                         $ref: '#/components/schemas/ServiceStatus'
 *                     system:
 *                       type: object
 *                       properties:
 *                         memory:
 *                           type: object
 *                         cpu:
 *                           type: object
 *                         process:
 *                           type: object
 *                     responseTime:
 *                       type: string
 *                       example: "45ms"
 *                 message:
 *                   type: string
 *                   example: Detailed health check completed
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/detailed', healthCheckLimiter, healthController.detailed);

/**
 * @swagger
 * /health/openai:
 *   get:
 *     summary: OpenAI API health check
 *     description: Test OpenAI API connectivity and response
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: OpenAI API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     model:
 *                       type: string
 *                       example: gpt-4.1-nano
 *                     responseTime:
 *                       type: string
 *                       example: "1200ms"
 *                     testResult:
 *                       type: string
 *                       example: "API connection successful"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: OpenAI API is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: OpenAI API is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "OPENAI_API_ERROR"
 *                     message:
 *                       type: string
 *                       example: "OpenAI API connection failed"
 *                     details:
 *                       type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/openai', healthCheckLimiter, healthController.openaiHealth);

export default router;