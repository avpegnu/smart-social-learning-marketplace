import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .max(100)
  .regex(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z
  .object({
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'PASSWORDS_NOT_MATCH',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'PASSWORDS_NOT_MATCH',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
