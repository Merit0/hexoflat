import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardResolution, createHexBoardApp } from '@/render/pixi-app';

const pixi = vi.hoisted(() => ({ inits: [] as Array<Record<string, unknown>> }));

vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>();
  class FakeApplication {
    stage = new actual.Container();
    ticker = new actual.Ticker();
    screen = { width: 0, height: 0 };
    init(options: Record<string, unknown>) {
      pixi.inits.push(options);
      return Promise.resolve();
    }
    render() {}
    destroy() {}
  }
  return { ...actual, Application: FakeApplication };
});

afterEach(() => {
  pixi.inits.length = 0;
  vi.unstubAllGlobals();
});

async function initOptionsOnScreen(devicePixelRatio: number) {
  vi.stubGlobal('devicePixelRatio', devicePixelRatio);
  await createHexBoardApp(document.createElement('canvas'), 800, 600);
  return pixi.inits[0];
}

describe('board resolution (REQ-RENDER-SSAA-001)', () => {
  it('draws the board at 2x on a 1x screen and keeps the CSS size', async () => {
    const options = await initOptionsOnScreen(1);

    expect(options).toMatchObject({ resolution: 2, autoDensity: true, width: 800, height: 600 });
  });

  it('keeps the Retina resolution as it is', async () => {
    expect(await initOptionsOnScreen(2)).toMatchObject({ resolution: 2 });
  });

  it('follows a screen denser than Retina', async () => {
    expect(await initOptionsOnScreen(3)).toMatchObject({ resolution: 3 });
  });

  it('uses 2x for a fractional or unknown pixel ratio below 2', () => {
    expect(boardResolution(1.25)).toBe(2);
    expect(boardResolution(0)).toBe(2);
    expect(boardResolution(Number.NaN)).toBe(2);
  });
});
