/**
 * Format price to Vietnamese currency
 */
export function formatPrice(amount: number, locale: string = 'vi'): string {
  if (locale === 'vi') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format relative time (e.g., "2 giờ trước", "3 days ago")
 */
export function formatRelativeTime(date: string | Date, locale: string = 'vi'): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 0) return rtf.format(-diffDays, 'day');
  if (diffHours > 0) return rtf.format(-diffHours, 'hour');
  if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute');
  return rtf.format(-diffSeconds, 'second');
}

/**
 * Check if error is an API error with code and statusCode
 */
export function isApiError(
  error: unknown,
): error is { code: string; statusCode: number; message: string } {
  return typeof error === 'object' && error !== null && 'code' in error && 'statusCode' in error;
}

/**
 * Get i18n key for API error code
 */
export function getErrorMessageKey(code: string): string {
  return `apiErrors.${code}`;
}

/**
 * Format date to localized string
 */
export function formatDate(date: string | Date, locale: string = 'vi'): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Format duration in seconds to human-readable (e.g., "2h 30m" or "5m")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
