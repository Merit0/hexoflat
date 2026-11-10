import { sendProgress } from './inventory-sync';

let pending = 0;

export function healthReportsPending(): boolean {
  return pending > 0;
}

export function reportHealthToServer(current: number, onSettled: () => void): void {
  pending += 1;
  void sendProgress('DEV_SET_HEALTH', { current }, { withKnowledgeRevision: false }).finally(() => {
    pending -= 1;
    if (pending === 0) onSettled();
  });
}
