# 🚀 Zeabur Deployment Guide

## 🔧 環境變數設定

### 必須設定的環境變數

在 Zeabur 控制台的 **Environment Variables** 頁面中設定以下變數：

#### 1. JWT_SECRET (必須)
```bash
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
```
**說明**：用於 JWT token 簽名，必須至少 32 字元
**生成建議**：
- 使用 `openssl rand -base64 32` 生成
- 或使用線上生成器：https://randomkeygen.com/
- 範例：`JWT_SECRET=A8f9Kj3mP7qR2sT6uV9yB4cD8eF1gH5i9jK2l3M6n7P`

#### 2. OPENAI_API_KEY (必須)
```bash
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```
**說明**：OpenAI API 金鑰，格式為 `sk-` 或 `sk-proj-` 開頭
**獲取方式**：
1. 前往 https://platform.openai.com/api-keys
2. 點擊 "Create new secret key"
3. 複製生成的金鑰

### 建議設定的環境變數

#### 3. NODE_ENV
```bash
NODE_ENV=production
```

#### 4. PORT
```bash
PORT=3000
```

#### 5. CORS_ORIGIN
```bash
CORS_ORIGIN=https://your-frontend-domain.zeabur.app
```
**重要**：部署前端後，需要將此值更新為前端的實際域名

### 可選設定的環境變數

#### 6. RATE_LIMIT_WINDOW_MS
```bash
RATE_LIMIT_WINDOW_MS=900000
```
**說明**：速率限制時間窗口（毫秒），預設 15 分鐘

#### 7. RATE_LIMIT_MAX_REQUESTS
```bash
RATE_LIMIT_MAX_REQUESTS=100
```
**說明**：時間窗口內最大請求數

#### 8. LOG_LEVEL
```bash
LOG_LEVEL=info
```
**說明**：日誌級別，可選值：error, warn, info, debug

## 📝 Zeabur 部署步驟

### 1. 創建後端服務
1. 登入 Zeabur 控制台
2. 創建新專案或選擇現有專案
3. 點擊 "Add Service" → "Git Service"
4. 選擇 `circleghost/text-correction-backend` repository
5. Zeabur 應該自動識別為 **Node.js** 專案

### 2. 設定環境變數
1. 在服務面板中點擊 "Environment Variables"
2. 添加上述必須和建議的環境變數
3. 點擊 "Save" 保存設定

### 3. 部署服務
1. 服務會自動開始部署
2. 等待部署完成（通常 2-5 分鐘）
3. 部署成功後會顯示服務 URL

### 4. 驗證部署
訪問 `https://your-backend-domain.zeabur.app/health` 確認服務正常運行

## 🔍 常見問題

### Q: 服務啟動失敗，顯示 "JWT_SECRET is required"
**A**: 確保在 Zeabur 環境變數中正確設定了 `JWT_SECRET`，且長度至少 32 字元

### Q: 服務啟動失敗，顯示 "OPENAI_API_KEY is required"
**A**: 確保在 Zeabur 環境變數中正確設定了 `OPENAI_API_KEY`，格式為 `sk-` 開頭

### Q: 前端無法連接後端 API
**A**: 檢查 `CORS_ORIGIN` 是否設定為正確的前端域名

### Q: API 回應速度慢
**A**: 可能是冷啟動問題，多次請求後速度會提升

## 🌐 前端配置

部署成功後，需要更新前端的環境變數：

```bash
VITE_API_BASE_URL=https://your-backend-domain.zeabur.app/api/v1
```

## 📊 監控和日誌

- **健康檢查**：`https://your-domain.zeabur.app/health`
- **API 文檔**：`https://your-domain.zeabur.app/api-docs`
- **日誌查看**：在 Zeabur 控制台的 "Logs" 頁面

## 🔒 安全注意事項

1. **JWT_SECRET**：使用強密碼，定期輪換
2. **API 金鑰**：妥善保管 OpenAI API 金鑰，不要洩露
3. **CORS**：只允許信任的域名訪問
4. **環境變數**：不要將敏感資訊提交到 Git

---

🤖 **Generated with [Claude Code](https://claude.ai/code)**