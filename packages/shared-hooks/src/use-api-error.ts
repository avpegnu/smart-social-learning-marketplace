'use client';

import { useTranslations } from 'next-intl';

interface ApiErrorLike {
  code: string;
  statusCode: number;
}

function isApiError(error: unknown): error is ApiErrorLike {
  return typeof error === 'object' && error !== null && 'code' in error && 'statusCode' in error;
}

export function useApiError() {
  const t = useTranslations();

  return (error: unknown): string => {
    if (isApiError(error)) {
      const key = `apiErrors.${error.code}`;
      return t.has(key) ? t(key) : error.code;
    }
    return t('common.unknownError');
  };
}
