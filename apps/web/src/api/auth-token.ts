// Live, synchronous source of truth for the current access token. api/client.ts
// reads from here instead of localStorage — the Pinia persistence plugin in
// main.ts flushes state to localStorage asynchronously (on the next reactivity
// tick), which is too late for a request fired immediately after login/register.
let currentToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function getAuthToken(): string | null {
  return currentToken;
}
