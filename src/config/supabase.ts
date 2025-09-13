import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '../utils/config';

// Database schema types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string;
          google_id?: string;
          created_at: string;
          updated_at: string;
          last_sign_in_at?: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string;
          avatar_url?: string;
          google_id?: string;
          created_at?: string;
          updated_at?: string;
          last_sign_in_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string;
          google_id?: string;
          created_at?: string;
          updated_at?: string;
          last_sign_in_at?: string;
        };
      };
      usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          text_length: number;
          tokens_used?: number;
          created_at: string;
          metadata?: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_type: string;
          text_length: number;
          tokens_used?: number;
          created_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          user_id?: string;
          action_type?: string;
          text_length?: number;
          tokens_used?: number;
          created_at?: string;
          metadata?: Record<string, unknown>;
        };
      };
    };
  };
}

// Supabase client instances
let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseServiceClient: SupabaseClient<Database> | null = null;

/**
 * Initialize Supabase client with anonymous key (for public operations)
 */
export const initializeSupabase = (): SupabaseClient<Database> | null => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      logger.warn('Supabase configuration missing - running without Supabase integration');
      return null;
    }

    if (!supabaseClient) {
      supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Backend doesn't need session persistence
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'X-Application': 'text-correction-backend',
          },
        },
      });

      logger.info('✅ Supabase client initialized successfully');
    }

    return supabaseClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
};

/**
 * Initialize Supabase service role client (for admin operations)
 */
export const initializeSupabaseService = (): SupabaseClient<Database> | null => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.warn('Supabase service role configuration missing - admin operations disabled');
      return null;
    }

    if (!supabaseServiceClient) {
      supabaseServiceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'X-Application': 'text-correction-backend-admin',
          },
        },
      });

      logger.info('✅ Supabase service client initialized successfully');
    }

    return supabaseServiceClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase service client:', error);
    return null;
  }
};

/**
 * Get the initialized Supabase client (public)
 */
export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!supabaseClient) {
    return initializeSupabase();
  }
  return supabaseClient;
};

/**
 * Get the initialized Supabase service client (admin)
 */
export const getSupabaseServiceClient = (): SupabaseClient<Database> | null => {
  if (!supabaseServiceClient) {
    return initializeSupabaseService();
  }
  return supabaseServiceClient;
};

/**
 * Verify JWT token using Supabase auth
 */
export const verifySupabaseToken = async (token: string): Promise<{
  user: any;
  error: Error | null;
}> => {
  const client = getSupabaseClient();
  
  if (!client) {
    return {
      user: null,
      error: new Error('Supabase client not available'),
    };
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    
    if (error) {
      logger.warn('Token verification failed:', error.message);
      return { user: null, error };
    }

    if (!data.user) {
      return { user: null, error: new Error('User not found') };
    }

    logger.debug('Token verified successfully for user:', data.user.id);
    return { user: data.user, error: null };
  } catch (error) {
    logger.error('Token verification error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error : new Error('Unknown verification error')
    };
  }
};

/**
 * Health check for Supabase connection
 */
export const checkSupabaseHealth = async (): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: 'Supabase client not configured',
      };
    }

    // Simple query to test connection
    const { error } = await client
      .from('users')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'degraded',
        responseTime,
        error: error.message,
      };
    }

    return {
      status: 'up',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Export clients for direct use (with null checks)
export { supabaseClient, supabaseServiceClient };