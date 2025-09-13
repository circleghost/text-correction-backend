import { logger } from './logger';
import { checkSupabaseHealth } from '../config/supabase';
import { checkGoogleOAuthHealth } from '../config/google-oauth';

/**
 * Test all external service connections
 */
export const testAllConnections = async (): Promise<{
  success: boolean;
  results: {
    supabase: any;
    googleOAuth: any;
  };
  summary: string;
}> => {
  logger.info('🔍 Testing external service connections...');
  
  const results = {
    supabase: await checkSupabaseHealth(),
    googleOAuth: await checkGoogleOAuthHealth(),
  };

  const failedServices = [];
  const degradedServices = [];
  
  // Check each service status
  if (results.supabase.status === 'down') {
    failedServices.push('Supabase');
  } else if (results.supabase.status === 'degraded') {
    degradedServices.push('Supabase');
  }
  
  if (results.googleOAuth.status === 'down') {
    failedServices.push('Google OAuth');
  } else if (results.googleOAuth.status === 'degraded') {
    degradedServices.push('Google OAuth');
  }

  // Generate summary
  let summary = '';
  let success = true;

  if (failedServices.length > 0) {
    success = false;
    summary += `❌ Failed: ${failedServices.join(', ')}. `;
  }
  
  if (degradedServices.length > 0) {
    summary += `⚠️ Degraded: ${degradedServices.join(', ')}. `;
  }
  
  if (failedServices.length === 0 && degradedServices.length === 0) {
    summary = '✅ All services are healthy';
  }

  // Log detailed results
  logger.info('📊 Connection test results:');
  logger.info(`  Supabase: ${results.supabase.status} (${results.supabase.responseTime}ms)`);
  if (results.supabase.error) {
    logger.warn(`    Error: ${results.supabase.error}`);
  }
  
  logger.info(`  Google OAuth: ${results.googleOAuth.status} (${results.googleOAuth.responseTime}ms)`);
  if (results.googleOAuth.error) {
    logger.warn(`    Error: ${results.googleOAuth.error}`);
  }

  logger.info(`📋 Summary: ${summary}`);

  return {
    success,
    results,
    summary,
  };
};

/**
 * Test Supabase connection only
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
  logger.info('🔍 Testing Supabase connection...');
  
  const result = await checkSupabaseHealth();
  
  if (result.status === 'up') {
    logger.info(`✅ Supabase connection successful (${result.responseTime}ms)`);
    return true;
  } else {
    logger.error(`❌ Supabase connection failed: ${result.error || 'Unknown error'}`);
    return false;
  }
};

/**
 * Test Google OAuth connection only
 */
export const testGoogleOAuthConnection = async (): Promise<boolean> => {
  logger.info('🔍 Testing Google OAuth connection...');
  
  const result = await checkGoogleOAuthHealth();
  
  if (result.status === 'up') {
    logger.info(`✅ Google OAuth connection successful (${result.responseTime}ms)`);
    return true;
  } else {
    logger.error(`❌ Google OAuth connection failed: ${result.error || 'Unknown error'}`);
    return false;
  }
};

/**
 * Initialize all services and test connections
 */
export const initializeServices = async (): Promise<boolean> => {
  logger.info('🚀 Initializing authentication services...');
  
  try {
    // Import and initialize services
    const { initializeSupabase } = await import('../config/supabase');
    const { initializeGoogleOAuth } = await import('../config/google-oauth');
    
    // Initialize services
    initializeSupabase();
    initializeGoogleOAuth();
    
    // Test connections
    const connectionTest = await testAllConnections();
    
    if (connectionTest.success) {
      logger.info('✅ All authentication services initialized successfully');
      return true;
    } else {
      logger.warn('⚠️ Some authentication services have issues, but application can continue');
      logger.warn(`Details: ${connectionTest.summary}`);
      return false;
    }
  } catch (error) {
    logger.error('❌ Failed to initialize authentication services:', error);
    return false;
  }
};

/**
 * Health check endpoint data
 */
export const getHealthCheckData = async () => {
  const connectionTest = await testAllConnections();
  
  return {
    status: connectionTest.success ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      supabase: {
        status: connectionTest.results.supabase.status,
        responseTime: connectionTest.results.supabase.responseTime,
        error: connectionTest.results.supabase.error,
      },
      googleOAuth: {
        status: connectionTest.results.googleOAuth.status,
        responseTime: connectionTest.results.googleOAuth.responseTime,
        error: connectionTest.results.googleOAuth.error,
      },
    },
    summary: connectionTest.summary,
  };
};