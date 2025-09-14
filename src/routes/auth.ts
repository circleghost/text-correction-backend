import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           description: User ID
 *                         email:
 *                           type: string
 *                           description: User email
 *                         name:
 *                           type: string
 *                           description: User display name
 *                         avatar:
 *                           type: string
 *                           description: User avatar URL
 *                         provider:
 *                           type: string
 *                           description: OAuth provider
 *                         createdAt:
 *                           type: string
 *                           description: Account creation date
 *                         lastSignIn:
 *                           type: string
 *                           description: Last sign-in date
 *                         emailConfirmed:
 *                           type: boolean
 *                           description: Whether email is confirmed
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/me', (req, res) => {
  authController.getCurrentUser(req, res);
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh JWT access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     access_token:
 *                       type: string
 *                       description: New access token
 *                     refresh_token:
 *                       type: string
 *                       description: New refresh token
 *                     expires_in:
 *                       type: number
 *                       description: Token expiration time in seconds
 *                     token_type:
 *                       type: string
 *                       example: Bearer
 *       400:
 *         description: Bad request - Missing refresh token
 *       401:
 *         description: Unauthorized - Invalid refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', (req, res) => {
  authController.refreshToken(req, res);
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Server-side logout cleanup
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                     message:
 *                       type: string
 *                       example: Logged out successfully
 *       500:
 *         description: Internal server error
 */
router.post('/logout', (req, res) => {
  authController.logout(req, res);
});

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

export default router;