import { describe, expect, it } from 'vitest';
import { passwordScore, isPasswordStrongEnough } from './password-score';
import { computeGaze } from './gaze';
import { deriveEmblemMood } from './emblem-mood';
import { pickRune, resetRunes, runePolyline } from './runes';
import { forgeSteps, forgeDone } from './forge-progress';
import { heroColorFor, GRADE_COLORS } from './grade-colors';
import { parseAuthMode, readAuthFlags, visibleAuthModes } from './auth-flags';

describe('passwordScore', () => {
  it.each([
    ['', 0],
    ['abc', 0],
    ['abc1', 1],
    ['abcdefg1', 2],
    ['abcdefgh', 1],
    ['Abcdefgh', 2],
    ['Abcdefg1', 3],
    ['Abcdefghijk1', 4],
    ['abcdefgh!', 2],
  ])('scores %j as %i', (password, expected) => {
    expect(passwordScore(password)).toBe(expected);
  });

  it('caps a short password at 1 even with every character class', () => {
    expect(passwordScore('Ab1!')).toBe(1);
  });

  it('requires score 2 to submit', () => {
    expect(isPasswordStrongEnough('abcdefgh')).toBe(false);
    expect(isPasswordStrongEnough('abcdefg1')).toBe(true);
  });
});

describe('computeGaze', () => {
  const rect = { left: 100, top: 100, width: 100, height: 100 };

  it('looks straight when the pointer sits on the eye line centre', () => {
    expect(computeGaze({ x: 150, y: 139 }, rect)).toEqual({ x: 0, y: 0 });
  });

  it('clamps a far pointer to the maximum offset', () => {
    const gaze = computeGaze({ x: 5000, y: 139 }, rect);
    expect(gaze.x).toBeCloseTo(4.5);
    expect(gaze.y).toBeCloseTo(0);
  });

  it('scales a near pointer below the maximum', () => {
    const gaze = computeGaze({ x: 150 + 110, y: 139 }, rect);
    expect(gaze.x).toBeCloseTo(2.25);
  });

  it('points downward for a pointer below', () => {
    expect(computeGaze({ x: 150, y: 2000 }, rect).y).toBeCloseTo(3.5);
  });
});

describe('deriveEmblemMood', () => {
  const base = {
    focus: '' as const,
    show: false,
    blink: false,
    loading: false,
    gaze: { x: 1, y: 2 },
    nameLength: 0,
  };

  it('follows the gaze by default with the idle heartbeat', () => {
    expect(deriveEmblemMood(base)).toEqual({
      eyeX: 1,
      eyeY: 2,
      eyesClosed: false,
      heartSeconds: 2.4,
    });
  });

  it('reads along while typing a name', () => {
    const mood = deriveEmblemMood({ ...base, focus: 'name', nameLength: 9 });
    expect(mood.eyeX).toBeCloseTo(0);
    expect(mood.eyeY).toBe(3);
    expect(mood.heartSeconds).toBe(1.5);
  });

  it('caps the read-along at 18 characters', () => {
    expect(deriveEmblemMood({ ...base, focus: 'newName', nameLength: 99 }).eyeX).toBeCloseTo(4);
  });

  it('closes the eyes on a hidden password and peeks on a shown one', () => {
    expect(deriveEmblemMood({ ...base, focus: 'password' }).eyesClosed).toBe(true);
    const peek = deriveEmblemMood({ ...base, focus: 'password', show: true });
    expect(peek).toMatchObject({ eyeX: 4.5, eyeY: 2, eyesClosed: false });
  });

  it('closes the eyes on the new password and on a blink', () => {
    expect(deriveEmblemMood({ ...base, focus: 'newPassword' }).eyesClosed).toBe(true);
    expect(deriveEmblemMood({ ...base, blink: true }).eyesClosed).toBe(true);
  });

  it('beats fastest while loading', () => {
    expect(deriveEmblemMood({ ...base, loading: true, focus: 'name' }).heartSeconds).toBe(0.5);
  });
});

describe('runes', () => {
  it('ignores duplicates and stops at four', () => {
    let state = resetRunes();
    state = pickRune(state, 'star').runes;
    expect(pickRune(state, 'star').runes).toEqual(['star']);
    state = pickRune(state, 'moon').runes;
    state = pickRune(state, 'leaf').runes;
    const last = pickRune(state, 'sun');
    expect(last.complete).toBe(true);
    expect(pickRune(last.runes, 'bolt')).toEqual({ runes: last.runes, complete: false });
  });

  it('draws the polyline through the picked runes in order', () => {
    expect(runePolyline(['star', 'moon'])).toBe('94,85.5 124,36');
    expect(runePolyline([])).toBe('');
  });
});

describe('forge progress', () => {
  it('counts the finished steps', () => {
    const none = forgeSteps({ name: ' ', score: 0, email: '' });
    expect(none).toEqual([false, false, true, false]);
    expect(forgeDone(none)).toBe(1);
    const all = forgeSteps({ name: 'Mira', score: 2, email: 'a@b.co' });
    expect(forgeDone(all)).toBe(4);
  });
});

describe('heroColorFor', () => {
  it('is stable and always a grade colour', () => {
    expect(heroColorFor('Mira')).toBe(heroColorFor('Mira'));
    expect(Object.values(GRADE_COLORS)).toContain(heroColorFor('Tarek'));
  });
});

describe('auth flags', () => {
  const env = (extra: Record<string, string>, dev: boolean) =>
    ({ DEV: dev, ...extra }) as unknown as ImportMetaEnv;

  it('is on in dev and off in production when unset', () => {
    expect(readAuthFlags(env({}, true)).heroCode).toBe(true);
    expect(readAuthFlags(env({}, false)).heroCode).toBe(false);
  });

  it('lets an explicit value override the mode default', () => {
    expect(readAuthFlags(env({ VITE_AUTH_PASSKEY: 'false' }, true)).passkey).toBe(false);
    expect(readAuthFlags(env({ VITE_AUTH_PASSKEY: 'true' }, false)).passkey).toBe(true);
  });

  it('hides the hero code tab when its flag is off', () => {
    const off = readAuthFlags(env({}, false));
    expect(visibleAuthModes(off)).toEqual(['signin', 'new']);
    expect(parseAuthMode('code', off)).toBe('signin');
    const on = readAuthFlags(env({}, true));
    expect(visibleAuthModes(on)).toEqual(['signin', 'code', 'new']);
    expect(parseAuthMode('code', on)).toBe('code');
  });
});
