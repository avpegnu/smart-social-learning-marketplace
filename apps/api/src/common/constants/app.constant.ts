// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Auth
export const BCRYPT_ROUNDS = 12;
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const RESET_TOKEN_EXPIRY_HOURS = 1;
export const OTT_EXPIRY_SECONDS = 60;

// Rate limiting
export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_SECONDS = 60;
export const REGISTER_RATE_LIMIT = 3;
export const REGISTER_RATE_WINDOW_SECONDS = 60;

// Upload
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// Learning
export const LESSON_COMPLETE_THRESHOLD = 0.8;
export const QUIZ_DEFAULT_PASSING_SCORE = 0.7;

// Cache TTL (seconds)
export const CACHE_TTL_SHORT = 60; // 1 min
export const CACHE_TTL_MEDIUM = 300; // 5 min
export const CACHE_TTL_LONG = 3600; // 1 hour

// Order
export const ORDER_EXPIRY_MINUTES = 15;
export const EARNING_HOLD_DAYS = 7;

// AI
export const AI_DAILY_LIMIT = 10;
export const RAG_TOP_K = 5;
export const EMBEDDING_DIMENSIONS = 384;
