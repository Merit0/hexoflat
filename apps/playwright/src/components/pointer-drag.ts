import { expect, type Locator, type Page } from '@playwright/test';

const DRAG_MOVE_STEPS = 8;

export interface PointerDragOptions {
  shift: boolean;
  release: boolean;
}

/**
 * A real pointer drag: press on the centre of the source, move in steps, release on the centre of
 * the target. Used by the boards whose drag is its own pointer controller (no HTML5 drag events).
 */
export async function pointerDrag(
  page: Page,
  source: Locator,
  target: Locator,
  options: Partial<PointerDragOptions> = {},
): Promise<void> {
  const { shift = false, release = true } = options;
  await expect(source).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const [from, to] = await Promise.all([source.boundingBox(), target.boundingBox()]);
  if (!from || !to) throw new Error('pointerDrag: source or target has no bounding box.');
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

  await page.mouse.move(start.x, start.y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  for (let step = 1; step <= DRAG_MOVE_STEPS; step += 1) {
    const t = step / DRAG_MOVE_STEPS;
    await page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
  }
  if (release) await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}
