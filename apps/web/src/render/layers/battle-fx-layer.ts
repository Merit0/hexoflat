import { Container, Sprite } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { createHexToken } from '@/render/hex-token';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import type { StrikeFx } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

const TOOL_FRAME_URL = '/hex-assets/hex-tools/tool-frame-hex.png';

export interface BattleFxLayer {
  sync(fx: StrikeFx | null): void;
  destroy(): void;
}

export function createBattleFxLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleFxLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);

  const tool = new Container();
  const toolToken = createHexToken();
  toolToken.layout(w, h);
  toolToken.body.position.set(w / 2, h / 2);
  toolToken.root.position.set(-w / 2, -h / 2);
  const frame = new Sprite(getTexture(TOOL_FRAME_URL));
  frame.anchor.set(0.5);
  const fitFrame = () => frame.setSize(w, h);
  fitFrame();
  const stopFrameWatch = onTextureReady(TOOL_FRAME_URL, () => {
    frame.texture = getTexture(TOOL_FRAME_URL);
    fitFrame();
  });
  tool.addChild(toolToken.root, frame);
  tool.visible = false;
  container.addChild(tool);

  function sync(fx: StrikeFx | null) {
    tool.visible = !!fx;
    if (!fx) return;
    const sprite = getPrototype(fx.toolKey as THexobjectKey).spritePath;
    if (sprite) toolToken.setSprite(sprite);
    tool.position.set(fx.tool.x, fx.tool.y);
    tool.alpha = fx.tool.alpha;
  }

  return {
    sync,
    destroy() {
      stopFrameWatch();
      toolToken.destroy();
      container.destroy({ children: true });
    },
  };
}
