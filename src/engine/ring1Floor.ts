import type { AxialCoord, PlacedTile } from '../data/types';
import { distance } from './axial';
import { violatesAnyConstraint } from './constraints';
import { computeRingStats } from './ringStats';
import { homeCoordsBySeat } from './scoring';

export const MIN_RING1_RESOURCES = 3;
export const MIN_RING1_INFLUENCE = 3;

function deficiency(homeCoord: AxialCoord, placements: PlacedTile[]): number {
  const { resources, influence } = computeRingStats(homeCoord, placements, 1);
  return Math.max(0, MIN_RING1_RESOURCES - resources) + Math.max(0, MIN_RING1_INFLUENCE - influence);
}

function sumOf(deficiencies: Map<number, number>): number {
  return Array.from(deficiencies.values()).reduce((a, b) => a + b, 0);
}

/** Seats whose home is adjacent (Ring 1) to any of the given coordinates. */
function seatsAdjacentTo(homes: Map<number, AxialCoord>, coords: AxialCoord[]): number[] {
  const result: number[] = [];
  for (const [seat, homeCoord] of homes) {
    if (coords.some((c) => distance(homeCoord, c) === 1)) result.push(seat);
  }
  return result;
}

/**
 * Greedy pairwise-swap repair pass guaranteeing every seat's Ring 1 (tiles
 * immediately adjacent to home) has at least MIN_RING1_RESOURCES resources
 * and MIN_RING1_INFLUENCE influence. Meant to run after the main composite
 * balance pass (balancePlacements in balance.ts) to patch specifically
 * lopsided Ring 1 resource/influence splits that a composite score can
 * otherwise mask entirely.
 *
 * Respects the same hard constraints as the balancer (wormhole/anomaly
 * adjacency, legendary distance, via violatesAnyConstraint) and falls back
 * to best-effort if a seed is genuinely infeasible — same fallback-allow
 * semantics already used for every other hard constraint in this codebase,
 * not a hard failure or reroll.
 *
 * Performance: only candidate swaps touching at least one deficient seat's
 * Ring 1 are considered, and only the seats whose Ring 1 tile set could
 * actually change (those adjacent to either swapped coordinate) have their
 * deficiency recomputed per candidate — every other seat's deficiency is
 * carried over from the running map rather than rescanned.
 */
export function enforceRing1Floors(
  placements: PlacedTile[],
  homeCoords: AxialCoord[],
  maxIterations = 200,
): PlacedTile[] {
  let current = placements.slice();
  const homes = homeCoordsBySeat(current); // home coordinates never move during repair

  let deficiencies = new Map<number, number>();
  for (const [seat, coord] of homes) deficiencies.set(seat, deficiency(coord, current));

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentTotal = sumOf(deficiencies);
    if (currentTotal === 0) break;

    const deficientHomeCoords = Array.from(homes.entries())
      .filter(([seat]) => (deficiencies.get(seat) ?? 0) > 0)
      .map(([, coord]) => coord);

    const poolIndexes = current.map((_, i) => i).filter((i) => current[i].role === 'pool');
    const ring1Indexes = poolIndexes.filter((i) =>
      deficientHomeCoords.some((homeCoord) => distance(homeCoord, current[i].coord) === 1),
    );

    let bestSwap: [number, number] | null = null;
    let bestTotal = currentTotal;
    let bestDeficiencies: Map<number, number> | null = null;

    for (const i of ring1Indexes) {
      for (const j of poolIndexes) {
        if (i === j) continue;

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

        const affectedSeats = seatsAdjacentTo(homes, [coordA, coordB]);
        const trialDeficiencies = new Map(deficiencies);
        for (const seat of affectedSeats) {
          trialDeficiencies.set(seat, deficiency(homes.get(seat)!, swapped));
        }

        const newTotal = sumOf(trialDeficiencies);
        if (newTotal < bestTotal) {
          bestTotal = newTotal;
          bestSwap = [i, j];
          bestDeficiencies = trialDeficiencies;
        }
      }
    }

    if (!bestSwap || !bestDeficiencies) break; // no improving legal swap found — best-effort stop

    const [i, j] = bestSwap;
    const next = current.slice();
    [next[i], next[j]] = [
      { ...next[j], coord: next[i].coord, role: next[i].role, seat: next[i].seat },
      { ...next[i], coord: next[j].coord, role: next[j].role, seat: next[j].seat },
    ];
    current = next;
    deficiencies = bestDeficiencies;
  }

  return current;
}
