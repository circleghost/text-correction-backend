-- Row Level Security policies for user data protection
-- This migration enables RLS and creates security policies

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID from JWT token
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    (current_setting('request.jwt.claims', true)::json->>'user_id')
  )::UUID;
$$;

-- Helper function to check if current user is authenticated
CREATE OR REPLACE FUNCTION auth.authenticated()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT auth.user_id() IS NOT NULL;
$$;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'authenticated'
  );
$$;

-- Users table RLS policies
-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  USING (auth.user_id() = id);

-- Policy: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.user_id() = id)
  WITH CHECK (auth.user_id() = id);

-- Policy: Allow user creation during signup (service role only)
CREATE POLICY "Service role can insert users" ON users
  FOR INSERT
  WITH CHECK (auth.user_role() = 'service_role');

-- Policy: Prevent user deletion for regular users
CREATE POLICY "Users cannot delete accounts" ON users
  FOR DELETE
  USING (false);

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role full access users" ON users
  FOR ALL
  USING (auth.user_role() = 'service_role')
  WITH CHECK (auth.user_role() = 'service_role');

-- Usage tracking table RLS policies
-- Policy: Users can read their own usage data
CREATE POLICY "Users can read own usage" ON usage_tracking
  FOR SELECT
  USING (auth.user_id() = user_id);

-- Policy: Service role can insert usage tracking records
CREATE POLICY "Service role can insert usage" ON usage_tracking
  FOR INSERT
  WITH CHECK (auth.user_role() = 'service_role');

-- Policy: Prevent users from modifying usage records
CREATE POLICY "Users cannot update usage records" ON usage_tracking
  FOR UPDATE
  USING (false);

-- Policy: Prevent users from deleting usage records
CREATE POLICY "Users cannot delete usage records" ON usage_tracking
  FOR DELETE
  USING (false);

-- Policy: Service role has full access to usage tracking
CREATE POLICY "Service role full access usage" ON usage_tracking
  FOR ALL
  USING (auth.user_role() = 'service_role')
  WITH CHECK (auth.user_role() = 'service_role');

-- Create secure view for user stats (respects RLS)
CREATE VIEW secure_user_stats AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.avatar_url,
  u.created_at,
  u.last_sign_in_at,
  COUNT(ut.id) as total_requests,
  SUM(ut.text_length) as total_characters,
  SUM(ut.tokens_used) as total_tokens,
  MAX(ut.created_at) as last_activity,
  -- Monthly usage (current month)
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as monthly_requests,
  SUM(CASE WHEN ut.created_at >= DATE_TRUNC('month', NOW()) THEN ut.text_length ELSE 0 END) as monthly_characters,
  -- Daily usage (today)
  COUNT(CASE WHEN ut.created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as daily_requests,
  SUM(CASE WHEN ut.created_at >= DATE_TRUNC('day', NOW()) THEN ut.text_length ELSE 0 END) as daily_characters
FROM users u
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
WHERE u.id = auth.user_id() -- Automatically filtered by RLS
GROUP BY u.id, u.email, u.full_name, u.avatar_url, u.created_at, u.last_sign_in_at;

-- Grant permissions to authenticated users
GRANT SELECT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;
GRANT SELECT ON usage_tracking TO authenticated;
GRANT SELECT ON secure_user_stats TO authenticated;

-- Grant permissions to service role
GRANT ALL ON users TO service_role;
GRANT ALL ON usage_tracking TO service_role;
GRANT SELECT ON secure_user_stats TO service_role;

-- Create function to safely insert/update user from auth
CREATE OR REPLACE FUNCTION public.handle_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  user_avatar_url TEXT;
  google_user_id TEXT;
BEGIN
  -- Extract user data from auth.users
  user_email := NEW.email;
  user_full_name := NEW.raw_user_meta_data->>'full_name';
  user_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  google_user_id := NEW.raw_user_meta_data->>'provider_id';

  -- Insert or update user in public.users table
  INSERT INTO public.users (id, email, full_name, avatar_url, google_id, last_sign_in_at)
  VALUES (NEW.id, user_email, user_full_name, user_avatar_url, google_user_id, NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    google_id = EXCLUDED.google_id,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync auth.users with public.users
-- Note: This trigger would be created on auth.users if we had access
-- For now, we'll handle this in the application layer

-- Create function to track usage
CREATE OR REPLACE FUNCTION public.track_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_text_length INTEGER DEFAULT 0,
  p_tokens_used INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_id UUID;
BEGIN
  -- Validate action type
  IF p_action_type NOT IN ('correction_request', 'text_processed', 'api_call') THEN
    RAISE EXCEPTION 'Invalid action_type: %', p_action_type;
  END IF;

  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Insert usage record
  INSERT INTO usage_tracking (user_id, action_type, text_length, tokens_used, metadata)
  VALUES (p_user_id, p_action_type, p_text_length, p_tokens_used, p_metadata)
  RETURNING id INTO usage_id;

  RETURN usage_id;
END;
$$;

-- Grant execute permission on tracking function
GRANT EXECUTE ON FUNCTION public.track_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_usage TO service_role;

-- Comments for documentation
COMMENT ON POLICY "Users can read own profile" ON users IS 'Allow users to read their own profile data';
COMMENT ON POLICY "Users can update own profile" ON users IS 'Allow users to update their own profile';
COMMENT ON POLICY "Service role can insert users" ON users IS 'Allow service role to create users during signup';
COMMENT ON POLICY "Users cannot delete accounts" ON users IS 'Prevent regular users from deleting accounts';

COMMENT ON POLICY "Users can read own usage" ON usage_tracking IS 'Allow users to read their own usage statistics';
COMMENT ON POLICY "Service role can insert usage" ON usage_tracking IS 'Allow service role to track usage';
COMMENT ON POLICY "Users cannot update usage records" ON usage_tracking IS 'Prevent modification of usage records';
COMMENT ON POLICY "Users cannot delete usage records" ON usage_tracking IS 'Prevent deletion of usage records';

COMMENT ON FUNCTION auth.user_id() IS 'Extract user ID from JWT token claims';
COMMENT ON FUNCTION auth.authenticated() IS 'Check if current user is authenticated';
COMMENT ON FUNCTION auth.user_role() IS 'Get current user role from JWT claims';
COMMENT ON FUNCTION public.track_usage IS 'Safely track user API usage with validation';

COMMENT ON VIEW secure_user_stats IS 'User statistics view that respects RLS policies';