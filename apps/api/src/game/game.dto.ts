import { z } from 'zod';

export const CreateSaveDtoSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1),
});
export type CreateSaveDto = z.infer<typeof CreateSaveDtoSchema>;
