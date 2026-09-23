import type { Axial } from '../../../utils/hex-utils';

interface Cube {
  q: number;
  r: number;
  s: number;
}

/** Rounds a fractional cube coordinate to the nearest valid hex, preserving q+r+s=0. */
function cubeRound(cube: Cube): Axial {
  let q = Math.round(cube.q);
  let r = Math.round(cube.r);
  let s = Math.round(cube.s);

  const dq = Math.abs(q - cube.q);
  const dr = Math.abs(r - cube.r);
  const ds = Math.abs(s - cube.s);

  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  else s = -q - r;

  // Normalize -0 to 0: the reconstruction above can land on negative zero,
  // which fails strict/deep-equal comparisons against a literal 0 endpoint.
  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}

function lerpCube(a: Cube, b: Cube, t: number): Cube {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

function toCube(a: Axial): Cube {
  return { q: a.q, r: a.r, s: -a.q - a.r };
}

/**
 * The straight run of hexes from `a` to `b` inclusive, in axial space —
 * standard cube-lerp-and-round hex line drawing. Used to fill the gap
 * between two graph nodes whose coarse layout positions aren't already
 * hex-adjacent, so every graph edge ends up as an unbroken corridor rather
 * than a coordinate jump.
 */
export function hexLineAxial(a: Axial, b: Axial): Axial[] {
  const cubeA = toCube(a);
  const cubeB = toCube(b);

  const steps = Math.max(
    Math.abs(cubeA.q - cubeB.q),
    Math.abs(cubeA.r - cubeB.r),
    Math.abs(cubeA.s - cubeB.s),
  );
  if (steps === 0) return [{ q: a.q, r: a.r }];

  const line: Axial[] = [];
  for (let i = 0; i <= steps; i += 1) {
    line.push(cubeRound(lerpCube(cubeA, cubeB, i / steps)));
  }
  return line;
}
