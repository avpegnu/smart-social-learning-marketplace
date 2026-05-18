import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'emailInvalid' }),
  password: z.string().min(1, { message: 'passwordRequired' }),
});

export type LoginValues = z.infer<typeof loginSchema>;
