export interface GazePoint {
  x: number;
  y: number;
}

export interface GazeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAX_X = 4.5;
const MAX_Y = 3.5;
const FULL_DISTANCE = 220;

export function computeGaze(pointer: GazePoint, rect: GazeRect): GazePoint {
  const dx = pointer.x - (rect.left + rect.width / 2);
  const dy = pointer.y - (rect.top + rect.height * 0.39);
  const distance = Math.max(1, Math.hypot(dx, dy));
  const strength = Math.min(1, distance / FULL_DISTANCE);
  return {
    x: (dx / distance) * MAX_X * strength,
    y: (dy / distance) * MAX_Y * strength,
  };
}
