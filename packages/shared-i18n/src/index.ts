export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';

// Backend error codes -> i18n key mapping
export const API_ERROR_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: 'apiErrors.invalidCredentials',
  EMAIL_ALREADY_EXISTS: 'apiErrors.emailAlreadyExists',
  INVALID_REFRESH_TOKEN: 'apiErrors.invalidRefreshToken',
  ACCOUNT_SUSPENDED: 'apiErrors.accountSuspended',
  EMAIL_NOT_VERIFIED: 'apiErrors.emailNotVerified',
};
