import type { AxialCoord, PlacedTile } from '../data/types';
import { distance } from './axial';
import { violatesAnyConstraint } from './constraints';
import { MIN_RING1_INFLUENCE, MIN_RING1_RESOURCES } from './ring1Floor';
import { computeRingStats } from './ringStats';
import { homeCoordsBySeat } from './scoring';

export const MAX_TOTAL_SPREAD = 5;

/** Combined resources+influence across Ring 1 and Ring 2 — matches the Stats Panel's "Total" column. */
export function ring1Plus2Total(homeCoord: AxialCoord, placements: PlacedTile[]): number {
  const ring1 = computeRingStats(homeCoord, placements, 1);
  const ring2 = computeRingStats(homeCoord, placements, 2);
  return ring1.resources + ring1.influence + ring2.resources + ring2.influence;
}

function meetsRing1Floor(homeCoord: AxialCoord, placements: PlacedTile[]): boolean {
  const ring1 = computeRingStats(homeCoord, placements, 1);
  return ring1.resources >= MIN_RING1_RESOURCES && ring1.influence >= MIN_RING1_INFLUENCE;
}

function spread(totals: Map<number, number>): number {
  const values = Array.from(totals.values());
  return Math.max(...values) - Math.min(...values);
}

/** Seats whose Ring 1 or Ring 2 could include either coordinate (distance <= 2). */
function seatsWithinRelevantRange(homes: Map<number, AxialCoord>, coords: AxialCoord[]): number[] {
  const result: number[] = [];
  for (const [seat, homeCoord] of homes) {
    if (coords.some((c) => distance(homeCoord, c) <= 2)) result.push(seat);
  }
  return result;
}

/**
 * Greedy pairwise-swap repair pass guaranteeing no seat's Ring1+Ring2 total
 * (resources+influence) differs from any other seat's by more than
 * MAX_TOTAL_SPREAD. Meant to run after enforceRing1Floors (ring1Floor.ts) so
 * the two rules don't fight over the same tiles: any seat that currently
 * meets the Ring 1 floor is protected from candidate swaps here, so fixing
 * spread never silently drags a compliant seat back under the floor. Also
 * respects the same hard constraints as every other repair pass in this
 * codebase (wormhole/anomaly adjacency, legendary distance, via
 * violatesAnyConstraint) and falls back to best-effort — leaving the spread
 * unresolved — if a seed is genuinely infeasible under those protections.
 */
export function enforceTotalSpread(
  placements: PlacedTile[],
  homeCoords: AxialCoord[],
  maxSpread = MAX_TOTAL_SPREAD,
  maxIterations = 300,
): PlacedTile[] {
  let current = placements.slice();
  const homes = homeCoordsBySeat(current); // home coordinates never move during repair

  const protectedFloorSeats = new Set<number>();
  for (const [seat, coord] of homes) {
    if (meetsRing1Floor(coord, current)) protectedFloorSeats.add(seat);
  }

  let totals = new Map<number, number>();
  for (const [seat, coord] of homes) totals.set(seat, ring1Plus2Total(coord, current));

  for (let iter = 0; iter < maxIterations; iter++) {
    if (spread(totals) <= maxSpread) break;

    const poolIndexes = current.map((_, i) => i).filter((i) => current[i].role === 'pool');
    let bestSwap: [number, number] | null = null;
    let bestSpread = spread(totals);
    let bestTotals: Map<number, number> | null = null;

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

        const affectedSeats = seatsWithinRelevantRange(homes, [coordA, coordB]);

        const breaksProtectedFloor = affectedSeats.some(
          (seat) => protectedFloorSeats.has(seat) && !meetsRing1Floor(homes.get(seat)!, swapped),
        );
        if (breaksProtectedFloor) continue;

        const trialTotals = new Map(totals);
        for (const seat of affectedSeats) {
          trialTotals.set(seat, ring1Plus2Total(homes.get(seat)!, swapped));
        }

        const newSpread = spread(trialTotals);
        if (newSpread < bestSpread) {
          bestSpread = newSpread;
          bestSwap = [i, j];
          bestTotals = trialTotals;
        }
      }
    }

    if (!bestSwap || !bestTotals) break; // no improving legal swap found — best-effort stop

    const [i, j] = bestSwap;
    const next = current.slice();
    [next[i], next[j]] = [
      { ...next[j], coord: next[i].coord, role: next[i].role, seat: next[i].seat },
      { ...next[i], coord: next[j].coord, role: next[j].role, seat: next[j].seat },
    ];
    current = next;
    totals = bestTotals;
  }

  return current;
}
