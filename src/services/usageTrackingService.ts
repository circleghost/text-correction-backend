import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface UsageTrackingMetadata {
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  processingTimeMs?: number;
  errorCode?: string;
  featureUsed?: string;
  requestId?: string;
  endpoint?: string;
  [key: string]: any;
}

interface TrackUsageParams {
  userId: string;
  actionType: 'correction_request' | 'text_processed' | 'api_call';
  textLength?: number;
  tokensUsed?: number;
  metadata?: UsageTrackingMetadata;
  quotaConsumed?: number;
}

interface UsageStats {
  totalRequests: number;
  totalCharacters: number;
  totalTokens: number;
  monthlyRequests: number;
  monthlyCharacters: number;
  dailyRequests: number;
  dailyCharacters: number;
  averageProcessingTime?: number;
  totalErrors: number;
  lastActivity?: Date;
}

interface UsageHistoryEntry {
  id: string;
  actionType: string;
  textLength: number;
  tokensUsed?: number;
  createdAt: Date;
  processingTimeMs?: number;
  errorCode?: string;
  featureUsed?: string;
  metadata?: any;
}

interface TimeRangeUsage {
  period: string;
  totalRequests: number;
  totalCharacters: number;
  totalTokens: number;
  averageProcessingTime: number;
  errorCount: number;
}

export class UsageTrackingService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for usage tracking');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Track a usage event
   */
  async trackUsage(params: TrackUsageParams): Promise<void> {
    try {
      const {
        userId,
        actionType,
        textLength = 0,
        tokensUsed,
        metadata = {},
        quotaConsumed = 1
      } = params;

      const usageRecord = {
        id: uuidv4(),
        user_id: userId,
        action_type: actionType,
        text_length: textLength,
        tokens_used: tokensUsed,
        quota_consumed: quotaConsumed,
        session_id: metadata.sessionId,
        ip_address: metadata.ipAddress,
        user_agent: metadata.userAgent,
        processing_time_ms: metadata.processingTimeMs,
        error_code: metadata.errorCode,
        feature_used: metadata.featureUsed,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          requestId: metadata.requestId || uuidv4()
        },
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('usage_tracking')
        .insert(usageRecord);

      if (error) {
        logger.error('Failed to track usage:', {
          error: error.message,
          userId,
          actionType,
          textLength
        });
        throw error;
      }

      logger.info('Usage tracked successfully:', {
        userId,
        actionType,
        textLength,
        tokensUsed,
        quotaConsumed
      });

    } catch (error) {
      logger.error('Error in trackUsage:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: params.userId,
        actionType: params.actionType
      });
      // Don't throw here to avoid breaking the main flow
    }
  }

  /**
   * Get user usage statistics for a specific period
   */
  async getUserUsage(userId: string, period: 'day' | 'week' | 'month' | 'all' = 'month'): Promise<UsageStats> {
    try {
      let query = this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId);

      // Add time filter based on period
      if (period !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: usageData, error } = await query;

      if (error) {
        logger.error('Failed to get user usage:', {
          error: error.message,
          userId,
          period
        });
        throw error;
      }

      // Calculate statistics
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const stats: UsageStats = {
        totalRequests: usageData?.length || 0,
        totalCharacters: usageData?.reduce((sum, record) => sum + (record.text_length || 0), 0) || 0,
        totalTokens: usageData?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0,
        monthlyRequests: usageData?.filter(record => new Date(record.created_at) >= monthStart).length || 0,
        monthlyCharacters: usageData?.filter(record => new Date(record.created_at) >= monthStart)
          .reduce((sum, record) => sum + (record.text_length || 0), 0) || 0,
        dailyRequests: usageData?.filter(record => new Date(record.created_at) >= dayStart).length || 0,
        dailyCharacters: usageData?.filter(record => new Date(record.created_at) >= dayStart)
          .reduce((sum, record) => sum + (record.text_length || 0), 0) || 0,
        totalErrors: usageData?.filter(record => record.error_code).length || 0
      };

      // Add lastActivity only if there's data
      if (usageData && usageData.length > 0) {
        stats.lastActivity = new Date(Math.max(...usageData.map(record => new Date(record.created_at).getTime())));
      }

      // Calculate average processing time
      const recordsWithProcessingTime = usageData?.filter(record => record.processing_time_ms) || [];
      if (recordsWithProcessingTime.length > 0) {
        stats.averageProcessingTime = recordsWithProcessingTime
          .reduce((sum, record) => sum + record.processing_time_ms, 0) / recordsWithProcessingTime.length;
      }

      return stats;

    } catch (error) {
      logger.error('Error in getUserUsage:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        period
      });
      throw error;
    }
  }

  /**
   * Get usage history with pagination
   */
  async getUserUsageHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      actionType?: string;
    } = {}
  ): Promise<{ data: UsageHistoryEntry[]; total: number }> {
    try {
      const { limit = 50, offset = 0, startDate, endDate, actionType } = options;

      let query = this.supabase
        .from('usage_tracking')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      const { data: usageData, error, count } = await query;

      if (error) {
        logger.error('Failed to get user usage history:', {
          error: error.message,
          userId,
          options
        });
        throw error;
      }

      const history: UsageHistoryEntry[] = (usageData || []).map(record => ({
        id: record.id,
        actionType: record.action_type,
        textLength: record.text_length || 0,
        tokensUsed: record.tokens_used,
        createdAt: new Date(record.created_at),
        processingTimeMs: record.processing_time_ms,
        errorCode: record.error_code,
        featureUsed: record.feature_used,
        metadata: record.metadata
      }));

      return {
        data: history,
        total: count || 0
      };

    } catch (error) {
      logger.error('Error in getUserUsageHistory:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Get system-wide usage statistics (admin only)
   */
  async getSystemUsage(period: 'day' | 'week' | 'month' = 'month'): Promise<{
    totalUsers: number;
    totalRequests: number;
    totalCharacters: number;
    totalTokens: number;
    averageProcessingTime?: number;
    errorRate: number;
    activeUsers: number;
  }> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
          startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Get usage statistics
      const { data: usageData, error: usageError } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (usageError) {
        throw usageError;
      }

      // Get total users count
      const { count: totalUsers, error: usersError } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        throw usersError;
      }

      const totalRequests = usageData?.length || 0;
      const totalCharacters = usageData?.reduce((sum, record) => sum + (record.text_length || 0), 0) || 0;
      const totalTokens = usageData?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;
      const errorCount = usageData?.filter(record => record.error_code).length || 0;
      const activeUsers = new Set(usageData?.map(record => record.user_id)).size;

      // Calculate average processing time
      const recordsWithProcessingTime = usageData?.filter(record => record.processing_time_ms) || [];
      const averageProcessingTime = recordsWithProcessingTime.length > 0
        ? recordsWithProcessingTime.reduce((sum, record) => sum + record.processing_time_ms, 0) / recordsWithProcessingTime.length
        : undefined;

      const result: any = {
        totalUsers: totalUsers || 0,
        totalRequests,
        totalCharacters,
        totalTokens,
        errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
        activeUsers
      };

      // Add averageProcessingTime only if available
      if (averageProcessingTime !== undefined) {
        result.averageProcessingTime = averageProcessingTime;
      }

      return result;

    } catch (error) {
      logger.error('Error in getSystemUsage:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period
      });
      throw error;
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    userId: string,
    period: 'day' | 'week' | 'month' = 'month',
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeRangeUsage[]> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          break;
        case 'week':
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
      }

      const { data: usageData, error } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group data by the specified period
      const groupedData = new Map<string, {
        totalRequests: number;
        totalCharacters: number;
        totalTokens: number;
        processingTimes: number[];
        errorCount: number;
      }>();

      usageData?.forEach(record => {
        const date = new Date(record.created_at);
        let groupKey: string;

        switch (groupBy) {
          case 'day':
            groupKey = date.toISOString().split('T')[0] || 'unknown';
            break;
          case 'week':
            const weekStart = new Date(date.getTime() - (date.getDay() * 24 * 60 * 60 * 1000));
            groupKey = weekStart.toISOString().split('T')[0] || 'unknown';
            break;
          case 'month':
            groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            groupKey = date.toISOString().split('T')[0] || 'unknown';
        }

        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, {
            totalRequests: 0,
            totalCharacters: 0,
            totalTokens: 0,
            processingTimes: [],
            errorCount: 0
          });
        }

        const group = groupedData.get(groupKey)!;
        group.totalRequests += 1;
        group.totalCharacters += record.text_length || 0;
        group.totalTokens += record.tokens_used || 0;
        
        if (record.processing_time_ms) {
          group.processingTimes.push(record.processing_time_ms);
        }
        
        if (record.error_code) {
          group.errorCount += 1;
        }
      });

      // Convert to result format
      const trends: TimeRangeUsage[] = Array.from(groupedData.entries()).map(([period, data]) => ({
        period,
        totalRequests: data.totalRequests,
        totalCharacters: data.totalCharacters,
        totalTokens: data.totalTokens,
        averageProcessingTime: data.processingTimes.length > 0
          ? data.processingTimes.reduce((sum, time) => sum + time, 0) / data.processingTimes.length
          : 0,
        errorCount: data.errorCount
      }));

      return trends.sort((a, b) => a.period.localeCompare(b.period));

    } catch (error) {
      logger.error('Error in getUsageTrends:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        period,
        groupBy
      });
      throw error;
    }
  }
}

export const usageTrackingService = new UsageTrackingService();