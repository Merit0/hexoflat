import { Container, Sprite } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { applyObjectFit } from '@/render/object-fit';
import { LOOT_TIMING } from '@/render/loot-timing';
import { easeOutCubic, runTween } from '@/render/tween';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import type { LootFlight, LootFlightRequest } from '@/services/loot/loot-flight';

export interface LootFlightLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
  onLanded(flight: LootFlight): void;
}

export interface LootFlightLayer {
  play(request: LootFlightRequest): Promise<void>;
  destroy(): void;
}

interface Runner {
  flight: LootFlight;
  node: Container;
  from: { x: number; y: number };
  to: { x: number; y: number };
  toBag: boolean;
  landed: boolean;
  unsubscribe: () => void;
}

function topLeft(coordinates: IHexCoordinates, w: number, h: number) {
  return calcHexPixelPosition({ coordinates }, w, h);
}

export function createLootFlightLayer(deps: LootFlightLayerDeps): LootFlightLayer {
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);
  let runners: Runner[] = [];

  function build(flight: LootFlight): Runner {
    const { w, h } = deps.getTileSize();
    const meta = getPrototype(flight.itemKey as THexobjectKey);
    const node = new Container();
    node.alpha = 0;
    const sprite = new Sprite();
    node.addChild(sprite);
    const fit = () => applyObjectFit(sprite, w, h, meta?.groupType);
    const path = meta?.spritePath;
    let unsubscribe = () => {};
    if (path) {
      sprite.texture = getTexture(path);
      fit();
      unsubscribe = onTextureReady(path, () => {
        sprite.texture = getTexture(path);
        fit();
      });
    }
    const from = topLeft(flight.from, w, h);
    const to = flight.to
      ? topLeft(flight.to, w, h)
      : { x: from.x, y: from.y - h * LOOT_TIMING.bagRiseTiles };
    node.position.set(from.x, from.y);
    container.addChild(node);
    return { flight, node, from, to, toBag: !flight.to, landed: false, unsubscribe };
  }

  function frame(runner: Runner, elapsedMs: number, flightMs: number) {
    const t = Math.min(1, Math.max(0, (elapsedMs - runner.flight.delayMs) / flightMs));
    const eased = easeOutCubic(t);
    runner.node.position.set(
      runner.from.x + (runner.to.x - runner.from.x) * eased,
      runner.from.y + (runner.to.y - runner.from.y) * eased,
    );
    const started = elapsedMs >= runner.flight.delayMs;
    runner.node.alpha = !started ? 0 : runner.toBag ? 1 - t : 1;
    if (t >= 1 && !runner.landed) {
      runner.landed = true;
      runner.node.visible = false;
      deps.onLanded(runner.flight);
    }
  }

  function clear() {
    for (const runner of runners) {
      runner.unsubscribe();
      runner.node.destroy({ children: true });
    }
    runners = [];
  }

  return {
    async play(request) {
      clear();
      runners = request.flights.map(build);
      const active = runners;
      await runTween(request.totalMs, (progress) => {
        const elapsed = progress * request.totalMs;
        for (const runner of active) frame(runner, elapsed, request.flightMs);
      }).done;
      for (const runner of active) {
        if (!runner.landed) {
          runner.landed = true;
          deps.onLanded(runner.flight);
        }
      }
      if (runners === active) clear();
    },
    destroy() {
      clear();
      container.destroy({ children: true });
    },
  };
}
