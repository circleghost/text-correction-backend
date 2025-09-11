# OpenAI 模型配置文檔

> **更新日期**: 2025-01-11  
> **版本**: 1.0  
> **維護者**: AI Text Correction Backend Team

## 當前使用模型

### 主要模型
- **模型名稱**: `gpt-4.1-nano`
- **API 端點**: `/v1/chat/completions` (標準 OpenAI ChatGPT 端點)
- **請求格式**: `messages` 格式（與 ChatGPT API 相同）
- **用途**: 中文文本錯字檢查和語法修正

### 模型特性
- **語言支援**: 繁體中文、簡體中文
- **任務類型**: 錯字檢查、語法修正、標點符號修正、文字風格優化
- **輸入限制**: 最大 4000 tokens
- **溫度設定**: 0.5 (確保修正的一致性)

## 環境變數配置

### 必須設定
```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

### 可選設定
```bash
OPENAI_MODEL=gpt-4.1-nano  # 如果不設定，會使用預設值
```

## API 調用範例

### 使用 curl 測試
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [
      {"role": "user", "content": "請用繁體中文解釋 RAG 與向量資料庫的關係。"}
    ]
  }'
```

### 程式碼中的使用方式
```typescript
const response = await this.openaiClient.chat.completions.create({
  model: 'gpt-4.1-nano',
  messages: [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userPrompt
    }
  ],
  temperature: 0.5,
  max_tokens: Math.min(4000, Math.max(text.length * 2, 1000)),
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0
});
```

## 成本估算

### gpt-4.1-nano 定價 (參考)
- **輸入 Tokens**: $0.00001 per token
- **輸出 Tokens**: $0.00003 per token

### 典型使用情境
- **100 字中文文本**: 約 300 tokens 輸入 + 350 tokens 輸出 = 約 $0.014
- **500 字中文文本**: 約 1500 tokens 輸入 + 1750 tokens 輸出 = 約 $0.068
- **1000 字中文文本**: 約 3000 tokens 輸入 + 3500 tokens 輸出 = 約 $0.135

## 健康檢查

### 測試 OpenAI 連接
```bash
GET /api/v1/health/openai
```

### 回應格式
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "model": "gpt-4.1-nano",
    "responseTime": "1200ms",
    "testResult": "API connection successful",
    "correctionTest": {
      "input": "測試",
      "output": "測試",
      "correctionsCount": 0
    },
    "timestamp": "2025-01-11T10:30:00.000Z"
  },
  "message": "OpenAI API is healthy",
  "timestamp": "2025-01-11T10:30:00.000Z"
}
```

## 錯誤處理

### 常見錯誤類型
1. **認證錯誤**: API Key 無效或過期
2. **模型不存在**: 指定的模型名稱不正確
3. **超過限制**: Token 數量超過限制
4. **頻率限制**: API 調用過於頻繁
5. **服務不可用**: OpenAI 服務暫時不可用

### 重試機制
- **重試次數**: 最多 3 次
- **重試延遲**: 指數退避（1s, 2s, 4s）
- **可重試錯誤**: 網路錯誤、服務暫時不可用
- **不可重試錯誤**: 認證錯誤、模型不存在

## 監控和日誌

### 日誌內容
- API 調用開始時間和預估 tokens
- API 調用結束時間和實際使用的 tokens
- 成本估算（輸入、輸出、總計）
- 錯誤詳情（包括錯誤類型、狀態碼、重試次數）

### 監控指標
- API 響應時間
- 成功率和錯誤率
- Token 使用量和成本
- 重試次數和原因

## 更新歷史

| 版本 | 日期 | 修改內容 |
|------|------|----------|
| 1.0 | 2025-01-11 | 初始版本，設定 gpt-4.1-nano 為預設模型 |

## 相關資源

- [OpenAI API 文檔](https://platform.openai.com/docs/api-reference)
- [OpenAI 模型列表](https://platform.openai.com/docs/models)
- [OpenAI 定價頁面](https://openai.com/pricing)
- [本專案 API 文檔](http://localhost:3001/api/docs) (開發環境)