import slugify from 'slugify';

export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true, // Strip special characters
    locale: 'vi', // Vietnamese support (đ → d, etc.)
  });
}

export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
