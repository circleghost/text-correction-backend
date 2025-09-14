import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/apiAuth';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_SECRET_KEY']!;

const supabase = createClient(supabaseUrl, supabaseKey);

export class UserController {
  
  /**
   * Get user profile information
   */
  async getUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const token = authHeader.replace('Bearer ', '');

      // Skip API keys, only handle JWT tokens
      if (token.startsWith('sk-')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'This endpoint requires JWT authentication',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get user from JWT token
      const { data: userData, error } = await supabase.auth.getUser(token);

      if (error || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const user = userData.user;

      // TODO: Get usage statistics from usage tracking system
      // For now, return mock data
      const usageStats = {
        currentMonth: {
          tokensUsed: 1250,
          totalRequests: 45,
          totalCorrections: 123
        },
        quota: {
          monthlyTokenLimit: 10000,
          remaining: 8750
        },
        lastActivity: new Date().toISOString()
      };

      res.json({
        success: true,
        data: {
          profile: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || 'User',
            avatar: user.user_metadata?.['avatar_url'] || user.user_metadata?.['picture'],
            provider: user.app_metadata?.provider || 'google',
            createdAt: user.created_at,
            lastSignIn: user.last_sign_in_at,
            emailConfirmed: user.email_confirmed_at !== null,
            preferences: {
              language: 'zh-TW',
              correctionLevel: 'standard',
              notifications: true
            }
          },
          usage: usageStats
        }
      });

      logger.info('User profile retrieved', {
        userId: user.id,
        email: user.email
      });

    } catch (error) {
      logger.error('Failed to get user profile', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: 'Failed to retrieve user profile',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const token = authHeader.replace('Bearer ', '');

      // Skip API keys, only handle JWT tokens
      if (token.startsWith('sk-')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'This endpoint requires JWT authentication',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get user from JWT token
      const { data: userData, error } = await supabase.auth.getUser(token);

      if (error || !userData.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { name, preferences } = req.body;
      const updates: any = {};

      // Validate and prepare updates
      if (name && typeof name === 'string' && name.trim().length > 0) {
        updates.data = {
          full_name: name.trim()
        };
      }

      // Validate preferences
      if (preferences && typeof preferences === 'object') {
        const { language, correctionLevel, notifications } = preferences;
        
        const validLanguages = ['zh-TW', 'zh-CN', 'en-US'];
        const validCorrectionLevels = ['basic', 'standard', 'advanced'];

        if (language && !validLanguages.includes(language)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_LANGUAGE',
              message: 'Invalid language preference',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        if (correctionLevel && !validCorrectionLevels.includes(correctionLevel)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CORRECTION_LEVEL',
              message: 'Invalid correction level preference',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Store preferences in user metadata
        if (!updates.data) updates.data = {};
        updates.data.preferences = {
          language: language || 'zh-TW',
          correctionLevel: correctionLevel || 'standard',
          notifications: notifications !== undefined ? Boolean(notifications) : true
        };
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No valid updates provided',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Update user metadata in Supabase
      const { data: updatedUser, error: updateError } = await supabase.auth.updateUser(updates);

      if (updateError) {
        logger.error('Failed to update user profile', {
          error: updateError.message,
          userId: userData.user.id
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update profile',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          profile: {
            id: updatedUser.user.id,
            email: updatedUser.user.email,
            name: updatedUser.user.user_metadata?.['full_name'] || updatedUser.user.user_metadata?.['name'] || 'User',
            avatar: updatedUser.user.user_metadata?.['avatar_url'] || updatedUser.user.user_metadata?.['picture'],
            preferences: updatedUser.user.user_metadata?.['preferences'] || {
              language: 'zh-TW',
              correctionLevel: 'standard',
              notifications: true
            }
          }
        }
      });

      logger.info('User profile updated successfully', {
        userId: updatedUser.user.id,
        updates: Object.keys(updates)
      });

    } catch (error) {
      logger.error('Profile update error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update profile',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const userController = new UserController();