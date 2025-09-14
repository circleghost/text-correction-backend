---
name: Billing + Subscription
description: 基於 Paddle Billing 的完整付費訂閱和計費系統，為中文文字校正平台實現商業化
status: backlog
created: 2025-09-13T01:00:00Z
updated: 2025-09-13T01:00:00Z
---

# PRD: 付費訂閱與計費系統

## 執行摘要

本 PRD 概述了為中文文字校正平台實施完整的付費訂閱和計費系統。此系統將在現有認證和使用量追蹤系統的基礎上，加入商業化功能，實現可持續的營收模式。

**核心技術架構：**
- **Paddle Billing**: 付款處理、訂閱管理和全球稅務處理
- **Supabase**: 擴展資料庫以支援計費相關資料
- **多幣別支援**: USD、EUR、TWD、JPY 等
- **全球稅務自動化**: VAT、GST、銷售稅自動處理

**核心價值主張：**
- 彈性的訂閱方案服務不同市場區隔
- 全球化付款和稅務處理
- 無縫升級降級體驗
- 透明的計費和發票管理

## 問題陳述

### 現況分析
- 平台已實現認證和使用量追蹤，但缺乏營收機制
- 需要支持持續開發和基礎設施成本
- 使用者已習慣免費額度，需要平滑過渡到付費方案
- 全球用戶需要本地化的付款和稅務處理

### 商業需求
- 建立可持續的收入來源支付 OpenAI API 成本
- 為高用量使用者提供更多服務價值
- 實現企業級功能和支援
- 滿足不同市場區隔的需求

## 使用者故事

### 付費相關使用者旅程

#### 旅程 1: 免費用戶升級
```
身為達到免費額度限制的用戶
我希望能輕鬆升級到付費方案
以便繼續使用服務而不中斷工作流程

驗收標準:
- 接近限制時提前通知（剩餘 10 次時）
- 清楚展示各方案的價值差異
- 一鍵升級流程
- 多種付款方式選擇
- 立即生效，無需等待
```

#### 旅程 2: 企業用戶採購
```
身為需要為團隊採購服務的企業用戶
我希望有簡化的企業採購流程
以便合規地為公司購買服務

驗收標準:
- 支援公司發票和採購訂單
- 年度付款折扣選項
- 團隊成員管理功能
- 統一帳單和費用控制
- 企業級支援和 SLA
```

#### 旅程 3: 國際用戶付款
```
身為海外用戶
我希望用本地貨幣和付款方式結帳
以便避免匯率和手續費問題

驗收標準:
- 自動檢測用戶地區
- 顯示本地貨幣價格
- 支援當地常用付款方式
- 自動處理當地稅務
- 本地語言的收據和發票
```

## 需求規格

### 功能需求

#### 訂閱方案管理

**方案定義**

**免費方案**
- 每月 50 次校正
- 基礎文字校正功能
- 社群支援
- 基本使用統計

**專業方案 (NT$299/月, $9.99/月)**
- 每月 2,000 次校正
- Google Docs 完整整合
- 優先處理
- 電子郵件 + 即時客服
- 進階使用分析
- API 存取（限制額度）

**商業方案 (NT$899/月, $29.99/月)**
- 每月 10,000 次校正
- 團隊管理（最多 5 位使用者）
- 客製化整合
- 優先支援
- 進階分析儀表板
- API 存取（較高額度）
- 團隊使用量分析

**企業方案 (客製化定價)**
- 無限制校正次數
- SSO 整合
- 客製化部署選項
- 專屬客戶成功經理
- SLA 保證（99.9% 可用性）
- 客製化 API 額度
- 私有雲部署選項

#### Paddle Billing 整合

**付款處理**
- 支援多種付款方式：
  - 信用卡（Visa, MasterCard, American Express）
  - PayPal
  - Apple Pay
  - Google Pay
  - 銀行轉帳（部分地區）
- 自動處理全球稅務（VAT、GST、銷售稅）
- 多幣別支援（USD、EUR、TWD、JPY、GBP）
- PCI DSS 合規自動處理
- 3D Secure 安全認證

**訂閱管理**
- 自動續訂功能
- 升級/降級按比例計費
- 7 天免費試用（所有付費方案）
- 30 天滿意保證退款
- 暫停/恢復訂閱功能
- 取消流程含挽留機制

**發票和收據**
- 自動產生符合當地法規的發票
- 實時發送電子收據
- 支援公司採購和發票
- 稅務報告自動生成
- 多語言發票支援

#### 團隊管理功能

**團隊結構**
- 團隊擁有者（Owner）
- 團隊管理員（Admin）
- 團隊成員（Member）
- 邀請和權限管理

**使用量分配**
- 團隊總配額管理
- 個人使用量追蹤
- 配額分配和調整
- 超額使用政策

**帳單管理**
- 統一團隊帳單
- 成本中心分配
- 使用量報告
- 預算控制和警報

### 技術需求

#### Paddle 整合架構

**Webhook 處理**
- 訂閱狀態變更
- 付款成功/失敗
- 發票生成
- 退款處理
- 稅務更新

**API 整合**
- 產品和價格同步
- 訂閱建立和管理
- 付款歷史查詢
- 客戶資料同步
- 使用量報告

**安全考量**
- Webhook 簽名驗證
- API 金鑰安全儲存
- 敏感資料加密
- 稽核日誌記錄

#### 資料庫擴展

**計費相關資料表**

**`subscription_plans` (產品方案)**
```sql
CREATE TABLE subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- 'free', 'pro', 'business', 'enterprise'
  display_name TEXT NOT NULL,
  price_monthly INTEGER, -- 價格（分為單位）
  price_yearly INTEGER,
  corrections_limit INTEGER,
  features JSONB NOT NULL,
  paddle_product_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`user_subscriptions` (使用者訂閱)**
```sql
CREATE TABLE user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id) NOT NULL,
  paddle_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL, -- 'active', 'cancelled', 'past_due', 'paused'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);
```

**`payments` (付款記錄)**
```sql
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  paddle_payment_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  payment_method TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`invoices` (發票記錄)**
```sql
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  paddle_invoice_id TEXT UNIQUE NOT NULL,
  invoice_number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  tax_amount_cents INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- 'draft', 'sent', 'paid', 'overdue'
  due_date DATE,
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`teams` (團隊管理)**
```sql
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) NOT NULL,
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`team_members` (團隊成員)**
```sql
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  invited_by UUID REFERENCES auth.users(id),
  invitation_status TEXT DEFAULT 'accepted', -- 'pending', 'accepted', 'declined'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(team_id, user_id)
);
```

### 非功能需求

#### 安全性
- Paddle 自動處理 PCI DSS 合規
- Webhook 簽名驗證
- 敏感計費資料加密
- 防詐騙檢測
- 定期安全審計

#### 效能
- 付款處理響應時間 <5 秒
- 訂閱狀態更新即時同步
- 發票生成 <10 秒
- 使用量配額更新 <1 秒

#### 可靠性
- 99.9% 付款處理可用性
- Paddle webhook 重試機制
- 失敗付款自動重試
- 資料備份和恢復

## 成功標準

### 商業指標
- **Monthly Recurring Revenue (MRR)**: 6 個月內達到 NT$300,000
- **免費轉付費轉換率**: >15%
- **客戶流失率**: <5% 月度流失
- **平均每用戶收入 (ARPU)**: >NT$400/月
- **付款成功率**: >98%

### 產品指標
- **升級漏斗轉換率**: 免費→專業 >20%
- **企業方案採用率**: >5% 的付費用戶
- **團隊功能使用率**: >60% 的商業方案用戶
- **客戶滿意度**: NPS >50

### 技術指標
- **付款處理成功率**: >98%
- **Webhook 處理成功率**: >99.5%
- **計費系統可用性**: 99.9%
- **發票生成時間**: <10 秒

## 實作階段

### 階段 1: Paddle 基礎整合 (3 週)
- Paddle 帳號設定和產品配置
- 基本 webhook 處理
- 訂閱建立和管理 API
- 基本付款流程
- 測試環境設定

### 階段 2: 訂閱管理系統 (4 週)
- 使用者訂閱狀態管理
- 升級/降級流程
- 試用期管理
- 取消和恢復功能
- 計費週期處理

### 階段 3: 團隊功能 (3 週)
- 團隊建立和管理
- 成員邀請系統
- 權限和角色管理
- 團隊使用量分配
- 團隊計費

### 階段 4: 發票和報告 (2 週)
- 發票自動生成
- 付款歷史查詢
- 使用量報告
- 稅務報告
- 客戶支援工具

### 階段 5: 上線和優化 (2 週)
- 生產環境部署
- 監控和警報設定
- 效能優化
- 客戶支援流程
- 文檔和訓練

## 風險評估

### 高風險項目
- **Paddle 整合複雜性**: webhook 處理和邊緣情況
- **稅務合規**: 多地區稅務法規變化
- **付款失敗處理**: 客戶流失風險
- **資料同步**: Paddle 和內部系統的一致性

### 中等風險項目
- **用戶接受度**: 免費用戶對付費的抗拒
- **競爭對手**: 類似服務的價格競爭
- **技術債務**: 現有系統的整合複雜度
- **客戶支援**: 計費相關問題處理

### 緩解策略
- **漸進式推出**: 小範圍測試後逐步擴展
- **全面測試**: Paddle 沙盒環境完整測試
- **客戶溝通**: 提前通知和價值說明
- **備用方案**: 手動處理機制準備
- **監控告警**: 即時發現和處理問題

## 依賴關係

### 外部依賴
- **Paddle Billing**: 核心付款和訂閱服務
- **認證系統**: 需要完成的使用者認證功能
- **使用量追蹤**: 現有的配額管理系統
- **電子郵件服務**: 發票和通知發送

### 內部依賴
- **產品團隊**: 定價策略和方案設計
- **法務團隊**: 服務條款和計費政策
- **客戶支援**: 計費問題處理流程
- **財務團隊**: 收入確認和報告

### 先決條件
- 認證和使用量追蹤系統已完成
- Supabase 資料庫架構就緒
- 基本的使用者界面已實作
- 法務文件和定價策略確定

---

*此 PRD 作為在現有認證和使用量追蹤系統基礎上增加商業化功能的指導文件。成功依賴於與現有系統的無縫整合和優秀的用戶體驗。*