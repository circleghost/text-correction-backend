import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import { logger } from '@utils/logger';

// 創建 DOMPurify 實例（用於伺服器端）
const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

/**
 * 輸入消毒選項
 */
interface SanitizeOptions {
  maxLength?: number;
  allowHtml?: boolean;
  stripHtml?: boolean;
  normalizeWhitespace?: boolean;
}

/**
 * 消毒文字輸入
 */
export const sanitizeText = (input: string, options: SanitizeOptions = {}): string => {
  if (typeof input !== 'string') {
    return '';
  }

  const {
    maxLength = 50000, // 預設最大長度 50K 字元
    allowHtml = false,
    stripHtml = true,
    normalizeWhitespace = true
  } = options;

  let sanitized = input;

  // 1. 長度限制
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // 2. 移除或清理 HTML
  if (stripHtml || !allowHtml) {
    // 移除所有 HTML 標籤
    sanitized = purify.sanitize(sanitized, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  } else if (allowHtml) {
    // 只允許安全的 HTML 標籤
    sanitized = purify.sanitize(sanitized, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
      ALLOWED_ATTR: []
    });
  }

  // 3. 正規化空白字元
  if (normalizeWhitespace) {
    sanitized = sanitized
      .replace(/\s+/g, ' ') // 多個空白合併為一個
      .trim(); // 移除首尾空白
  }

  // 4. 移除控制字元（保留換行符和 tab）
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 5. 正規化 Unicode
  sanitized = sanitized.normalize('NFC');

  return sanitized;
};

/**
 * 驗證和消毒文字內容的中間件
 */
export const validateAndSanitizeText = (
  options: SanitizeOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { text, paragraphs } = req.body;

      // 處理單一文字
      if (text) {
        if (typeof text !== 'string') {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Text must be a string',
            code: 'INVALID_TEXT_TYPE'
          });
          return;
        }

        // 基本驗證
        if (text.length === 0) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Text cannot be empty',
            code: 'EMPTY_TEXT'
          });
          return;
        }

        if (text.length > (options.maxLength || 50000)) {
          res.status(400).json({
            error: 'Validation Error',
            message: `Text too long. Maximum ${options.maxLength || 50000} characters allowed`,
            code: 'TEXT_TOO_LONG'
          });
          return;
        }

        // 消毒輸入
        const originalLength = text.length;
        req.body.text = sanitizeText(text, options);
        const sanitizedLength = req.body.text.length;

        // 記錄消毒結果
        if (originalLength !== sanitizedLength) {
          logger.info('Text sanitized', {
            originalLength,
            sanitizedLength,
            removed: originalLength - sanitizedLength,
            ip: req.ip
          });
        }
      }

      // 處理批次段落
      if (paragraphs && Array.isArray(paragraphs)) {
        if (paragraphs.length === 0) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Paragraphs array cannot be empty',
            code: 'EMPTY_PARAGRAPHS'
          });
          return;
        }

        if (paragraphs.length > 100) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Too many paragraphs. Maximum 100 allowed',
            code: 'TOO_MANY_PARAGRAPHS'
          });
          return;
        }

        let totalSanitized = 0;
        req.body.paragraphs = paragraphs.map((paragraph: any) => {
          if (!paragraph || typeof paragraph.text !== 'string') {
            throw new Error('Each paragraph must have a text property');
          }

          const originalText = paragraph.text;
          const sanitizedText = sanitizeText(originalText, options);
          
          if (originalText.length !== sanitizedText.length) {
            totalSanitized++;
          }

          return {
            ...paragraph,
            text: sanitizedText
          };
        });

        if (totalSanitized > 0) {
          logger.info('Batch paragraphs sanitized', {
            totalParagraphs: paragraphs.length,
            sanitizedCount: totalSanitized,
            ip: req.ip
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Input sanitization error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        body: JSON.stringify(req.body).substring(0, 200) + '...'
      });

      res.status(400).json({
        error: 'Input Validation Error',
        message: error instanceof Error ? error.message : 'Invalid input format',
        code: 'SANITIZATION_ERROR'
      });
    }
  };
};

/**
 * 驗證 email 格式
 */
export const validateEmail = (email: string): boolean => {
  return validator.isEmail(email);
};

/**
 * 驗證 URL 格式
 */
export const validateUrl = (url: string): boolean => {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  });
};

/**
 * 清理檔案路徑（防止路徑遍歷）
 */
export const sanitizeFilePath = (filePath: string): string => {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string');
  }

  // 移除危險字元
  let sanitized = filePath
    .replace(/\.\./g, '') // 移除 ..
    .replace(/[<>:"|?*]/g, '') // 移除 Windows 禁用字元
    .replace(/\0/g, ''); // 移除 null 字元

  // 正規化路徑分隔符
  sanitized = sanitized.replace(/[\/\\]+/g, '/');

  // 移除開頭的斜線（防止絕對路徑）
  sanitized = sanitized.replace(/^\/+/, '');

  return sanitized;
};

/**
 * 安全的 JSON 解析
 */
export const safeParse = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format');
  }
};

/**
 * 一般性的輸入清理中間件
 */
export const generalSanitization = (req: Request, res: Response, next: NextFunction): void => {
  // 清理查詢參數
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = sanitizeText(value, { maxLength: 1000, stripHtml: true });
      }
    });
  }

  // 清理路徑參數
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      const value = req.params[key];
      if (typeof value === 'string') {
        req.params[key] = sanitizeText(value, { maxLength: 100, stripHtml: true });
      }
    });
  }

  next();
};