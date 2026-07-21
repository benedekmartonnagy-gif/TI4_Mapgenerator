import type { AxialCoord, PlacedTile, SystemTile, TechSpecialty } from '../data/types';
import { distance } from './axial';

export const MAX_RELEVANT_DISTANCE = 3;
export const DISTANCE_WEIGHT: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

const COLOR_WEIGHT = 1.5;
// Diminishing returns per distinct tech specialty type found nearby: the 1st
// distinct type found is worth more than the 4th. Indexed by distinct count (0-4).
const TECH_DIVERSITY_VALUE = [0, 5, 9, 12, 14];
const LEGENDARY_BONUS = 5;
const ENTROPIC_SCAR_BONUS = 8;
const SHAPE_PLANET_WEIGHT = 1.5;
const POSITIONAL_STRENGTH = 0.6;

export interface TileInRange {
  tile: SystemTile;
  coord: AxialCoord;
  distance: number;
  weight: number;
}

export function homeCoordsBySeat(placements: PlacedTile[]): Map<number, AxialCoord> {
  const homes = new Map<number, AxialCoord>();
  for (const p of placements) {
    if (p.role === 'home' && p.seat !== undefined) homes.set(p.seat, p.coord);
  }
  return homes;
}

/** Pool tiles within MAX_RELEVANT_DISTANCE of a home, with precomputed distance/weight. */
export function tilesInRange(homeCoord: AxialCoord, placements: PlacedTile[]): TileInRange[] {
  const result: TileInRange[] = [];
  for (const p of placements) {
    if (p.role !== 'pool') continue;
    const d = distance(homeCoord, p.coord);
    if (d > MAX_RELEVANT_DISTANCE) continue;
    result.push({ tile: p.tile, coord: p.coord, distance: d, weight: DISTANCE_WEIGHT[d] ?? 0 });
  }
  return result;
}

/** Distance-weighted sum of resources+influence — identical to the original single-factor metric. */
export function rawRIScore(inRange: TileInRange[]): number {
  let total = 0;
  for (const t of inRange) {
    for (const planet of t.tile.planets) {
      total += (planet.resources + planet.influence) * t.weight;
    }
  }
  return total;
}

/** Rewards blue tiles, penalizes red tiles, distance-weighted. */
export function colorScore(inRange: TileInRange[]): number {
  let total = 0;
  for (const t of inRange) {
    if (t.tile.tileBack === 'blue') total += COLOR_WEIGHT * t.weight;
    else if (t.tile.tileBack === 'red') total -= COLOR_WEIGHT * t.weight;
  }
  return total;
}

/**
 * Rewards distinct tech specialty types nearby (diminishing returns per
 * additional distinct type), scaled by how close the best occurrence of
 * each type is.
 */
export function techDiversityScore(inRange: TileInRange[]): number {
  const bestWeightByType = new Map<TechSpecialty, number>();
  for (const t of inRange) {
    for (const planet of t.tile.planets) {
      if (!planet.techSpecialty) continue;
      const existing = bestWeightByType.get(planet.techSpecialty) ?? 0;
      if (t.weight > existing) bestWeightByType.set(planet.techSpecialty, t.weight);
    }
  }
  const distinctCount = bestWeightByType.size;
  if (distinctCount === 0) return 0;
  const avgBestWeight = Array.from(bestWeightByType.values()).reduce((a, b) => a + b, 0) / distinctCount;
  const tableValue = TECH_DIVERSITY_VALUE[Math.min(distinctCount, TECH_DIVERSITY_VALUE.length - 1)];
  return tableValue * (avgBestWeight / 3);
}

/** Bonus per legendary planet nearby, on top of its normal resource/influence value. */
export function legendaryScore(inRange: TileInRange[]): number {
  let total = 0;
  for (const t of inRange) {
    for (const planet of t.tile.planets) {
      if (planet.isLegendary) total += LEGENDARY_BONUS * t.weight;
    }
  }
  return total;
}

/** Bonus per Entropic Scar anomaly nearby — makes it a net positive for the seat, not just a red-tile penalty. */
export function entropicScarScore(inRange: TileInRange[]): number {
  let total = 0;
  for (const t of inRange) {
    if (t.tile.anomaly === 'entropicScar') total += ENTROPIC_SCAR_BONUS * t.weight;
  }
  return total;
}

/** True if `homeCoord` is strictly the single closest home to `tileCoord` among all seats. */
export function isExclusiveToSeat(tileCoord: AxialCoord, homeCoord: AxialCoord, otherHomeCoords: AxialCoord[]): boolean {
  const myDistance = distance(tileCoord, homeCoord);
  return otherHomeCoords.every((other) => myDistance < distance(tileCoord, other));
}

/**
 * Rewards planet count nearby (not tile count, not tech specialty), but only
 * for tiles exclusively closest to this seat — a tile equidistant from two
 * or more homes is contested and counts toward no one's score.
 */
export function shapeScore(inRange: TileInRange[], homeCoord: AxialCoord, otherHomeCoords: AxialCoord[]): number {
  let total = 0;
  for (const t of inRange) {
    if (t.tile.planets.length === 0) continue;
    if (!isExclusiveToSeat(t.coord, homeCoord, otherHomeCoords)) continue;
    total += SHAPE_PLANET_WEIGHT * t.weight * t.tile.planets.length;
  }
  return total;
}

export interface BalanceWeights {
  wRI?: number;
  wColor?: number;
  wTech?: number;
  wLegendary?: number;
  wShape?: number;
  wEntropicScar?: number;
}

const DEFAULT_WEIGHTS: Required<BalanceWeights> = {
  wRI: 1,
  wColor: 1,
  wTech: 1,
  wLegendary: 1,
  wShape: 1,
  wEntropicScar: 1,
};

/** Composite score for a single seat, given its home coord and every other seat's home coord. */
export function computeSingleSeatScore(
  homeCoord: AxialCoord,
  otherHomeCoords: AxialCoord[],
  placements: PlacedTile[],
  weights: BalanceWeights = {},
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const inRange = tilesInRange(homeCoord, placements);
  return (
    w.wRI * rawRIScore(inRange) +
    w.wColor * colorScore(inRange) +
    w.wTech * techDiversityScore(inRange) +
    w.wLegendary * legendaryScore(inRange) +
    w.wShape * shapeScore(inRange, homeCoord, otherHomeCoords) +
    w.wEntropicScar * entropicScarScore(inRange)
  );
}

export function computeSeatCompositeScores(placements: PlacedTile[], weights: BalanceWeights = {}): Map<number, number> {
  const homes = homeCoordsBySeat(placements);
  const scores = new Map<number, number>();
  for (const [seat, homeCoord] of homes) {
    const otherHomeCoords = Array.from(homes.entries())
      .filter(([s]) => s !== seat)
      .map(([, c]) => c);
    scores.set(seat, computeSingleSeatScore(homeCoord, otherHomeCoords, placements, weights));
  }
  return scores;
}

/**
 * Positional-fairness multiplier per seat, for boards with non-uniform home
 * spacing (only the 5-player board today — see layouts.ts). A seat with
 * closer neighbors than average gets a factor below 1, so the balancer must
 * give it a genuinely higher raw composite score to reach parity with
 * roomier seats. Reduces to exactly 1.0 for every seat on a uniformly-spaced
 * board (3p/4p/6p), since nearestHomeDistance === meanNearestHomeDistance there.
 */
export function computePositionalFactors(placements: PlacedTile[], strength = POSITIONAL_STRENGTH): Map<number, number> {
  const homes = homeCoordsBySeat(placements);
  const nearest = new Map<number, number>();
  for (const [seat, coord] of homes) {
    let min = Infinity;
    for (const [otherSeat, otherCoord] of homes) {
      if (otherSeat === seat) continue;
      min = Math.min(min, distance(coord, otherCoord));
    }
    nearest.set(seat, min);
  }
  const values = Array.from(nearest.values());
  const meanNearest = values.reduce((a, b) => a + b, 0) / values.length;

  const factors = new Map<number, number>();
  for (const [seat, d] of nearest) {
    const rawFactor = meanNearest === 0 ? 1 : d / meanNearest;
    factors.set(seat, 1 + strength * (rawFactor - 1));
  }
  return factors;
}
