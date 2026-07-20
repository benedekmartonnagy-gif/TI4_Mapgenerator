import type { AxialCoord } from '../data/types';

// Standard flat-top axial hex directions, in clockwise order starting East.
export const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function add(a: AxialCoord, b: AxialCoord): AxialCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function scale(a: AxialCoord, n: number): AxialCoord {
  return { q: a.q * n, r: a.r * n };
}

export function key(a: AxialCoord): string {
  return `${a.q},${a.r}`;
}

export function distance(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function neighbors(a: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map((d) => add(a, d));
}

/** All hexes at exactly `radius` rings from `center`, in a clockwise walk. */
export function hexRing(center: AxialCoord, radius: number): AxialCoord[] {
  if (radius === 0) return [center];
  const results: AxialCoord[] = [];
  let hex = add(center, scale(AXIAL_DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = add(hex, AXIAL_DIRECTIONS[side]);
    }
  }
  return results;
}

/**
 * Canonical hex spiral: index 0 is the center, then each ring 1..maxRadius
 * is appended as a clockwise walk. This is the standard numbering convention
 * used by TI4 community map tools (index 0 = Mecatol Rex, ring 1 = indices
 * 1-6, ring 2 = indices 7-18, ring 3 = indices 19-36, ...).
 */
export function hexSpiral(center: AxialCoord, maxRadius: number): AxialCoord[] {
  const results: AxialCoord[] = [center];
  for (let r = 1; r <= maxRadius; r++) {
    results.push(...hexRing(center, r));
  }
  return results;
}

/** Pixel projection for a flat-top hex grid, for SVG rendering. */
export function axialToPixel(a: AxialCoord, hexSize: number): { x: number; y: number } {
  const x = hexSize * ((3 / 2) * a.q);
  const y = hexSize * ((Math.sqrt(3) / 2) * a.q + Math.sqrt(3) * a.r);
  return { x, y };
}

/** The 6 corner points of a flat-top hexagon centered at (0,0) with the given size. */
export function hexCorners(hexSize: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return { x: hexSize * Math.cos(angle), y: hexSize * Math.sin(angle) };
  });
}
