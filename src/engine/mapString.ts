import type { AxialCoord, GeneratedMap } from '../data/types';
import { add, key, scale } from './axial';

/**
 * Unit directions in true clockwise-from-north bearing order (0°, 60°, ...,
 * 300°), for the flat-top hex grid used throughout this app. This is
 * deliberately separate from `AXIAL_DIRECTIONS` in axial.ts, which — despite
 * its comment — walks counter-clockwise starting from the southwest (that
 * numbering is only used as a stable community reference index elsewhere in
 * this codebase, e.g. layouts.ts, and isn't meant to describe a physical
 * walking order).
 */
const CLOCKWISE_FROM_NORTH: AxialCoord[] = [
  { q: 0, r: -1 }, // north
  { q: 1, r: -1 }, // 60°
  { q: 1, r: 0 }, // 120°
  { q: 0, r: 1 }, // 180° (south)
  { q: -1, r: 1 }, // 240°
  { q: -1, r: 0 }, // 300°
];

/** All hexes at exactly `radius` rings from `center`, walked clockwise starting due north. */
export function ringClockwiseFromNorth(center: AxialCoord, radius: number): AxialCoord[] {
  if (radius === 0) return [center];
  const results: AxialCoord[] = [];
  for (let side = 0; side < 6; side++) {
    const corner = add(center, scale(CLOCKWISE_FROM_NORTH[side], radius));
    const edgeDir = CLOCKWISE_FROM_NORTH[(side + 2) % 6];
    for (let step = 0; step < radius; step++) {
      results.push(add(corner, scale(edgeDir, step)));
    }
  }
  return results;
}

const MECATOL: AxialCoord = { q: 0, r: 0 };

/**
 * The 36-token map string for twilightwars.com import: rings 1-3 only
 * (Mecatol is always fixed and omitted), ring-by-ring, clockwise from north
 * within each ring. A position is "0" if it's a home system or isn't used
 * at all by this player count's board; otherwise it's the tile's number.
 */
export function buildMapString(map: GeneratedMap): string {
  const placementByCoord = new Map(map.placements.map((p) => [key(p.coord), p]));

  const tokens: string[] = [];
  for (let ring = 1; ring <= 3; ring++) {
    for (const coord of ringClockwiseFromNorth(MECATOL, ring)) {
      const placement = placementByCoord.get(key(coord));
      tokens.push(!placement || placement.role === 'home' ? '0' : placement.tile.tileNumber);
    }
  }
  return tokens.join(', ');
}
