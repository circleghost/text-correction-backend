-- Migration 003: Usage Quota Management System
-- Adds user quotas, enhanced tracking, and aggregation tables for comprehensive usage management

-- User quotas table for managing limits
CREATE TABLE user_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL,
  quota_limit INTEGER NOT NULL DEFAULT 0,
  quota_used INTEGER NOT NULL DEFAULT 0,
  quota_reset_date TIMESTAMPTZ NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT user_quotas_quota_type_check CHECK (
    quota_type IN ('monthly_corrections', 'monthly_characters', 'monthly_requests', 'daily_requests')
  ),
  CONSTRAINT user_quotas_quota_limit_check CHECK (quota_limit >= 0),
  CONSTRAINT user_quotas_quota_used_check CHECK (quota_used >= 0),
  CONSTRAINT user_quotas_tier_check CHECK (
    tier IN ('free', 'premium', 'enterprise', 'admin')
  ),
  CONSTRAINT user_quotas_unique_type UNIQUE(user_id, quota_type)
);

-- Extend usage_tracking table with more detailed information
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS feature_used TEXT;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS quota_consumed INTEGER DEFAULT 1;

-- Add constraints to new columns
ALTER TABLE usage_tracking ADD CONSTRAINT usage_tracking_processing_time_check 
  CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0);
ALTER TABLE usage_tracking ADD CONSTRAINT usage_tracking_quota_consumed_check 
  CHECK (quota_consumed >= 0);

-- Usage aggregations table for performance optimized queries
CREATE TABLE usage_aggregations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aggregation_type TEXT NOT NULL,
  aggregation_date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0 NOT NULL,
  total_characters INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  average_processing_time FLOAT DEFAULT 0 NOT NULL,
  error_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT usage_aggregations_type_check CHECK (
    aggregation_type IN ('daily', 'weekly', 'monthly')
  ),
  CONSTRAINT usage_aggregations_metrics_check CHECK (
    total_requests >= 0 AND total_characters >= 0 AND total_tokens >= 0 AND 
    average_processing_time >= 0 AND error_count >= 0
  ),
  CONSTRAINT usage_aggregations_unique UNIQUE(user_id, aggregation_type, aggregation_date)
);

-- Quota notifications table for tracking alerts
CREATE TABLE quota_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  quota_type TEXT NOT NULL,
  threshold_percentage INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT quota_notifications_type_check CHECK (
    notification_type IN ('warning', 'limit_reached', 'reset')
  ),
  CONSTRAINT quota_notifications_threshold_check CHECK (
    threshold_percentage >= 0 AND threshold_percentage <= 100
  )
);

-- Indexes for performance
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_type ON user_quotas(quota_type);
CREATE INDEX idx_user_quotas_reset_date ON user_quotas(quota_reset_date);
CREATE INDEX idx_user_quotas_tier ON user_quotas(tier);

CREATE INDEX idx_usage_tracking_session_id ON usage_tracking(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_usage_tracking_feature ON usage_tracking(feature_used) WHERE feature_used IS NOT NULL;
CREATE INDEX idx_usage_tracking_error ON usage_tracking(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_usage_tracking_processing_time ON usage_tracking(processing_time_ms) WHERE processing_time_ms IS NOT NULL;

CREATE INDEX idx_usage_aggregations_user_date ON usage_aggregations(user_id, aggregation_date);
CREATE INDEX idx_usage_aggregations_type_date ON usage_aggregations(aggregation_type, aggregation_date);

CREATE INDEX idx_quota_notifications_user_id ON quota_notifications(user_id);
CREATE INDEX idx_quota_notifications_sent_at ON quota_notifications(sent_at);

-- Update triggers for new tables
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_aggregations_updated_at
  BEFORE UPDATE ON usage_aggregations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize default quotas for new users
CREATE OR REPLACE FUNCTION initialize_user_quotas(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Monthly corrections quota (default: 50 for free tier)
  INSERT INTO user_quotas (user_id, quota_type, quota_limit, quota_reset_date, tier)
  VALUES (p_user_id, 'monthly_corrections', 50, DATE_TRUNC('month', NOW()) + INTERVAL '1 month', 'free')
  ON CONFLICT (user_id, quota_type) DO NOTHING;
  
  -- Monthly characters quota (default: 10,000 for free tier)
  INSERT INTO user_quotas (user_id, quota_type, quota_limit, quota_reset_date, tier)
  VALUES (p_user_id, 'monthly_characters', 10000, DATE_TRUNC('month', NOW()) + INTERVAL '1 month', 'free')
  ON CONFLICT (user_id, quota_type) DO NOTHING;
  
  -- Monthly requests quota (default: 100 for free tier)
  INSERT INTO user_quotas (user_id, quota_type, quota_limit, quota_reset_date, tier)
  VALUES (p_user_id, 'monthly_requests', 100, DATE_TRUNC('month', NOW()) + INTERVAL '1 month', 'free')
  ON CONFLICT (user_id, quota_type) DO NOTHING;
  
  -- Daily requests quota (default: 10 for free tier)
  INSERT INTO user_quotas (user_id, quota_type, quota_limit, quota_reset_date, tier)
  VALUES (p_user_id, 'daily_requests', 10, DATE_TRUNC('day', NOW()) + INTERVAL '1 day', 'free')
  ON CONFLICT (user_id, quota_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to check quota availability
CREATE OR REPLACE FUNCTION check_quota_availability(
  p_user_id UUID,
  p_quota_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  current_quota RECORD;
BEGIN
  SELECT quota_limit, quota_used, quota_reset_date 
  INTO current_quota
  FROM user_quotas 
  WHERE user_id = p_user_id AND quota_type = p_quota_type;
  
  -- If no quota record exists, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if quota needs reset
  IF current_quota.quota_reset_date <= NOW() THEN
    -- Reset quota (this will be handled by a separate function)
    RETURN TRUE;
  END IF;
  
  -- Check if there's enough quota available
  RETURN (current_quota.quota_used + p_amount) <= current_quota.quota_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to consume quota
CREATE OR REPLACE FUNCTION consume_quota(
  p_user_id UUID,
  p_quota_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  quota_available BOOLEAN;
BEGIN
  -- Check if quota is available
  SELECT check_quota_availability(p_user_id, p_quota_type, p_amount) INTO quota_available;
  
  IF NOT quota_available THEN
    RETURN FALSE;
  END IF;
  
  -- Consume the quota
  UPDATE user_quotas 
  SET quota_used = quota_used + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND quota_type = p_quota_type;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset expired quotas
CREATE OR REPLACE FUNCTION reset_expired_quotas()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Reset daily quotas
  UPDATE user_quotas 
  SET quota_used = 0, 
      quota_reset_date = CASE 
        WHEN quota_type = 'daily_requests' THEN DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
        ELSE quota_reset_date 
      END,
      updated_at = NOW()
  WHERE quota_type = 'daily_requests' 
    AND quota_reset_date <= NOW();
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  reset_count := reset_count + temp_count;
  
  -- Reset monthly quotas
  UPDATE user_quotas 
  SET quota_used = 0,
      quota_reset_date = CASE 
        WHEN quota_type IN ('monthly_corrections', 'monthly_characters', 'monthly_requests') 
        THEN DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
        ELSE quota_reset_date 
      END,
      updated_at = NOW()
  WHERE quota_type IN ('monthly_corrections', 'monthly_characters', 'monthly_requests')
    AND quota_reset_date <= NOW();
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  reset_count := reset_count + temp_count;
  
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced user usage stats view with quota information
DROP VIEW IF EXISTS user_usage_stats;

CREATE VIEW user_usage_stats AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.created_at as user_created_at,
  u.last_sign_in_at,
  
  -- Overall statistics
  COUNT(ut.id) as total_requests,
  SUM(ut.text_length) as total_characters_processed,
  SUM(ut.tokens_used) as total_tokens_used,
  MAX(ut.created_at) as last_activity,
  
  -- Time-based statistics
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as monthly_requests,
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as daily_requests,
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as weekly_requests,
  
  -- Character statistics
  SUM(CASE WHEN ut.created_at >= DATE_TRUNC('month', NOW()) THEN ut.text_length ELSE 0 END) as monthly_characters,
  SUM(CASE WHEN ut.created_at >= DATE_TRUNC('day', NOW()) THEN ut.text_length ELSE 0 END) as daily_characters,
  
  -- Performance statistics
  AVG(ut.processing_time_ms) as avg_processing_time,
  COUNT(CASE WHEN ut.error_code IS NOT NULL THEN 1 END) as total_errors,
  
  -- Quota information (using JSON for flexibility)
  (
    SELECT json_object_agg(quota_type, json_build_object(
      'limit', quota_limit,
      'used', quota_used,
      'remaining', quota_limit - quota_used,
      'reset_date', quota_reset_date,
      'tier', tier
    ))
    FROM user_quotas uq 
    WHERE uq.user_id = u.id
  ) as quotas
  
FROM users u
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
GROUP BY u.id, u.email, u.full_name, u.created_at, u.last_sign_in_at;

-- Comments for documentation
COMMENT ON TABLE user_quotas IS 'User quota limits and usage tracking';
COMMENT ON COLUMN user_quotas.quota_type IS 'Type of quota (monthly_corrections, monthly_characters, etc.)';
COMMENT ON COLUMN user_quotas.quota_limit IS 'Maximum allowed usage for this quota type';
COMMENT ON COLUMN user_quotas.quota_used IS 'Current usage amount';
COMMENT ON COLUMN user_quotas.quota_reset_date IS 'When this quota will reset';
COMMENT ON COLUMN user_quotas.tier IS 'User tier (free, premium, enterprise, admin)';

COMMENT ON TABLE usage_aggregations IS 'Pre-calculated usage statistics for performance';
COMMENT ON COLUMN usage_aggregations.aggregation_type IS 'Type of aggregation (daily, weekly, monthly)';
COMMENT ON COLUMN usage_aggregations.aggregation_date IS 'Date for this aggregation period';

COMMENT ON TABLE quota_notifications IS 'Track quota-related notifications sent to users';

COMMENT ON FUNCTION initialize_user_quotas(UUID) IS 'Set up default quotas for a new user';
COMMENT ON FUNCTION check_quota_availability(UUID, TEXT, INTEGER) IS 'Check if user has enough quota available';
COMMENT ON FUNCTION consume_quota(UUID, TEXT, INTEGER) IS 'Consume quota and return success status';
COMMENT ON FUNCTION reset_expired_quotas() IS 'Reset all expired quotas and return count of reset records';