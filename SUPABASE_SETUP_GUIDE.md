# Supabase 設置完整指南

## 📋 設置步驟總覽

1. **建立 Supabase 專案**
2. **執行資料庫遷移**（兩個 SQL 檔案）
3. **建立 Database Trigger**
4. **設定 Google OAuth**
5. **取得 API 金鑰**
6. **更新環境變數**

---

## 第一步：建立 Supabase 專案

1. 前往 https://supabase.com
2. 註冊/登入後點擊 "New Project"
3. 選擇組織
4. 填寫專案設定：
   - **Name**: text-correction-backend
   - **Database Password**: 設定一個強密碼（請妥善保存）
   - **Region**: 選擇離您最近的區域（建議 Tokyo 或 Singapore）
5. 點擊 "Create new project"
6. 等待專案建立完成（約2-3分鐘）

---

## 第二步：執行資料庫遷移

### 2.1 執行基礎架構 SQL

1. 在 Supabase Dashboard 點擊左側 **SQL Editor**
2. 點擊 **New query**
3. 將以下 SQL 複製貼上並執行：

```sql
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
```

4. 點擊 **Run** 執行

### 2.2 執行 RLS 安全政策 SQL

1. 在 SQL Editor 建立新查詢
2. 將以下 SQL 複製貼上並執行：

```sql
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
```

3. 點擊 **Run** 執行

---

## 第三步：建立 Database Trigger

1. 點擊左側 **Database**
2. 選擇 **Triggers** 分頁
3. 點擊 **Create a new trigger**
4. 填寫設定：
   - **Name**: `on_auth_user_created`
   - **Table**: `auth.users`
   - **Events**: 勾選 `INSERT`
   - **Type**: `after`
   - **Function to trigger**: 選擇 `public.handle_new_user()`
5. 點擊 **Create trigger**

---

## 第四步：Google Cloud Console 設定

### 4.1 建立 Google Cloud 專案

1. 前往 https://console.cloud.google.com
2. 點擊專案選擇器，建立新專案或選擇現有專案
3. 輸入專案名稱：`text-correction-app`

### 4.2 啟用 Google+ API

1. 在 Google Cloud Console 中，前往 **APIs & Services** > **Library**
2. 搜尋 "Google+ API"
3. 點擊並啟用

### 4.3 建立 OAuth 2.0 憑證

1. 前往 **APIs & Services** > **Credentials**
2. 點擊 **Create Credentials** > **OAuth client ID**
3. 如果提示需要設定 OAuth consent screen，先完成設定：
   - **User Type**: External
   - **App name**: Text Correction App
   - **User support email**: 您的郵件
   - **Developer contact information**: 您的郵件
4. 回到建立 OAuth client ID：
   - **Application type**: Web application
   - **Name**: Text Correction Backend
   - **Authorized redirect URIs**: 稍後從 Supabase 取得

### 4.4 取得重定向 URI

1. 回到 Supabase Dashboard
2. 點擊左側 **Authentication**
3. 選擇 **Providers** 分頁
4. 找到 **Google** provider
5. 複製 **Callback URL** (格式類似：`https://xxxxx.supabase.co/auth/v1/callback`)

### 4.5 完成 Google OAuth 設定

1. 回到 Google Cloud Console
2. 在 OAuth client ID 設定中，將剛複製的 Callback URL 加到 **Authorized redirect URIs**
3. 儲存設定
4. 複製 **Client ID** 和 **Client Secret**

---

## 第五步：在 Supabase 設定 Google OAuth

1. 回到 Supabase Dashboard > **Authentication** > **Providers**
2. 找到 **Google** 並點擊設定
3. 填寫：
   - **Enable Google provider**: 開啟
   - **Client ID**: 從 Google Cloud Console 複製的 Client ID
   - **Client Secret**: 從 Google Cloud Console 複製的 Client Secret
4. 點擊 **Save**

---

## 第六步：取得 Supabase API 金鑰

1. 在 Supabase Dashboard 點擊左側 **Settings**
2. 選擇 **API** 分頁
3. 複製以下資訊：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGc...`
   - **service_role** key: `eyJhbGc...`（⚠️ 請保密）

---

## 第七步：更新環境變數

在您的專案根目錄，複製 `.env.example` 為 `.env`，並更新以下數值：

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth Configuration
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-oauth-client-secret
```

---

## 🔍 連線測試

完成設定後，可以測試連線：

```bash
cd /Users/circleghost/Desktop/Vibe\ Project/text-correction-backend-auth-worktree
npm run dev
```

檢查是否有連線錯誤訊息，如果看到類似以下的成功訊息：
- ✅ Supabase client initialized successfully
- ✅ Google OAuth client initialized successfully

表示設定完成！

---

## ⚠️ 重要提醒

1. **保密資訊**：Service Role Key 絕對不可洩露，只能在後端使用
2. **測試環境**：建議先在開發環境測試所有功能正常後再設定生產環境
3. **備份**：請備份您的 `.env` 檔案，但不要提交到 git
4. **權限**：確保 RLS 政策正常運作，使用者只能存取自己的資料

完成後請提供您的連線資訊，我會協助您進行下一步整合！