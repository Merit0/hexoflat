import { sendInventoryCommand } from '@/services/inventory/inventory-sync';

export type QuestOutcome = { ok: true } | { ok: false; reason: string };

async function send(type: string, questId: string): Promise<QuestOutcome> {
  const answer = await sendInventoryCommand(type, { questId });
  if (answer.ok) return { ok: true };
  const rejected = answer.events.find((event) => event.type === 'QUEST_REJECTED');
  const payload = rejected?.payload as { reason?: string } | undefined;
  return { ok: false, reason: payload?.reason ?? answer.code ?? 'REJECTED' };
}

export const acceptQuest = (questId: string) => send('QUEST_ACCEPT', questId);
export const abandonQuest = (questId: string) => send('QUEST_ABANDON', questId);
export const claimQuest = (questId: string) => send('QUEST_CLAIM', questId);
