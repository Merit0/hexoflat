import { Application, Container } from 'pixi.js';

export interface HexBoardApp {
  app: Application;
  worldContainer: Container;
  resize(width: number, height: number): void;
  destroy(): void;
}

export async function createHexBoardApp(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<HexBoardApp> {
  const app = new Application();

  // `width`/`height` must already be the real map pixel size (not a 0/1px
  // placeholder): Pixi's `autoDensity` stamps an inline style width/height
  // on the canvas from whatever size it's given here, which overrides the
  // CSS `width:100%` rule the canvas otherwise relies on — so initializing
  // with a placeholder leaves the canvas genuinely tiny on screen (and
  // unable to receive clicks at their intended position) until the first
  // real `resize()` call. Callers should wait for a valid size before
  // calling this instead of racing it.
  await app.init({
    canvas,
    width,
    height,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
    preference: 'webgl',
  });

  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  return {
    app,
    worldContainer,
    resize(width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      app.renderer.resize(width, height);
    },
    destroy() {
      app.destroy(true, { children: true, texture: false });
    },
  };
}
