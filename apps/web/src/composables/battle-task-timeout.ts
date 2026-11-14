import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';

const TIMEOUT_RETRIES = 20;
const TIMEOUT_RETRY_MS = 250;

export async function taskTimeout(
  act: (action: BattleAction) => Promise<boolean>,
  taskOpen: () => boolean,
): Promise<boolean> {
  for (let attempt = 0; attempt <= TIMEOUT_RETRIES; attempt += 1) {
    if (await act({ kind: 'task-timeout' })) return true;
    if (!taskOpen()) return false;
    await new Promise((resolve) => setTimeout(resolve, TIMEOUT_RETRY_MS));
  }
  return false;
}
