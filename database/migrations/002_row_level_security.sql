-- Row Level Security policies for user data protection
-- 修正版：使用 Supabase 內建的 auth.uid() 函數，避免權限問題

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users table RLS policies
-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Allow user creation during signup
CREATE POLICY "Enable insert for authenticated users only" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Prevent user deletion for regular users
CREATE POLICY "Users cannot delete accounts" ON users
  FOR DELETE
  USING (false);

-- Usage tracking table RLS policies
-- Policy: Users can read their own usage data
CREATE POLICY "Users can read own usage" ON usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own usage" ON usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Prevent users from modifying usage records
CREATE POLICY "Users cannot update usage records" ON usage_tracking
  FOR UPDATE
  USING (false);

-- Policy: Prevent users from deleting usage records
CREATE POLICY "Users cannot delete usage records" ON usage_tracking
  FOR DELETE
  USING (false);

-- Create secure view for user stats (respects RLS)
CREATE OR REPLACE VIEW secure_user_stats AS
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
WHERE u.id = auth.uid() -- 使用 Supabase 內建函數
GROUP BY u.id, u.email, u.full_name, u.avatar_url, u.created_at, u.last_sign_in_at;

-- Create function to safely insert/update user from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, last_sign_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    last_sign_in_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
-- 注意：這個需要在 Supabase Dashboard 的 Database > Triggers 中手動建立
-- Trigger name: on_auth_user_created
-- Table: auth.users
-- Events: INSERT
-- Function: public.handle_new_user()

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

-- Comments for documentation
COMMENT ON POLICY "Users can read own profile" ON users IS 'Allow users to read their own profile data';
COMMENT ON POLICY "Users can update own profile" ON users IS 'Allow users to update their own profile';
COMMENT ON POLICY "Enable insert for authenticated users only" ON users IS 'Allow users to create their own profile during signup';
COMMENT ON POLICY "Users cannot delete accounts" ON users IS 'Prevent regular users from deleting accounts';

COMMENT ON POLICY "Users can read own usage" ON usage_tracking IS 'Allow users to read their own usage statistics';
COMMENT ON POLICY "Users can insert own usage" ON usage_tracking IS 'Allow users to track their own usage';
COMMENT ON POLICY "Users cannot update usage records" ON usage_tracking IS 'Prevent modification of usage records';
COMMENT ON POLICY "Users cannot delete usage records" ON usage_tracking IS 'Prevent deletion of usage records';

COMMENT ON FUNCTION public.handle_new_user() IS 'Sync auth.users with public.users table';
COMMENT ON FUNCTION public.track_usage IS 'Safely track user API usage with validation';

COMMENT ON VIEW secure_user_stats IS 'User statistics view that respects RLS policies';