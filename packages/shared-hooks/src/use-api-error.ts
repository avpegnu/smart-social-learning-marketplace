'use client';

import { useTranslations } from 'next-intl';

interface ApiErrorWithCode {
  code: string;
  statusCode: number;
}

interface ValidationError {
  message: string | string[];
  statusCode: number;
}

function isApiErrorWithCode(error: unknown): error is ApiErrorWithCode {
  return typeof error === 'object' && error !== null && 'code' in error && 'statusCode' in error;
}

function isValidationError(error: unknown): error is ValidationError {
  return typeof error === 'object' && error !== null && 'message' in error && 'statusCode' in error;
}

export function useApiError() {
  const t = useTranslations();

  return (error: unknown): string => {
    // Backend error with code (e.g., { code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 })
    if (isApiErrorWithCode(error)) {
      const key = `apiErrors.${error.code}`;
      return t.has(key) ? t(key) : error.code;
    }

    // Validation error (class-validator: { message: string[], statusCode: 400 })
    if (isValidationError(error)) {
      const msg = error.message;
      if (Array.isArray(msg)) {
        return msg[0] ?? t('common.unknownError');
      }
      if (typeof msg === 'string') {
        return msg;
      }
    }

    return t('common.unknownError');
  };
}
