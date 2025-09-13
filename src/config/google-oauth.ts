import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../utils/config';
import type { GoogleTokenPayload, GoogleOAuthProfile } from '../types/index';

// Google OAuth client instance
let googleOAuthClient: OAuth2Client | null = null;

/**
 * Initialize Google OAuth client
 */
export const initializeGoogleOAuth = (): OAuth2Client | null => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      logger.warn('Google OAuth configuration missing - Google sign-in disabled');
      return null;
    }

    if (!googleOAuthClient) {
      googleOAuthClient = new OAuth2Client({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      });

      logger.info('✅ Google OAuth client initialized successfully');
    }

    return googleOAuthClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Google OAuth client:', error);
    return null;
  }
};

/**
 * Get the initialized Google OAuth client
 */
export const getGoogleOAuthClient = (): OAuth2Client | null => {
  if (!googleOAuthClient) {
    return initializeGoogleOAuth();
  }
  return googleOAuthClient;
};

/**
 * Verify Google ID token and extract user information
 */
export const verifyGoogleToken = async (token: string): Promise<{
  payload: GoogleTokenPayload | null;
  error: Error | null;
}> => {
  const client = getGoogleOAuthClient();
  
  if (!client) {
    return {
      payload: null,
      error: new Error('Google OAuth client not available'),
    };
  }

  if (!GOOGLE_CLIENT_ID) {
    return {
      payload: null,
      error: new Error('Google Client ID not configured'),
    };
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      return {
        payload: null,
        error: new Error('Invalid token payload'),
      };
    }

    // Validate required fields
    if (!payload.sub || !payload.email) {
      return {
        payload: null,
        error: new Error('Token missing required user information'),
      };
    }

    logger.debug('Google token verified successfully for user:', payload.email);
    
    return {
      payload: payload as GoogleTokenPayload,
      error: null,
    };
  } catch (error) {
    logger.warn('Google token verification failed:', error);
    return {
      payload: null,
      error: error instanceof Error ? error : new Error('Unknown verification error'),
    };
  }
};

/**
 * Get Google user profile information
 */
export const getGoogleUserProfile = async (accessToken: string): Promise<{
  profile: GoogleOAuthProfile | null;
  error: Error | null;
}> => {
  const client = getGoogleOAuthClient();
  
  if (!client) {
    return {
      profile: null,
      error: new Error('Google OAuth client not available'),
    };
  }

  try {
    // Set the access token
    client.setCredentials({ access_token: accessToken });

    // Get user info
    const userInfoResponse = await client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });

    const profile = userInfoResponse.data as GoogleOAuthProfile;
    
    if (!profile || !profile.id || !profile.email) {
      return {
        profile: null,
        error: new Error('Invalid user profile data'),
      };
    }

    logger.debug('Retrieved Google user profile for:', profile.email);
    
    return {
      profile,
      error: null,
    };
  } catch (error) {
    logger.error('Failed to get Google user profile:', error);
    return {
      profile: null,
      error: error instanceof Error ? error : new Error('Profile retrieval failed'),
    };
  }
};

/**
 * Generate Google OAuth authorization URL
 */
export const generateGoogleAuthUrl = (redirectUri: string, state?: string): string | null => {
  const client = getGoogleOAuthClient();
  
  if (!client) {
    logger.error('Cannot generate auth URL - Google OAuth client not available');
    return null;
  }

  try {
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      redirect_uri: redirectUri,
      ...(state && { state }),
      prompt: 'consent',
    });

    logger.debug('Generated Google OAuth URL for redirect URI:', redirectUri);
    return authUrl;
  } catch (error) {
    logger.error('Failed to generate Google auth URL:', error);
    return null;
  }
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code: string, redirectUri: string): Promise<{
  tokens: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
  } | null;
  error: Error | null;
}> => {
  const client = getGoogleOAuthClient();
  
  if (!client) {
    return {
      tokens: null,
      error: new Error('Google OAuth client not available'),
    };
  }

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    if (!tokens.access_token || !tokens.id_token) {
      return {
        tokens: null,
        error: new Error('Invalid token response from Google'),
      };
    }

    logger.debug('Successfully exchanged authorization code for tokens');
    
    return {
      tokens: {
        access_token: tokens.access_token || undefined,
        refresh_token: tokens.refresh_token || undefined,
        id_token: tokens.id_token || undefined,
      },
      error: null,
    };
  } catch (error) {
    logger.error('Failed to exchange code for tokens:', error);
    return {
      tokens: null,
      error: error instanceof Error ? error : new Error('Token exchange failed'),
    };
  }
};

/**
 * Health check for Google OAuth service
 */
export const checkGoogleOAuthHealth = async (): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    const client = getGoogleOAuthClient();
    
    if (!client) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: 'Google OAuth client not configured',
      };
    }

    // Test connectivity by making a simple request to Google's userinfo endpoint
    // This doesn't require authentication, just tests connectivity
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      method: 'HEAD',
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok && response.status !== 401) {
      // 401 is expected since we're not sending auth, anything else is problematic
      return {
        status: 'degraded',
        responseTime,
        error: `Google API returned status ${response.status}`,
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

// Export client for direct use (with null checks)
export { googleOAuthClient };