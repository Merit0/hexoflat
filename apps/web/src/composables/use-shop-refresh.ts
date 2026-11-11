import { ref } from 'vue';
import { refreshTrader } from '@/services/trade/trade-commands';
import type { RefreshPreview } from '@/services/trade/trade-preview';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { refreshConfirmText, warnRefreshNoWill, warnTrade } from './shop-messages';

export const REFRESH_CONFIRM_MS = 3000;

export const refreshConfirming = ref(false);
export const refreshSending = ref(false);

let timer: ReturnType<typeof setTimeout> | null = null;
let prompt: string | null = null;
let button: HTMLElement | null = null;

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') cancelRefreshConfirm();
}

function onPointer(event: PointerEvent): void {
  if (button && event.target instanceof Node && button.contains(event.target)) return;
  cancelRefreshConfirm();
}

export function cancelRefreshConfirm(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerdown', onPointer, true);
  button = null;
  refreshConfirming.value = false;
  const tool = useHeroToolStore();
  if (prompt !== null && tool.actionMessage === prompt) tool.clearActionMessage();
  prompt = null;
}

function askToConfirm(refresh: RefreshPreview, losesBuyback: boolean, element: HTMLElement): void {
  refreshConfirming.value = true;
  button = element;
  prompt = refreshConfirmText(refresh.price, losesBuyback);
  useHeroToolStore().setActionMessage(prompt, 'will', refresh.price, 'info');
  timer = setTimeout(cancelRefreshConfirm, REFRESH_CONFIRM_MS);
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer, true);
}

async function sendRefresh(): Promise<void> {
  const key = useTraderStore().traderKey;
  if (!key) return;
  refreshSending.value = true;
  try {
    const outcome = await refreshTrader(key);
    if (!outcome.ok) warnTrade(outcome.reason, outcome.price);
  } finally {
    refreshSending.value = false;
  }
}

export async function clickRefresh(
  refresh: RefreshPreview | null,
  losesBuyback: boolean,
  element: HTMLElement,
): Promise<void> {
  if (!refresh || refreshSending.value) return;
  if (refreshConfirming.value) {
    cancelRefreshConfirm();
    await sendRefresh();
    return;
  }
  if (!refresh.affordable) {
    warnRefreshNoWill(refresh.price);
    return;
  }
  askToConfirm(refresh, losesBuyback, element);
}
