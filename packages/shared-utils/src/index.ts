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
