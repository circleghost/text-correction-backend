import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export type QuotaType = 'monthly_corrections' | 'monthly_characters' | 'monthly_requests' | 'daily_requests';
export type UserTier = 'free' | 'premium' | 'enterprise' | 'admin';

interface UserQuota {
  id: string;
  userId: string;
  quotaType: QuotaType;
  quotaLimit: number;
  quotaUsed: number;
  quotaResetDate: Date;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
}

interface QuotaStatus {
  type: QuotaType;
  limit: number;
  used: number;
  remaining: number;
  resetDate: Date;
  tier: UserTier;
  percentageUsed: number;
  isExceeded: boolean;
}

interface QuotaCheckResult {
  allowed: boolean;
  quotaStatus?: QuotaStatus;
  reason?: string;
}

interface DefaultQuotaLimits {
  [key in UserTier]: {
    [key in QuotaType]: number;
  };
}

export class QuotaManagementService {
  private supabase: SupabaseClient;
  
  // Default quota limits by tier
  private readonly defaultLimits: DefaultQuotaLimits = {
    free: {
      monthly_corrections: 50,
      monthly_characters: 10000,
      monthly_requests: 100,
      daily_requests: 10
    },
    premium: {
      monthly_corrections: 500,
      monthly_characters: 100000,
      monthly_requests: 1000,
      daily_requests: 100
    },
    enterprise: {
      monthly_corrections: 5000,
      monthly_characters: 1000000,
      monthly_requests: 10000,
      daily_requests: 1000
    },
    admin: {
      monthly_corrections: 999999,
      monthly_characters: 99999999,
      monthly_requests: 999999,
      daily_requests: 99999
    }
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for quota management');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Initialize default quotas for a new user
   */
  async initializeUserQuotas(userId: string, tier: UserTier = 'free'): Promise<void> {
    try {
      const quotaTypes: QuotaType[] = ['monthly_corrections', 'monthly_characters', 'monthly_requests', 'daily_requests'];
      const now = new Date();
      
      const quotaRecords = quotaTypes.map(quotaType => {
        let resetDate: Date;
        
        if (quotaType === 'daily_requests') {
          resetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        } else {
          // Monthly quotas
          resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }

        return {
          user_id: userId,
          quota_type: quotaType,
          quota_limit: this.defaultLimits[tier][quotaType],
          quota_used: 0,
          quota_reset_date: resetDate.toISOString(),
          tier: tier,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        };
      });

      const { error } = await this.supabase
        .from('user_quotas')
        .upsert(quotaRecords, {
          onConflict: 'user_id,quota_type',
          ignoreDuplicates: false
        });

      if (error) {
        logger.error('Failed to initialize user quotas:', {
          error: error.message,
          userId,
          tier
        });
        throw error;
      }

      logger.info('User quotas initialized successfully:', {
        userId,
        tier,
        quotasInitialized: quotaTypes.length
      });

    } catch (error) {
      logger.error('Error in initializeUserQuotas:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        tier
      });
      throw error;
    }
  }

  /**
   * Check if a user has enough quota for a specific action
   */
  async checkQuotaAvailability(
    userId: string, 
    quotaType: QuotaType, 
    amount: number = 1
  ): Promise<QuotaCheckResult> {
    try {
      const { data: quotaData, error } = await this.supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('quota_type', quotaType)
        .single();

      if (error) {
        logger.error('Failed to check quota availability:', {
          error: error.message,
          userId,
          quotaType,
          amount
        });
        
        return {
          allowed: false,
          reason: 'Quota record not found'
        };
      }

      const quota = quotaData;
      const now = new Date();
      const resetDate = new Date(quota.quota_reset_date);

      // Check if quota needs reset
      if (resetDate <= now) {
        await this.resetQuota(userId, quotaType);
        // Refetch quota data after reset
        const { data: updatedQuota } = await this.supabase
          .from('user_quotas')
          .select('*')
          .eq('user_id', userId)
          .eq('quota_type', quotaType)
          .single();
        
        if (updatedQuota) {
          quota.quota_used = updatedQuota.quota_used;
          quota.quota_reset_date = updatedQuota.quota_reset_date;
        }
      }

      const quotaStatus: QuotaStatus = {
        type: quotaType,
        limit: quota.quota_limit,
        used: quota.quota_used,
        remaining: Math.max(0, quota.quota_limit - quota.quota_used),
        resetDate: new Date(quota.quota_reset_date),
        tier: quota.tier as UserTier,
        percentageUsed: quota.quota_limit > 0 ? (quota.quota_used / quota.quota_limit) * 100 : 0,
        isExceeded: quota.quota_used >= quota.quota_limit
      };

      const hasQuota = (quota.quota_used + amount) <= quota.quota_limit;

      return {
        allowed: hasQuota,
        quotaStatus,
        reason: hasQuota ? undefined : `Quota exceeded. Used: ${quota.quota_used}, Limit: ${quota.quota_limit}`
      };

    } catch (error) {
      logger.error('Error in checkQuotaAvailability:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        quotaType,
        amount
      });
      
      return {
        allowed: false,
        reason: 'Internal error checking quota'
      };
    }
  }

  /**
   * Consume quota for a user
   */
  async consumeQuota(
    userId: string, 
    quotaType: QuotaType, 
    amount: number = 1
  ): Promise<boolean> {
    try {
      // First check if quota is available
      const check = await this.checkQuotaAvailability(userId, quotaType, amount);
      
      if (!check.allowed) {
        logger.warn('Quota consumption denied:', {
          userId,
          quotaType,
          amount,
          reason: check.reason
        });
        return false;
      }

      // Consume the quota
      const { error } = await this.supabase
        .from('user_quotas')
        .update({
          quota_used: check.quotaStatus!.used + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('quota_type', quotaType);

      if (error) {
        logger.error('Failed to consume quota:', {
          error: error.message,
          userId,
          quotaType,
          amount
        });
        return false;
      }

      logger.info('Quota consumed successfully:', {
        userId,
        quotaType,
        amount,
        newUsage: check.quotaStatus!.used + amount,
        remaining: check.quotaStatus!.remaining - amount
      });

      return true;

    } catch (error) {
      logger.error('Error in consumeQuota:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        quotaType,
        amount
      });
      return false;
    }
  }

  /**
   * Get all quota statuses for a user
   */
  async getUserQuotaStatus(userId: string): Promise<QuotaStatus[]> {
    try {
      const { data: quotasData, error } = await this.supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .order('quota_type');

      if (error) {
        logger.error('Failed to get user quota status:', {
          error: error.message,
          userId
        });
        throw error;
      }

      if (!quotasData || quotasData.length === 0) {
        // Initialize quotas if they don't exist
        await this.initializeUserQuotas(userId);
        return this.getUserQuotaStatus(userId);
      }

      const now = new Date();
      const quotaStatuses: QuotaStatus[] = [];

      for (const quota of quotasData) {
        const resetDate = new Date(quota.quota_reset_date);
        
        // Check if quota needs reset
        if (resetDate <= now) {
          await this.resetQuota(userId, quota.quota_type as QuotaType);
          quota.quota_used = 0;
          quota.quota_reset_date = this.getNextResetDate(quota.quota_type as QuotaType).toISOString();
        }

        quotaStatuses.push({
          type: quota.quota_type as QuotaType,
          limit: quota.quota_limit,
          used: quota.quota_used,
          remaining: Math.max(0, quota.quota_limit - quota.quota_used),
          resetDate: new Date(quota.quota_reset_date),
          tier: quota.tier as UserTier,
          percentageUsed: quota.quota_limit > 0 ? (quota.quota_used / quota.quota_limit) * 100 : 0,
          isExceeded: quota.quota_used >= quota.quota_limit
        });
      }

      return quotaStatuses;

    } catch (error) {
      logger.error('Error in getUserQuotaStatus:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Reset a specific quota for a user
   */
  async resetQuota(userId: string, quotaType: QuotaType): Promise<void> {
    try {
      const nextResetDate = this.getNextResetDate(quotaType);
      
      const { error } = await this.supabase
        .from('user_quotas')
        .update({
          quota_used: 0,
          quota_reset_date: nextResetDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('quota_type', quotaType);

      if (error) {
        logger.error('Failed to reset quota:', {
          error: error.message,
          userId,
          quotaType
        });
        throw error;
      }

      logger.info('Quota reset successfully:', {
        userId,
        quotaType,
        nextResetDate: nextResetDate.toISOString()
      });

    } catch (error) {
      logger.error('Error in resetQuota:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        quotaType
      });
      throw error;
    }
  }

  /**
   * Reset all expired quotas (scheduled job)
   */
  async resetExpiredQuotas(): Promise<number> {
    try {
      const now = new Date();
      
      // Get all expired quotas
      const { data: expiredQuotas, error: selectError } = await this.supabase
        .from('user_quotas')
        .select('*')
        .lt('quota_reset_date', now.toISOString());

      if (selectError) {
        logger.error('Failed to fetch expired quotas:', selectError.message);
        throw selectError;
      }

      if (!expiredQuotas || expiredQuotas.length === 0) {
        return 0;
      }

      // Reset each expired quota
      let resetCount = 0;
      for (const quota of expiredQuotas) {
        try {
          await this.resetQuota(quota.user_id, quota.quota_type as QuotaType);
          resetCount++;
        } catch (error) {
          logger.error('Failed to reset individual quota:', {
            userId: quota.user_id,
            quotaType: quota.quota_type,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Batch quota reset completed:', {
        totalExpired: expiredQuotas.length,
        successfulResets: resetCount
      });

      return resetCount;

    } catch (error) {
      logger.error('Error in resetExpiredQuotas:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user quota limits (admin function)
   */
  async updateUserQuota(
    userId: string,
    quotaType: QuotaType,
    newLimit: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_quotas')
        .update({
          quota_limit: newLimit,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('quota_type', quotaType);

      if (error) {
        logger.error('Failed to update user quota:', {
          error: error.message,
          userId,
          quotaType,
          newLimit
        });
        throw error;
      }

      logger.info('User quota updated successfully:', {
        userId,
        quotaType,
        newLimit
      });

    } catch (error) {
      logger.error('Error in updateUserQuota:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        quotaType,
        newLimit
      });
      throw error;
    }
  }

  /**
   * Upgrade user tier and adjust quotas
   */
  async upgradeUserTier(userId: string, newTier: UserTier): Promise<void> {
    try {
      const newLimits = this.defaultLimits[newTier];
      
      // Update all quotas for the user
      const quotaTypes: QuotaType[] = ['monthly_corrections', 'monthly_characters', 'monthly_requests', 'daily_requests'];
      
      for (const quotaType of quotaTypes) {
        const { error } = await this.supabase
          .from('user_quotas')
          .update({
            quota_limit: newLimits[quotaType],
            tier: newTier,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('quota_type', quotaType);

        if (error) {
          logger.error('Failed to upgrade quota for type:', {
            error: error.message,
            userId,
            quotaType,
            newTier
          });
          throw error;
        }
      }

      logger.info('User tier upgraded successfully:', {
        userId,
        newTier,
        newLimits
      });

    } catch (error) {
      logger.error('Error in upgradeUserTier:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        newTier
      });
      throw error;
    }
  }

  /**
   * Get next reset date based on quota type
   */
  private getNextResetDate(quotaType: QuotaType): Date {
    const now = new Date();
    
    if (quotaType === 'daily_requests') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      // Monthly quotas
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  /**
   * Get quota limits for a tier
   */
  getQuotaLimitsForTier(tier: UserTier): { [key in QuotaType]: number } {
    return { ...this.defaultLimits[tier] };
  }
}

export const quotaManagementService = new QuotaManagementService();