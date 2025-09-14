---
name: Auth + Usage Tracking
description: 基於 Google OAuth 和 Supabase 的認證與使用量追蹤系統，為中文文字校正平台建立使用者管理和配額控制
status: backlog
created: 2025-09-12T07:28:37Z
updated: 2025-09-13T01:00:00Z
---

# PRD: 認證 + 使用量追蹤系統

## 執行摘要

本 PRD 概述了為我們的中文文字校正平台實施認證和使用量追蹤系統。系統將把目前的開放存取工具轉型為具備使用者管理和配額控制的平台，為未來的商業化功能奠定基礎。

**核心技術架構：**
- **Google OAuth 2.0**: 主要身份認證方式，提供無縫登入體驗
- **Supabase**: 後端即服務平台，整合認證、資料庫、即時功能
- **PostgreSQL**: Supabase 託管的資料庫，用於使用者資料和使用量資訊
- **使用量追蹤**: 即時監控和配額管理系統

**核心價值主張：**
- 透過 Google 帳號提供專業且安全的使用者管理
- 免費方案提供合理的使用限制
- 即時使用量追蹤和分析
- 為未來付費功能預留擴展性

## 問題陳述

### 現況分析
- 文字校正平台目前以匿名方式運作，沒有使用者帳號系統
- 使用量無法控管，可能導致濫用和高昂的營運成本
- 沒有使用者資料或使用洞察來改善產品
- 缺乏個人化功能和使用歷史追蹤

### 為什麼是現在？
- 平台已證實技術功能性和市場需求
- 需要控制 AI 服務成本（OpenAI API 使用費用）
- 日益增長的使用者群需要專業的使用者管理和公平使用政策
- 為未來的商業化功能建立基礎架構

## 使用者故事

### 主要使用者角色

#### **角色 1: 個人專業用戶**
- **身份**: 內容創作者、作家、編輯、學生
- **需求**: 定期文字校正、文件整合、個人使用量追蹤
- **痛點**: 成本效益解決方案、可靠服務、隱私保護

#### **角色 2: 團隊商業用戶**  
- **身份**: 行銷團隊、翻譯機構、內容公司
- **需求**: 團隊協作、更高使用限制、發票管理
- **痛點**: 團隊管理、使用量分配、預算控制

#### **角色 3: 企業用戶**
- **身份**: 大型組織、教育機構
- **需求**: 單一登入、客製化整合、合規功能
- **痛點**: 安全要求、大量定價、服務級別協議

#### **角色 4: 系統管理員**
- **身份**: 平台營運商和支援團隊
- **需求**: 使用者管理、使用量監控、配額管理
- **痛點**: 詐欺檢測、客戶支援、系統健康監控

### 詳細使用者旅程

#### 旅程 1: 新用戶註冊與首次使用
```
身為新用戶
我希望能快速註冊並試用服務
以便評估是否符合我的需求

驗收標準:
- 註冊流程少於 2 分鐘
- Google 帳號一鍵登入
- 透過 Supabase Auth 安全處理身份驗證
- 免費方案提供有意義的試用體驗（每月 50 次校正）
- 流暢的引導流程解釋核心功能
- Google Docs 整合在註冊後立即可用
```

#### 旅程 2: 使用量限制提醒
```
身為接近免費額度限制的用戶
我希望能清楚了解我的使用量狀況
以便合理安排剩餘的使用次數

驗收標準:
- 接近使用限制時明確通知（剩餘 10 次時）
- 清楚顯示當月使用進度
- 說明限制重置的時間
- 提供使用歷史查看功能
- 友善的限制說明而非強制升級
```

#### 旅程 3: 使用量監控
```
身為註冊用戶
我希望監控我的使用量並了解使用模式
以便更有效地利用我的免費額度

驗收標準:
- 即時使用量儀表板顯示當月進度
- 歷史使用趨勢和分析
- 按功能分類的使用量明細（校正、Google Docs 匯入）
- 清楚標示當前限制和重置時間
- 個人使用洞察和建議
```

## 需求規格

### 功能需求

#### 認證系統
**Google OAuth 整合**
- 主要使用 Google OAuth 2.0 進行身份認證
- 透過 Supabase Auth 處理 OAuth 流程
- 支援多個 Google 帳號綁定（工作和個人帳號）
- 用戶資料自動從 Google 帳號同步（姓名、電子郵件、頭像）

**Supabase 身份管理**
- 使用 Supabase Auth 作為認證服務
- 整合 Row Level Security (RLS) 保護用戶資料
- 支援多種 OAuth 提供商（未來擴展）
- 自動處理 JWT 令牌生成和管理

**會話管理**
- Supabase 自動處理安全會話管理
- 支援跨裝置會話同步
- 自動刷新令牌機制
- 30 天記住登入狀態

#### 免費方案配額管理

**方案定義**
- 每月 50 次校正
- 基礎文字校正功能
- Google Docs 整合
- 使用量統計和分析
- 社群支援

**配額管理**
- 每月自動重置使用量（每月 1 日）
- 達到限制時優雅提醒
- 不強制付費，提供友善說明
- 保留使用歷史記錄
- 為未來擴展預留設計

#### 使用量追蹤系統
**指標收集**
- 文字校正次數（按字元和請求計算）
- Google Docs 匯入次數和資料量
- API 呼叫次數（商業/企業方案）
- 處理時間和回應時間
- 錯誤率和錯誤類型

**使用量控管**
- 處理前即時配額檢查
- 達到限制時優雅降級
- 月度週期開始時重置使用量
- 超額處理包含警告和封鎖機制

**分析儀表板**
- 當前月度週期使用量摘要
- 每日/每週/每月使用趨勢
- 功能使用量明細
- 成本分析和節費建議
- 匯出功能（CSV、PDF 報告）

## Supabase 資料庫架構

### 核心資料表

#### **使用者管理**

**`auth.users` (Supabase 內建)**
```sql
-- Supabase Auth 內建表，處理基本認證
id: UUID (Primary Key)
email: VARCHAR
encrypted_password: VARCHAR
created_at: TIMESTAMPTZ
updated_at: TIMESTAMPTZ
email_confirmed_at: TIMESTAMPTZ
last_sign_in_at: TIMESTAMPTZ
raw_app_meta_data: JSONB
raw_user_meta_data: JSONB
```

**`user_profiles` (自訂表)**
```sql
-- 擴展使用者資訊
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  google_email TEXT,
  display_name TEXT,
  language_preference TEXT DEFAULT 'zh-TW',
  timezone TEXT DEFAULT 'Asia/Taipei',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **使用者方案管理**

**`user_plan` (使用者方案)**
```sql
-- 使用者方案狀態（目前僅免費方案）
CREATE TABLE user_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'free', -- 目前僅 'free'
  corrections_limit INTEGER NOT NULL DEFAULT 50, -- 每月校正次數限制
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id) -- 每個使用者只能有一個方案
);
```

#### **使用量追蹤**

**`usage_quotas` (配額管理)**
```sql
-- 使用者當前配額狀態
CREATE TABLE usage_quotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  period_start DATE NOT NULL, -- 月度週期開始
  period_end DATE NOT NULL, -- 月度週期結束
  corrections_used INTEGER DEFAULT 0,
  corrections_limit INTEGER NOT NULL,
  google_docs_imports INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period_start) -- 每個用戶每個週期唯一
);
```

**`usage_logs` (使用記錄)**
```sql
-- 詳細使用記錄
CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL, -- 'text_correction', 'google_docs_import', 'api_call'
  resource_id TEXT, -- 相關資源 ID
  characters_processed INTEGER,
  processing_time_ms INTEGER,
  cost_cents INTEGER, -- OpenAI API 成本（分為單位）
  metadata JSONB, -- 額外資訊
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **校正歷史**

**`correction_sessions` (校正會話)**
```sql
-- 校正會話記錄
CREATE TABLE correction_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  source_type TEXT NOT NULL, -- 'direct_text', 'google_docs'
  source_url TEXT, -- Google Docs URL（如果適用）
  original_text TEXT NOT NULL,
  corrected_text TEXT,
  corrections_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**`text_corrections` (具體校正)**
```sql
-- 個別校正記錄
CREATE TABLE text_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES correction_sessions(id) NOT NULL,
  paragraph_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  correction_type TEXT, -- 'grammar', 'punctuation', 'style', 'spelling'
  confidence_score DECIMAL(3,2), -- 0.00-1.00
  start_position INTEGER,
  end_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```


#### **系統記錄**

**`audit_logs` (稽核日誌)**
```sql
-- 系統稽核日誌
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'login', 'logout', 'subscription_change', 'payment'
  resource_type TEXT, -- 'user', 'subscription', 'payment'
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS) 政策

#### **使用者資料保護**
```sql
-- user_profiles RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能查看自己的資料" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "用戶只能更新自己的資料" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

#### **方案資料保護**
```sql
-- user_plan RLS
ALTER TABLE user_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能查看自己的方案" ON user_plan
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用戶只能更新自己的方案" ON user_plan
  FOR UPDATE USING (auth.uid() = user_id);
```

#### **使用量資料保護**
```sql
-- usage_quotas RLS
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能查看自己的配額" ON usage_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- usage_logs RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能查看自己的使用記錄" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);
```

#### **校正歷史保護**
```sql
-- correction_sessions RLS
ALTER TABLE correction_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能存取自己的校正會話" ON correction_sessions
  FOR ALL USING (auth.uid() = user_id);

-- text_corrections RLS
ALTER TABLE text_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用戶只能存取自己的校正記錄" ON text_corrections
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM correction_sessions 
      WHERE id = text_corrections.session_id
    )
  );
```

### Supabase Edge Functions

#### **使用量計算函數**
```sql
-- 計算使用者當月使用量
CREATE OR REPLACE FUNCTION get_user_current_usage(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'corrections_used', COALESCE(corrections_used, 0),
    'corrections_limit', COALESCE(corrections_limit, 0),
    'google_docs_imports', COALESCE(google_docs_imports, 0),
    'period_start', period_start,
    'period_end', period_end
  ) INTO result
  FROM usage_quotas
  WHERE user_id = user_uuid
    AND period_start <= CURRENT_DATE
    AND period_end >= CURRENT_DATE;
    
  RETURN COALESCE(result, '{"error": "No active quota found"}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **配額檢查函數**
```sql
-- 檢查使用者是否可以執行動作
CREATE OR REPLACE FUNCTION check_user_quota(
  user_uuid UUID, 
  action_type TEXT,
  requested_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
BEGIN
  -- 獲取當前使用量和限制
  SELECT 
    CASE 
      WHEN action_type = 'text_correction' THEN corrections_used
      WHEN action_type = 'google_docs_import' THEN google_docs_imports
      ELSE 0
    END,
    CASE 
      WHEN action_type = 'text_correction' THEN corrections_limit
      ELSE 999999 -- 其他動作暫時無限制
    END
  INTO current_usage, usage_limit
  FROM usage_quotas
  WHERE user_id = user_uuid
    AND period_start <= CURRENT_DATE
    AND period_end >= CURRENT_DATE;
    
  -- 檢查是否超過限制
  RETURN (current_usage + requested_amount) <= usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 資料庫索引優化

```sql
-- 效能優化索引
CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_correction_sessions_user_created ON correction_sessions(user_id, created_at DESC);
CREATE INDEX idx_usage_quotas_user_period ON usage_quotas(user_id, period_start, period_end);
CREATE INDEX idx_user_plan_user_status ON user_plan(user_id, status);
CREATE INDEX idx_text_corrections_session ON text_corrections(session_id);
```

### 非功能需求

#### 安全性
- Supabase 內建安全功能（加密、驗證、權限控制）
- 所有端點強制 HTTPS 加密
- JWT 令牌短期效期（15 分鐘存取、7 天刷新）
- 認證端點速率限制（每分鐘 5 次嘗試）
- GDPR 合規（歐盟使用者）
- 敏感資料静態加密

#### 效能表現  
- 認證回應時間 <200ms（95th 百分位數）
- 使用配額檢查 <50ms（99th 百分位數）
- 儀表板載入時間 <1 秒
- 使用量更新即時性 <1 秒
- 系統整體 99.5% 運行時間

#### 可擴展性
- 支援 10,000+ 併發使用者
- 資料庫設計支援水平擴展
- 無狀態認證支援負載平衡
- 快取層支援常用資料（Supabase Edge Functions）
- 背景使用量處理佇列系統

#### 資料隱私與合規
- 使用者資料保存政策（使用量資料 1 年，應要求立即刪除）
- 資料可攜帶性（使用者可匯出所有資料）
- 被遺忘權實現
- 所有使用事件的稽核日誌
- 定期安全評估和渗透測試

## 成功標準

### 使用者採用指標
- **使用者註冊**: 每月 1,000+ 新註冊用戶
- **使用者留存**: 60% 用戶 30 天後仍活躍
- **功能採用**: 80% 使用者嘗試 Google Docs 整合
- **使用量成長**: 總校正次數每月 25% 成長
- **滿意度**: 用戶滿意度評分 >4.0/5.0

### 產品功能指標
- **配額使用率**: 平均用戶使用 70% 月度配額
- **Google Docs 使用率**: 40% 註冊用戶使用 Google Docs 功能
- **會話完成率**: 90% 校正會話成功完成
- **錯誤率**: <1% API 呼叫失敗率
- **客服效率**: 平均回應時間 <4 小時

### 技術指標
- **系統可用性**: 99.9% 運行時間
- **認證成功率**: >99.5%
- **資料同步成功率**: >99.5%
- **頁面載入時間**: 平均 <2 秒
- **API 回應時間**: 所有端點 <500ms

## 限制條件與假設

### 技術限制
- 必須與現有 Node.js/Express 後端整合
- 使用 Supabase PostgreSQL 資料庫儲存使用者和使用量資料
- 現有 React 前端需要最少修改以整合 Google OAuth
- OpenAI API 成本需要透過使用量控制管理
- 依賴 Supabase 服務可用性和擴展能力

### 商業限制
- 2 個月內發布 MVP
- 初期實作預算 NT$800,000
- 團隊：2 名全端開發者 + 1 名設計師
- 推廣活動預算 NT$200,000

### 法規限制
- GDPR 合規（歐盟使用者）
- 加州消費者隱私法案 (CCPA) 合規
- 服務條款和隱私政策必須完整
- 使用者資料保護和刪除權利

### 假設
- 使用者願意註冊帳戶以使用文字校正功能
- Google Docs 整合是強力差異化功能
- 中文市場對文字工具有足夠需求
- 免費配額足以吸引用戶註冊
- 支援量可透過自助服務選項管理
- Supabase 提供足夠的技術支援和服務穩定性

## 範圍外項目

### 1.0 版本排除項目
- 行動應用程式（iOS/Android 原生）
- 進階團隊協作功能（評論、共享工作區）
- 白牌或經銷商方案
- 進階報告和分析（超出基本使用統計）
- 與其他文件平台整合（Microsoft Office、Notion）
- 中英文以外的多語言支援
- 進階工作流程自動化
- 客製化 AI 模型訓練

### 未來考慮項目
- 企業 SSO 整合（SAML、OIDC）
- 進階安全功能（IP 限制、稽核日誌）
- API 速率限制客製化
- Webhook 整合
- 付費訂閱功能和計費系統（未來階段）

## 依賴關係

### 外部依賴
- **Supabase**: 核心認證和資料庫服務
- **電子郵件服務提供商**: SendGrid 或 AWS SES 用於通知郵件
- **分析平台**: Google Analytics 用於使用者行為追蹤
- **錯誤監控**: Sentry 用於錯誤追蹤和監控
- **CDN 服務**: Supabase Edge 或 Cloudflare 用於靜態資源

### 內部依賴
- **後端團隊**: 使用者管理 API 開發
- **前端團隊**: 認證 UI 和儀表板實作  
- **DevOps 團隊**: 基礎設施設定和監控
- **法務團隊**: 服務條款、隱私政策、合規審查
- **客戶支援**: 支援流程設定和訓練

### 第三方整合
- **Google OAuth API**: 社群登入功能
- **Google Docs API**: 現有整合必須與認證使用者配合
- **OpenAI API**: 使用量追蹤和成本控制
- **Supabase API**: 認證、資料庫和即時功能

## 實作階段

### 階段 1: Supabase 認證基礎 (4 週)
- Supabase 專案設定和配置
- Google OAuth 整合透過 Supabase Auth
- 基本使用者檔案管理
- 前端 Supabase 客戶端整合
- Row Level Security (RLS) 政策設定

### 階段 2: 使用量追蹤系統 (3 週)
- 使用量指標收集系統
- 配額管理和強制執行
- 使用量歷史記錄
- 基本使用量儀表板
- 使用量限制通知

### 階段 3: 進階使用量功能 (3 週)
- 即時使用量儀表板
- 使用量分析和報告
- 與現有校正 API 整合
- 使用量歷史和趨勢分析
- 配額重置自動化

### 階段 4: 增強功能 (2 週)
- 進階分析儀表板
- 電子郵件通知和警報
- 客戶支援工具
- 效能優化
- Supabase Edge Functions 整合

### 階段 5: 上線準備 (1 週)
- 安全審計和測試
- 負載測試和優化
- 文件和訓練
- 行銷材料準備
- 上市策略執行

## 風險評估

### 高風險項目
- **Supabase 依賴性**: 對 Supabase 服務可用性和性能的依賴
- **使用量計算複雜性**: 精確的使用量追蹤和配額計算
- **資料遷移**: 現有匿名使用者無法遷移
- **效能影響**: 每次 API 呼叫的認證檢查
- **外部服務依賴**: 主要依賴 Supabase 服務穩定性

### 中等風險項目
- **使用者採用**: 用戶可能不願意註冊帳戶
- **配額設計**: 免費配額可能過高或過低
- **支援量**: 超出預期的支援請求
- **技術債務**: 與現有程式碼庫整合可能需要重構
- **Supabase 學習曲線**: 團隊對 Supabase 平台的熟悉度

### Supabase 特定優勢
- **簡化認證**: Supabase 自動處理 OAuth 和 JWT 令牌管理
- **即時資料庫**: 支援即時使用量更新和通知
- **減少開發時間**: 內建認證、資料庫和 API 功能
- **稅務處理**: 自動計算和繳納全球稅務（VAT、GST 等）
- **客戶支援**: Paddle 提供客戶端付款支援

### 風險緩解策略
- 為 Paddle webhook 和付款流程實作全面測試
- 建立 Paddle 沙盒環境進行完整測試
- 為使用者建立詳細的遷移指南和流程
- 使用快取和優化來提升認證效能
- Paddle 自動處理大部分合規要求，減少法律風險
- 在全面推出前 A/B 測試定價策略和支付流程
- 實作自助服務功能以減少支援負載
- 建立 Supabase 和 Paddle 的備份和災難復原計畫
- 設立 Paddle 緊急聯絡機制和支援渠道

---

*此 PRD 作為在現有文字校正技術基礎上實作完整商業平台的基礎文件。成功取決於在使用者體驗、技術卓越性和商業可行性之間取得平衡。*