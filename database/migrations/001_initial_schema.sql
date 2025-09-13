-- Initial database schema for Auth + Usage Tracking
-- This migration creates the core tables for user authentication and usage tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_sign_in_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_avatar_url_check CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://.*'),
  CONSTRAINT users_google_id_check CHECK (google_id IS NULL OR LENGTH(google_id) > 0)
);

-- Usage tracking table
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  text_length INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT usage_tracking_action_type_check CHECK (
    action_type IN ('correction_request', 'text_processed', 'api_call')
  ),
  CONSTRAINT usage_tracking_text_length_check CHECK (text_length >= 0),
  CONSTRAINT usage_tracking_tokens_used_check CHECK (tokens_used IS NULL OR tokens_used >= 0)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_created_at ON usage_tracking(created_at);
CREATE INDEX idx_usage_tracking_action_type ON usage_tracking(action_type);
CREATE INDEX idx_usage_tracking_user_created ON usage_tracking(user_id, created_at);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for authentication and profile management';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.email IS 'User email address (unique, required)';
COMMENT ON COLUMN users.full_name IS 'User full name from OAuth provider';
COMMENT ON COLUMN users.avatar_url IS 'User avatar/profile picture URL';
COMMENT ON COLUMN users.google_id IS 'Google OAuth user ID (unique)';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last profile update timestamp';
COMMENT ON COLUMN users.last_sign_in_at IS 'Last successful sign-in timestamp';

COMMENT ON TABLE usage_tracking IS 'Track user API usage and text processing';
COMMENT ON COLUMN usage_tracking.id IS 'Unique usage record identifier (UUID)';
COMMENT ON COLUMN usage_tracking.user_id IS 'Reference to users table';
COMMENT ON COLUMN usage_tracking.action_type IS 'Type of action performed';
COMMENT ON COLUMN usage_tracking.text_length IS 'Length of processed text in characters';
COMMENT ON COLUMN usage_tracking.tokens_used IS 'Number of AI tokens consumed (optional)';
COMMENT ON COLUMN usage_tracking.created_at IS 'Timestamp when action was performed';
COMMENT ON COLUMN usage_tracking.metadata IS 'Additional action metadata (JSON)';

-- Create a view for user statistics
CREATE VIEW user_usage_stats AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.created_at as user_created_at,
  COUNT(ut.id) as total_requests,
  SUM(ut.text_length) as total_characters_processed,
  SUM(ut.tokens_used) as total_tokens_used,
  MAX(ut.created_at) as last_activity,
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as monthly_requests,
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as daily_requests
FROM users u
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
GROUP BY u.id, u.email, u.full_name, u.created_at;

COMMENT ON VIEW user_usage_stats IS 'Aggregated usage statistics per user';