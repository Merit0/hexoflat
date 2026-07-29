import { z } from 'zod';

export const LoginDtoSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RegisterDtoSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;
