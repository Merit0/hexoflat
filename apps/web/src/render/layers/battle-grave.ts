import { Container, Graphics } from 'pixi.js';
import { BATTLE_GRAVE_LOOK } from '@/render/battle/battle-look';

export function drawBattleGrave(tileHeight: number): Container {
  const look = BATTLE_GRAVE_LOOK;
  const width = tileHeight * look.widthTiles;
  const height = tileHeight * look.heightTiles;
  const half = width / 2;
  const top = -height / 2;
  const bottom = height / 2;
  const line = Math.max(1, tileHeight * 0.025);

  const grave = new Container();
  const mound = new Graphics();
  mound.ellipse(0, bottom, half * 1.25, height * 0.1).fill({ color: look.mound });
  const slab = new Graphics();
  slab
    .moveTo(-half, bottom)
    .lineTo(-half, top + half)
    .arc(0, top + half, half, Math.PI, 0)
    .lineTo(half, bottom)
    .closePath()
    .fill({ color: look.stone })
    .stroke({ color: look.outline, width: line });
  slab
    .moveTo(half * 0.35, top + half * 0.8)
    .lineTo(half * 0.35, bottom)
    .lineTo(half, bottom)
    .lineTo(half, top + half)
    .closePath()
    .fill({ color: look.stoneShade, alpha: 0.45 });
  const cross = new Graphics();
  const arm = half * 0.42;
  const crossTop = top + half * 0.75;
  cross
    .moveTo(0, crossTop)
    .lineTo(0, crossTop + arm * 2.4)
    .moveTo(-arm, crossTop + arm * 0.8)
    .lineTo(arm, crossTop + arm * 0.8)
    .stroke({ color: look.engraving, width: line * 1.6, cap: 'round' });
  const rest = new Graphics();
  const restY = crossTop + arm * 3.3;
  rest
    .moveTo(-half * 0.45, restY)
    .lineTo(half * 0.45, restY)
    .moveTo(-half * 0.3, restY + line * 3)
    .lineTo(half * 0.3, restY + line * 3)
    .stroke({ color: look.engraving, width: line, cap: 'round' });
  grave.addChild(mound, slab, cross, rest);
  return grave;
}
