import { z } from 'zod';

// ── Step 1: Basic Info ──

export const courseBasicsSchema = z.object({
  title: z.string().min(5).max(200),
  shortDescription: z.string().max(200).optional().or(z.literal('')),
  description: z.string().min(50).optional().or(z.literal('')),
  categoryId: z.string().min(1),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  language: z.string().min(1),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  promoVideoUrl: z.string().url().optional().or(z.literal('')),
  learningOutcomes: z.array(z.object({ value: z.string().min(1) })).optional(),
  prerequisites: z.array(z.object({ value: z.string().min(1) })).optional(),
  tags: z
    .array(z.object({ value: z.string().min(1) }))
    .max(10)
    .optional(),
});

export type CourseBasicsValues = z.infer<typeof courseBasicsSchema>;

// ── Step 3: Pricing ──

export const coursePricingSchema = z.object({
  price: z.number().int().min(0),
  isFree: z.boolean(),
});

export type CoursePricingValues = z.infer<typeof coursePricingSchema>;

// ── Curriculum inline forms ──

export const sectionSchema = z.object({
  title: z.string().min(2).max(200),
});

export const chapterSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional().or(z.literal('')),
});

export const lessonSchema = z.object({
  title: z.string().min(2).max(200),
  type: z.enum(['VIDEO', 'TEXT', 'QUIZ']),
});

// ── Quiz ──

export const quizOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

export const quizQuestionSchema = z
  .object({
    question: z.string().min(1),
    explanation: z.string().optional().or(z.literal('')),
    options: z.array(quizOptionSchema).min(2),
  })
  .refine((data) => data.options.filter((o) => o.isCorrect).length === 1, {
    message: 'exactlyOneCorrect',
    path: ['options'],
  });

export const quizSchema = z.object({
  passingScore: z.number().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  timeLimitSeconds: z.number().int().min(0).optional(),
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        explanation: z.string().optional().or(z.literal('')),
        options: z.array(quizOptionSchema).min(2),
      }),
    )
    .min(1),
});

export type QuizValues = z.infer<typeof quizSchema>;

// ── Quiz import parser ──

export interface ParsedQuizQuestion {
  question: string;
  explanation: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

export function parseQuizText(text: string): ParsedQuizQuestion[] {
  const questions: ParsedQuizQuestion[] = [];
  const blocks = text.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block
      .trim()
      .split('\n')
      .map((l) => l.trim());
    if (lines.length < 2) continue;

    // First line: question (strip leading number + dot)
    const questionLine = lines[0].replace(/^\d+\.\s*/, '');
    if (!questionLine) continue;

    const options: Array<{ text: string; isCorrect: boolean }> = [];
    let explanation = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Explanation line
      if (line.toLowerCase().startsWith('explanation:')) {
        explanation = line.replace(/^explanation:\s*/i, '');
        continue;
      }

      // Option line: a) text * (asterisk = correct)
      const optionMatch = line.match(/^[a-zA-Z]\)\s*(.+)/);
      if (optionMatch) {
        const isCorrect = optionMatch[1].trim().endsWith('*');
        const text = optionMatch[1].trim().replace(/\s*\*$/, '');
        options.push({ text, isCorrect });
      }
    }

    if (options.length >= 2) {
      // Ensure at least one correct answer
      const hasCorrect = options.some((o) => o.isCorrect);
      if (!hasCorrect) options[0].isCorrect = true;

      questions.push({ question: questionLine, explanation, options });
    }
  }

  return questions;
}
