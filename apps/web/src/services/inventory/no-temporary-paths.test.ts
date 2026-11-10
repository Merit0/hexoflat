import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|vue)$/.test(name) && !/\.(test|spec)\.ts$/.test(name) ? [path] : [];
  });
}

const FILES = sources(ROOT).map((path) => ({
  name: relative(ROOT, path),
  text: readFileSync(path, 'utf8'),
}));

const DEV_COMMAND_HOMES = new Set([
  'services/inventory/inventory-sync.ts',
  'services/knowledge/knowledge-controller.ts',
]);

describe('no game path rides on a temporary server route (REQ-B6-SPY-001)', () => {
  it('has no client of the removed PUT /player/world bridge', () => {
    const offenders = FILES.filter(({ text }) =>
      /putJson|flushWorld|queueWorldPush|takePendingPushes|worldBody\(/.test(text),
    ).map((file) => file.name);
    expect(offenders).toEqual([]);
  });

  it('names a DEV_ command only in the fixture senders', () => {
    const offenders = FILES.filter(
      ({ name, text }) =>
        /DEV_(GRANT_ITEM|CONSUME_ITEM|SET_INVENTORY|SET_HEALTH|GRANT_WILL|SET_KNOWLEDGE)/.test(
          text,
        ) && !DEV_COMMAND_HOMES.has(name),
    ).map((file) => file.name);
    expect(offenders).toEqual([]);
  });

  it('keeps the health and the inventory out of the dev commands the game used to send', () => {
    const sync = FILES.find((file) => file.name === 'services/inventory/inventory-sync.ts')!.text;
    expect(sync).not.toContain('mirrorWorldChange');
    expect(sync.match(/DEV_SET_INVENTORY/g)).toHaveLength(1);
    const store = FILES.find((file) => file.name === 'stores/hero-store.ts')!.text;
    expect(store).not.toMatch(/reportHealth|takeDamage|DEV_SET_HEALTH/);
  });
});
