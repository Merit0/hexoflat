import { Assets, Texture } from 'pixi.js';

const cache = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();
const listeners = new Map<string, Set<() => void>>();

function notify(path: string) {
  const subs = listeners.get(path);
  if (!subs) return;
  for (const cb of subs) cb();
}

function load(path: string): Promise<Texture> {
  const existing = pending.get(path);
  if (existing) return existing;

  const promise = Assets.load<Texture>(path)
    .then((texture) => {
      cache.set(path, texture);
      pending.delete(path);
      notify(path);
      return texture;
    })
    .catch((error: unknown) => {
      pending.delete(path);
      console.warn(`[texture-cache] failed to load "${path}"`, error);
      return Texture.EMPTY;
    });

  pending.set(path, promise);
  return promise;
}

/**
 * Sync lookup: returns the cached texture, or kicks off a load and returns
 * Texture.EMPTY (invisible) until it resolves — same laziness a CSS
 * `background-image: url(...)` gives you for free.
 */
export function getTexture(path: string): Texture {
  const cached = cache.get(path);
  if (cached) return cached;

  void load(path);
  return Texture.EMPTY;
}

export function isTextureReady(path: string): boolean {
  return cache.has(path);
}

export function onTextureReady(path: string, cb: () => void): () => void {
  let subs = listeners.get(path);
  if (!subs) {
    subs = new Set();
    listeners.set(path, subs);
  }
  subs.add(cb);

  return () => {
    subs?.delete(cb);
  };
}
