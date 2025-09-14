import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/apiAuth';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_SECRET_KEY']!;

const supabase = createClient(supabaseUrl, supabaseKey);

export class AuthController {
  
  /**
   * Get current authenticated user information
   */
  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'No authentication token provided',
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
            message: 'This endpoint requires JWT authentication, not API key',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify the JWT token with Supabase
      const { data: userData, error } = await supabase.auth.getUser(token);

      if (error || !userData.user) {
        logger.warn('Invalid JWT token provided', {
          error: error?.message,
          ip: req.ip,
          endpoint: req.path
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const user = userData.user;

      // Return user information
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || 'User',
            avatar: user.user_metadata?.['avatar_url'] || user.user_metadata?.['picture'],
            provider: user.app_metadata?.provider || 'google',
            createdAt: user.created_at,
            lastSignIn: user.last_sign_in_at,
            emailConfirmed: user.email_confirmed_at !== null
          }
        }
      });

      logger.info('User information retrieved successfully', {
        userId: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      });

    } catch (error) {
      logger.error('Failed to get current user', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        endpoint: req.path
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Failed to retrieve user information',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Use Supabase to refresh the token
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token
      });

      if (error || !data.session) {
        logger.warn('Token refresh failed', {
          error: error?.message,
          ip: req.ip
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: 'Invalid or expired refresh token',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: 'Bearer'
        }
      });

      logger.info('Token refreshed successfully', {
        userId: data.session.user.id,
        ip: req.ip
      });

    } catch (error) {
      logger.error('Token refresh error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Failed to refresh token',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Server-side logout cleanup
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        
        // Only process JWT tokens, not API keys
        if (!token.startsWith('sk-')) {
          try {
            // Sign out the user from Supabase (this invalidates the JWT)
            await supabase.auth.signOut();
            
            logger.info('User logged out successfully', {
              ip: req.ip,
              endpoint: req.path
            });
          } catch (error) {
            logger.warn('Supabase signout warning', {
              error: error instanceof Error ? error.message : 'Unknown error',
              ip: req.ip
            });
            // Continue with response even if Supabase signout has issues
          }
        }
      }

      res.json({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      });

    } catch (error) {
      logger.error('Logout error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Failed to logout',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const authController = new AuthController();