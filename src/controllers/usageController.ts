import { Response, NextFunction } from 'express';
import { usageTrackingService } from '../services/usageTrackingService';
import { quotaManagementService, QuotaType, UserTier } from '../services/quotaManagementService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../types/index';

export class UsageController {
  /**
   * Get current user's usage statistics
   */
  async getCurrentUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const period = req.query['period'] as 'day' | 'week' | 'month' | 'all' || 'month';
      const usage = await usageTrackingService.getUserUsage(userId, period);

      logger.info('Usage statistics retrieved:', {
        userId,
        period,
        totalRequests: usage.totalRequests
      });

      res.json({
        success: true,
        data: usage
      });

    } catch (error) {
      logger.error('Error getting current usage:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Get user's usage history with pagination
   */
  async getUsageHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const limit = parseInt(req.query['limit'] as string) || 50;
      const offset = parseInt(req.query['offset'] as string) || 0;
      const actionType = req.query['actionType'] as string;
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query['startDate']) {
        startDate = new Date(req.query['startDate'] as string);
      }
      if (req.query['endDate']) {
        endDate = new Date(req.query['endDate'] as string);
      }

      const history = await usageTrackingService.getUserUsageHistory(userId, {
        limit,
        offset,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(actionType && { actionType })
      });

      res.json({
        success: true,
        data: history.data,
        pagination: {
          total: history.total,
          limit,
          offset,
          hasMore: offset + limit < history.total
        }
      });

    } catch (error) {
      logger.error('Error getting usage history:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Get user's quota status
   */
  async getQuotaStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const quotaStatuses = await quotaManagementService.getUserQuotaStatus(userId);

      logger.info('Quota status retrieved:', {
        userId,
        quotaCount: quotaStatuses.length
      });

      res.json({
        success: true,
        data: quotaStatuses
      });

    } catch (error) {
      logger.error('Error getting quota status:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Check quota availability for specific action
   */
  async checkQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { quotaType, amount = 1 } = req.body;

      const checkResult = await quotaManagementService.checkQuotaAvailability(
        userId,
        quotaType as QuotaType,
        amount
      );

      res.json({
        success: true,
        data: checkResult
      });

    } catch (error) {
      logger.error('Error checking quota:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const period = req.query['period'] as 'day' | 'week' | 'month' || 'month';
      const groupBy = req.query['groupBy'] as 'day' | 'week' | 'month' || 'day';

      const trends = await usageTrackingService.getUsageTrends(userId, period, groupBy);

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      logger.error('Error getting usage trends:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Admin endpoint: Get system-wide usage statistics
   */
  async getSystemUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if user has admin privileges
      const userTier = (req.user as any)?.tier;
      if (userTier !== 'admin') {
        res.status(403).json({ 
          error: 'Access denied. Admin privileges required.' 
        });
        return;
      }

      const period = req.query['period'] as 'day' | 'week' | 'month' || 'month';
      const systemUsage = await usageTrackingService.getSystemUsage(period);

      logger.info('System usage statistics retrieved:', {
        adminUserId: req.user?.id,
        period,
        totalUsers: systemUsage.totalUsers
      });

      res.json({
        success: true,
        data: systemUsage
      });

    } catch (error) {
      logger.error('Error getting system usage:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminUserId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Admin endpoint: Update user quota
   */
  async updateUserQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      // Check if user has admin privileges
      const userTier = (req.user as any)?.tier;
      if (userTier !== 'admin') {
        res.status(403).json({ 
          error: 'Access denied. Admin privileges required.' 
        });
        return;
      }

      const { userId, quotaType, newLimit } = req.body;

      await quotaManagementService.updateUserQuota(userId, quotaType as QuotaType, newLimit);

      logger.info('User quota updated by admin:', {
        adminUserId: req.user?.id,
        targetUserId: userId,
        quotaType,
        newLimit
      });

      res.json({
        success: true,
        message: 'User quota updated successfully'
      });

    } catch (error) {
      logger.error('Error updating user quota:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminUserId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Admin endpoint: Upgrade user tier
   */
  async upgradeUserTier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      // Check if user has admin privileges
      const userTier = (req.user as any)?.tier;
      if (userTier !== 'admin') {
        res.status(403).json({ 
          error: 'Access denied. Admin privileges required.' 
        });
        return;
      }

      const { userId, newTier } = req.body;

      await quotaManagementService.upgradeUserTier(userId, newTier as UserTier);

      logger.info('User tier upgraded by admin:', {
        adminUserId: req.user?.id,
        targetUserId: userId,
        newTier
      });

      res.json({
        success: true,
        message: 'User tier upgraded successfully'
      });

    } catch (error) {
      logger.error('Error upgrading user tier:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminUserId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Track usage event (internal endpoint used by other services)
   */
  async trackUsageEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const {
        actionType,
        textLength = 0,
        tokensUsed,
        metadata = {},
        quotaConsumed = 1
      } = req.body;

      await usageTrackingService.trackUsage({
        userId,
        actionType,
        textLength,
        tokensUsed,
        metadata: {
          ...metadata,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        },
        quotaConsumed
      });

      res.json({
        success: true,
        message: 'Usage event tracked successfully'
      });

    } catch (error) {
      logger.error('Error tracking usage event:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      next(error);
    }
  }
}

export const usageController = new UsageController();