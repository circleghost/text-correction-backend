# 部署指南

## 🚀 部署環境要求

### TypeScript 嚴格模式
本專案使用嚴格的 TypeScript 配置，部署環境會強制執行以下規則：

- `exactOptionalPropertyTypes: true` - 精確的可選屬性類型
- `noPropertyAccessFromIndexSignature: true` - 禁止點號訪問索引簽名屬性
- `noUncheckedIndexedAccess: true` - 檢查索引訪問的安全性
- `strict: true` - 啟用所有嚴格類型檢查

## 📋 部署前檢查清單

### 1. TypeScript 編譯檢查
```bash
npm run typecheck
```
**必須通過，無任何錯誤才能部署**

### 2. 代碼風格檢查
```bash
npm run lint
```

### 3. 完整檢查（建議）
```bash
npm run precommit  # 執行 typecheck + lint
```

## 🛠️ 常見問題與解決方案

### 問題 1: `process.env` 屬性訪問錯誤
```typescript
// ❌ 錯誤寫法
const url = process.env.SUPABASE_URL;

// ✅ 正確寫法
const url = process.env['SUPABASE_URL'];
```

### 問題 2: 可選屬性類型不匹配
```typescript
// ❌ 錯誤寫法
interface User {
  name?: string;
}
const user: User = { name: undefined }; // exactOptionalPropertyTypes 錯誤

// ✅ 正確寫法
const user: User = {}; // 不包含可選屬性
// 或
if (nameValue !== undefined) {
  user.name = nameValue;
}
```

### 問題 3: 函數返回類型問題
```typescript
// ❌ 錯誤寫法
async function handler(req, res) {
  if (error) {
    return res.status(400).json({ error });  // 返回類型不匹配 Promise<void>
  }
}

// ✅ 正確寫法
async function handler(req, res): Promise<void> {
  if (error) {
    res.status(400).json({ error });
    return;  // 明確返回 void
  }
}
```

### 問題 4: 用戶 ID 屬性不一致
```typescript
// ❌ 混用不同屬性名
req.user?.userId
req.user?.id

// ✅ 統一使用 'id'
req.user?.id
```

## 🔧 本地開發建議

### 1. 安裝預提交鉤子（可選）
```bash
# 如果使用 husky
npm install --save-dev husky
npx husky add .husky/pre-commit "npm run precommit"
```

### 2. VS Code 設置
確保 `.vscode/settings.json` 啟用 TypeScript 嚴格檢查：
```json
{
  "typescript.preferences.strictNullChecks": "on",
  "typescript.preferences.noImplicitAny": "strict"
}
```

### 3. 開發時定期檢查
```bash
# 每次提交前執行
npm run precommit

# 或單獨檢查類型
npm run typecheck
```

## 📊 部署流程

### 1. 本地檢查
```bash
npm run precommit    # TypeScript + ESLint 檢查
npm run build        # 確保能成功構建
npm run test         # 運行測試（如果有）
```

### 2. Git 提交
```bash
git add .
git commit -m "your message"
git push origin main
```

### 3. 自動部署
- Zeabur 會自動檢測 main 分支變更
- 執行 `npm run build` 進行構建
- TypeScript 編譯失敗會導致部署失敗

## 🚨 部署失敗排查

### 1. 查看構建日誌
- 檢查 Zeabur 控制台的詳細錯誤信息
- 大多數錯誤是 TypeScript 編譯錯誤

### 2. 本地重現
```bash
npm run build  # 重現部署環境的構建過程
```

### 3. 逐步修復
- 根據錯誤信息修復 TypeScript 問題
- 再次執行 `npm run typecheck` 確認修復

## 📈 最佳實踐

1. **提交前總是執行** `npm run precommit`
2. **統一代碼風格** - 使用 ESLint + Prettier
3. **類型安全優先** - 不要使用 `any` 類型
4. **環境變數訪問** - 統一使用方括號表示法
5. **屬性命名一致** - 統一使用約定的屬性名

## 📞 支援

如果遇到部署問題：
1. 首先檢查本地 `npm run typecheck` 是否通過
2. 查看此文件的常見問題章節
3. 檢查 tsconfig.json 的嚴格模式設置