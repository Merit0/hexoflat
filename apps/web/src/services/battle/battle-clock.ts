const STALE_MS = 5 * 60 * 1000;

let offsetMs = 0;
let bestRttMs = Number.POSITIVE_INFINITY;
let measuredAt = 0;

export function observeServerClock(serverNowMs: number, sentAtMs: number, receivedAtMs: number) {
  if (!Number.isFinite(serverNowMs)) return;
  const rtt = Math.max(0, receivedAtMs - sentAtMs);
  const stale = receivedAtMs - measuredAt > STALE_MS;
  if (!stale && rtt > bestRttMs) return;
  bestRttMs = rtt;
  measuredAt = receivedAtMs;
  offsetMs = serverNowMs - (sentAtMs + rtt / 2);
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function msUntilServerTime(deadlineMs: number): number {
  return Math.max(0, deadlineMs - serverNow());
}

export function clockOffsetMs(): number {
  return offsetMs;
}

export function resetServerClock() {
  offsetMs = 0;
  bestRttMs = Number.POSITIVE_INFINITY;
  measuredAt = 0;
}
