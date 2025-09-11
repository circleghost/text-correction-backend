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

export default router;