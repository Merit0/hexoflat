import { describe, expect, it } from 'vitest';
import { HeroRateLimiter, HeroSessions } from './hero-sessions';

describe('HeroSessions', () => {
  it('lets one socket per hero be active and reports the one it replaced', () => {
    const sessions = new HeroSessions();
    expect(sessions.claim('hero', 'a')).toBeNull();
    expect(sessions.claim('hero', 'b')).toBe('a');
    expect(sessions.isActive('hero', 'a')).toBe(false);
    expect(sessions.isActive('hero', 'b')).toBe(true);
    expect(sessions.heroOf('a')).toBeNull();
  });

  it('does not report itself when the same socket subscribes again', () => {
    const sessions = new HeroSessions();
    sessions.claim('hero', 'a');
    expect(sessions.claim('hero', 'a')).toBeNull();
    expect(sessions.isActive('hero', 'a')).toBe(true);
  });

  it('moves a socket from one hero to another and frees the first', () => {
    const sessions = new HeroSessions();
    sessions.claim('h1', 'a');
    sessions.claim('h2', 'a');
    expect(sessions.isActive('h1', 'a')).toBe(false);
    expect(sessions.claim('h1', 'b')).toBeNull();
  });

  it('forgets a socket on release but keeps a newer owner', () => {
    const sessions = new HeroSessions();
    sessions.claim('hero', 'a');
    sessions.claim('hero', 'b');
    sessions.release('a');
    expect(sessions.isActive('hero', 'b')).toBe(true);
    sessions.release('b');
    expect(sessions.isActive('hero', 'b')).toBe(false);
  });
});

describe('HeroRateLimiter', () => {
  it('allows the limit per window per hero and opens a new window later', () => {
    let now = 0;
    const limiter = new HeroRateLimiter(3, 1000, () => now);
    expect([1, 2, 3, 4].map(() => limiter.allow('h'))).toEqual([true, true, true, false]);
    expect(limiter.allow('other')).toBe(true);
    now = 1000;
    expect(limiter.allow('h')).toBe(true);
  });
});
