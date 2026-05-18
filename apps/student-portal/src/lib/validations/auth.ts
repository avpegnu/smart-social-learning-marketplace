import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, { message: 'passwordTooShort' })
  .max(100, { message: 'passwordTooLong' })
  .regex(/(?=.*[A-Z])(?=.*\d)/, { message: 'passwordWeak' });

export const loginSchema = z.object({
  email: z.string().email({ message: 'emailInvalid' }),
  password: z.string().min(1, { message: 'passwordRequired' }),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, { message: 'fullNameTooShort' })
      .max(100, { message: 'fullNameTooLong' }),
    email: z.string().email({ message: 'emailInvalid' }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsNotMatch',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'emailInvalid' }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsNotMatch',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
