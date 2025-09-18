# CLAUDE.md - Text Correction Backend

本文件為 Claude Code 提供專案開發指導和規範。

## 🚨 TypeScript 嚴格模式規範

### 必須遵守的編碼規則

#### 1. 環境變數訪問
```typescript
// ❌ 禁止 - 會導致部署失敗
const url = process.env.SUPABASE_URL;

// ✅ 正確 - 使用方括號表示法
const url = process.env['SUPABASE_URL'];
```

#### 2. 用戶 ID 屬性命名
```typescript
// ❌ 禁止 - 混用不同屬性名
req.user?.userId  // 舊的命名方式

// ✅ 正確 - 統一使用 'id'
req.user?.id
```

#### 3. 異步函數返回類型
```typescript
// ❌ 禁止 - 返回 Response 對象
async function handler(req, res) {
  return res.status(200).json({ data });
}

// ✅ 正確 - 返回 void
async function handler(req, res): Promise<void> {
  res.status(200).json({ data });
  return;
}
```

#### 4. 可選屬性處理
```typescript
// ❌ 禁止 - 直接賦值 undefined
interface Config {
  option?: string;
}
const config: Config = {
  option: someValue || undefined  // exactOptionalPropertyTypes 錯誤
};

// ✅ 正確 - 條件性添加屬性
const config: Config = {};
if (someValue) {
  config.option = someValue;
}

// 或使用展開運算符
const config: Config = {
  ...(someValue && { option: someValue })
};
```

#### 5. 索引簽名訪問
```typescript
// ❌ 禁止 - 使用點號訪問動態屬性
const value = object.dynamicKey;

// ✅ 正確 - 使用方括號表示法
const value = object['dynamicKey'];
```

## 🔧 開發工作流程

### 1. 開發前檢查
```bash
# 確認 TypeScript 配置正確
npm run typecheck
```

### 2. 提交前必須執行
```bash
# 執行完整檢查
npm run precommit
```

### 3. 部署前驗證
```bash
# 模擬部署環境構建
npm run build
```

## 📋 代碼審查清單

修改代碼時，請確認：

- [ ] 所有 `process.env` 使用方括號訪問
- [ ] 統一使用 `id` 而非 `userId`
- [ ] 異步控制器返回 `Promise<void>`
- [ ] 正確處理可選屬性（不直接賦值 undefined）
- [ ] 索引簽名使用方括號訪問
- [ ] 執行 `npm run typecheck` 無錯誤

## 🚀 常用命令

```bash
# TypeScript 類型檢查
npm run typecheck

# 代碼風格檢查
npm run lint

# 完整檢查（類型 + 風格）
npm run precommit

# 開發模式（使用 tsx，較寬鬆）
npm run dev

# 構建（使用 tsc，嚴格模式）
npm run build
```

## ⚠️ 注意事項

1. **開發環境 vs 部署環境**
   - 開發時使用 `tsx`（較寬鬆，允許快速開發）
   - 部署時使用 `tsc`（嚴格模式，確保類型安全）

2. **tsconfig.json 設置**
   - `exactOptionalPropertyTypes: true`
   - `noPropertyAccessFromIndexSignature: true`
   - `noUncheckedIndexedAccess: true`
   - `strict: true`

3. **錯誤預防**
   - 定期執行 `npm run typecheck`
   - 提交前執行 `npm run precommit`
   - 合併前確保 CI 檢查通過

## 📚 參考資源

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Project Repository](https://github.com/circleghost/text-correction-backend)