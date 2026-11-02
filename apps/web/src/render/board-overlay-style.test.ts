import { describe, expect, it } from 'vitest';
import { HEX_WORLD_HEIGHT, HEX_WORLD_WIDTH } from './board-camera';
import { boardOverlayStyle } from './board-overlay-style';

describe('boardOverlayStyle', () => {
  it('moves the overlay with the camera and scales the frame and tile size by the zoom', () => {
    const style = boardOverlayStyle(
      { x: 10, y: -4, zoom: 2 },
      { x: 0, y: 0, width: 300, height: 200 },
    );
    expect(style).toEqual({
      width: '600px',
      height: '400px',
      transform: 'translate(10px, -4px)',
      '--hex-tile-width': `${HEX_WORLD_WIDTH * 2}px`,
      '--hex-tile-height': `${HEX_WORLD_HEIGHT * 2}px`,
    });
  });

  it('is empty-sized until a frame is known', () => {
    expect(boardOverlayStyle({ x: 0, y: 0, zoom: 1 }, null)).toMatchObject({
      width: '0px',
      height: '0px',
    });
  });
});
