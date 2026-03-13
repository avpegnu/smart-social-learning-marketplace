import { registerAs } from '@nestjs/config';

export const groqConfig = registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
}));
