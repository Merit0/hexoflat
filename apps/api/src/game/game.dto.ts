import { z } from 'zod';

export const CreateSaveDtoSchema = z.object({
  name: z.string().min(1),
});
export type CreateSaveDto = z.infer<typeof CreateSaveDtoSchema>;
