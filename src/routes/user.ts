import { Router } from 'express';
import { userController } from '../controllers/userController';

const router = Router();

/**
 * @swagger
 * /api/v1/user/profile:
 *   get:
 *     summary: Get user profile information
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                     profile:
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
 *                         preferences:
 *                           type: object
 *                           properties:
 *                             language:
 *                               type: string
 *                               example: zh-TW
 *                             correctionLevel:
 *                               type: string
 *                               example: standard
 *                             notifications:
 *                               type: boolean
 *                               example: true
 *                     usage:
 *                       type: object
 *                       properties:
 *                         currentMonth:
 *                           type: object
 *                           properties:
 *                             tokensUsed:
 *                               type: number
 *                             totalRequests:
 *                               type: number
 *                             totalCorrections:
 *                               type: number
 *                         quota:
 *                           type: object
 *                           properties:
 *                             monthlyTokenLimit:
 *                               type: number
 *                             remaining:
 *                               type: number
 *                         lastActivity:
 *                           type: string
 *                           description: Last activity timestamp
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/profile', (req, res) => {
  userController.getUserProfile(req, res);
});

/**
 * @swagger
 * /api/v1/user/profile:
 *   put:
 *     summary: Update user profile information
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User display name
 *                 example: John Doe
 *               preferences:
 *                 type: object
 *                 properties:
 *                   language:
 *                     type: string
 *                     enum: [zh-TW, zh-CN, en-US]
 *                     example: zh-TW
 *                   correctionLevel:
 *                     type: string
 *                     enum: [basic, standard, advanced]
 *                     example: standard
 *                   notifications:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                     profile:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         avatar:
 *                           type: string
 *                         preferences:
 *                           type: object
 *                           properties:
 *                             language:
 *                               type: string
 *                             correctionLevel:
 *                               type: string
 *                             notifications:
 *                               type: boolean
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.put('/profile', (req, res) => {
  userController.updateUserProfile(req, res);
});

export default router;