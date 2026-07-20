import type { AxialCoord, PlacedTile } from '../data/types';
import { distance } from './axial';
import { violatesAnyConstraint } from './constraints';
import {
  MAX_RELEVANT_DISTANCE,
  DISTANCE_WEIGHT,
  homeCoordsBySeat,
  computeSingleSeatScore,
  computePositionalFactors,
  type BalanceWeights,
} from './scoring';

function tileValue(tile: PlacedTile['tile']): number {
  return tile.planets.reduce((sum, p) => sum + p.resources + p.influence, 0);
}

function seatValue(homeCoord: AxialCoord, placements: PlacedTile[]): number {
  let total = 0;
  for (const p of placements) {
    if (p.role !== 'pool') continue;
    const d = distance(homeCoord, p.coord);
    if (d > MAX_RELEVANT_DISTANCE) continue;
    total += tileValue(p.tile) * (DISTANCE_WEIGHT[d] ?? 0);
  }
  return total;
}

/** Legacy single-factor (raw resources+influence only) seat values. Kept for reference/simple-mode use; not used by balancePlacements anymore. */
export function computeSeatValues(placements: PlacedTile[]): Map<number, number> {
  const homesBySeat = homeCoordsBySeat(placements);
  const values = new Map<number, number>();
  for (const [seat, coord] of homesBySeat) {
    values.set(seat, seatValue(coord, placements));
  }
  return values;
}

/** Distance-weighted raw resource/influence totals per seat, for display (uses the same weighting as the balancing metric). */
export function computeSeatRawTotals(placements: PlacedTile[]): Map<number, { resources: number; influence: number }> {
  const homesBySeat = homeCoordsBySeat(placements);
  const totals = new Map<number, { resources: number; influence: number }>();
  for (const [seat, homeCoord] of homesBySeat) {
    let resources = 0;
    let influence = 0;
    for (const p of placements) {
      if (p.role !== 'pool') continue;
      const d = distance(homeCoord, p.coord);
      if (d > MAX_RELEVANT_DISTANCE) continue;
      const weight = DISTANCE_WEIGHT[d] ?? 0;
      for (const planet of p.tile.planets) {
        resources += planet.resources * weight;
        influence += planet.influence * weight;
      }
    }
    totals.set(seat, { resources, influence });
  }
  return totals;
}

/** Composite score (tile-back mix, tech diversity, legendary bonus, exclusive-planet shape, raw R+I) × positional-fairness factor, per seat. */
export function computeAdjustedSeatScores(
  placements: PlacedTile[],
  weights?: BalanceWeights,
  positionalStrength?: number,
): Map<number, number> {
  const homes = homeCoordsBySeat(placements);
  const positionalFactors = computePositionalFactors(placements, positionalStrength);
  const scores = new Map<number, number>();
  for (const [seat, homeCoord] of homes) {
    const otherHomeCoords = Array.from(homes.entries())
      .filter(([s]) => s !== seat)
      .map(([, c]) => c);
    const raw = computeSingleSeatScore(homeCoord, otherHomeCoords, placements, weights);
    scores.set(seat, raw * (positionalFactors.get(seat) ?? 1));
  }
  return scores;
}

/** Seats whose home is within MAX_RELEVANT_DISTANCE of any of the given coordinates. */
function seatsWithinRangeOf(homes: Map<number, AxialCoord>, coords: AxialCoord[]): number[] {
  const result: number[] = [];
  for (const [seat, homeCoord] of homes) {
    if (coords.some((c) => distance(homeCoord, c) <= MAX_RELEVANT_DISTANCE)) result.push(seat);
  }
  return result;
}

function spread(values: Map<number, number>): number {
  const nums = Array.from(values.values());
  return Math.max(...nums) - Math.min(...nums);
}

export interface BalanceOptions {
  tolerance?: number;
  maxIterations?: number;
  weights?: BalanceWeights;
  positionalStrength?: number;
}

/**
 * Greedy pairwise-swap balancing pass: repeatedly swaps the two pool tiles
 * whose swap most reduces the max-min spread of per-seat adjusted composite
 * score (raw resources+influence, tile-back color mix, tech specialty
 * diversity, legendary bonus, exclusive-planet shape — see scoring.ts —
 * times a positional-fairness factor for boards with uneven home spacing),
 * rejecting swaps that would break adjacency constraints, until the spread
 * is within tolerance or the iteration cap is hit.
 *
 * Performance note: only the seats whose in-range tile set could actually
 * change (those within MAX_RELEVANT_DISTANCE of either swapped coordinate)
 * have their score recomputed per candidate swap; every other seat's score
 * is carried over from the running `scores` map rather than rescanned.
 */
export function balancePlacements(
  placements: PlacedTile[],
  homeCoords: AxialCoord[],
  options: BalanceOptions = {},
): PlacedTile[] {
  const tolerance = options.tolerance ?? 3;
  const maxIterations = options.maxIterations ?? 500;

  let current = placements.slice();
  const homes = homeCoordsBySeat(current); // home coordinates never move during balancing
  const positionalFactors = computePositionalFactors(current, options.positionalStrength);
  const otherHomeCoordsBySeat = new Map<number, AxialCoord[]>();
  for (const [seat] of homes) {
    otherHomeCoordsBySeat.set(
      seat,
      Array.from(homes.entries())
        .filter(([s]) => s !== seat)
        .map(([, c]) => c),
    );
  }

  const scoreSeat = (seat: number, placementsForScore: PlacedTile[]): number => {
    const homeCoord = homes.get(seat)!;
    const otherHomeCoords = otherHomeCoordsBySeat.get(seat)!;
    const raw = computeSingleSeatScore(homeCoord, otherHomeCoords, placementsForScore, options.weights);
    return raw * (positionalFactors.get(seat) ?? 1);
  };

  let scores = new Map<number, number>();
  for (const [seat] of homes) scores.set(seat, scoreSeat(seat, current));

  for (let iter = 0; iter < maxIterations; iter++) {
    if (spread(scores) <= tolerance) break;

    const poolIndexes = current.map((_, i) => i).filter((i) => current[i].role === 'pool');
    let bestSwap: [number, number] | null = null;
    let bestSpread = spread(scores);
    let bestScoresAfterSwap: Map<number, number> | null = null;

    for (let a = 0; a < poolIndexes.length; a++) {
      for (let b = a + 1; b < poolIndexes.length; b++) {
        const i = poolIndexes[a];
        const j = poolIndexes[b];
        const coordA = current[i].coord;
        const coordB = current[j].coord;

        const swapped = current.slice();
        [swapped[i], swapped[j]] = [
          { ...swapped[j], coord: swapped[i].coord, role: swapped[i].role, seat: swapped[i].seat },
          { ...swapped[i], coord: swapped[j].coord, role: swapped[j].role, seat: swapped[j].seat },
        ];

        const byCoord = new Map(swapped.map((p) => [`${p.coord.q},${p.coord.r}`, p]));
        const iViolates = violatesAnyConstraint(swapped[i].coord, swapped[i].tile, byCoord, homeCoords);
        const jViolates = violatesAnyConstraint(swapped[j].coord, swapped[j].tile, byCoord, homeCoords);
        if (iViolates || jViolates) continue;

        const affectedSeats = seatsWithinRangeOf(homes, [coordA, coordB]);
        const trialScores = new Map(scores);
        for (const seat of affectedSeats) {
          trialScores.set(seat, scoreSeat(seat, swapped));
        }

        const newSpread = spread(trialScores);
        if (newSpread < bestSpread) {
          bestSpread = newSpread;
          bestSwap = [i, j];
          bestScoresAfterSwap = trialScores;
        }
      }
    }

    if (!bestSwap || !bestScoresAfterSwap) break; // no improving swap found within constraints
    const [i, j] = bestSwap;
    const next = current.slice();
    [next[i], next[j]] = [
      { ...next[j], coord: next[i].coord, role: next[i].role, seat: next[i].seat },
      { ...next[i], coord: next[j].coord, role: next[j].role, seat: next[j].seat },
    ];
    current = next;
    scores = bestScoresAfterSwap;
  }

  return current;
}
