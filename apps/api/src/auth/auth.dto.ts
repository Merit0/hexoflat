import { z } from 'zod';

export const LoginDtoSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RegisterDtoSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
  origin: z.undefined({ error: 'HERO_ORIGIN_SERVER_ONLY' }).optional(),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;
