import type { AxialCoord, PlacedTile, PlanetTrait } from '../data/types';
import { distance } from './axial';
import { isExclusiveToSeat } from './scoring';

export interface RingStats {
  resources: number;
  influence: number;
  planetCount: number;
  techSpecialtyCount: number;
  traitCounts: Record<PlanetTrait, number>;
  legendaryCount: number;
  /** Red-backed tiles in this ring (the user-facing definition of "anomaly" here). */
  anomalyCount: number;
}

function emptyRingStats(): RingStats {
  return {
    resources: 0,
    influence: 0,
    planetCount: 0,
    techSpecialtyCount: 0,
    traitCounts: { hazardous: 0, industrial: 0, cultural: 0 },
    legendaryCount: 0,
    anomalyCount: 0,
  };
}

/** The `count` other homes nearest to `homeCoord`, closest first. */
function nearestHomes(homeCoord: AxialCoord, otherHomeCoords: AxialCoord[], count: number): AxialCoord[] {
  return otherHomeCoords
    .slice()
    .sort((a, b) => distance(homeCoord, a) - distance(homeCoord, b))
    .slice(0, count);
}

/**
 * A ring-2 tile only counts toward a seat's stats if it's either exclusively
 * closest to that seat (same rule as the balancer's shapeScore), or tied for
 * closest between that seat and one of its two nearest neighbors — a fair
 * contested border tile. A tile closer to, or tied with, some other player
 * doesn't count at all.
 */
function isRing2Eligible(tileCoord: AxialCoord, homeCoord: AxialCoord, otherHomeCoords: AxialCoord[]): boolean {
  if (isExclusiveToSeat(tileCoord, homeCoord, otherHomeCoords)) return true;
  const myDistance = distance(tileCoord, homeCoord);
  const closestNeighbors = nearestHomes(homeCoord, otherHomeCoords, 2);
  return closestNeighbors.some((neighbor) => distance(tileCoord, neighbor) === myDistance);
}

/**
 * Stats for pool tiles exactly `ring` hex-steps from a seat's home (ring 1 =
 * adjacent, ring 2 = two steps out). Ring 2 additionally requires the tile to
 * be exclusively this seat's or a fair contested tile with one of its two
 * closest neighbors (see isRing2Eligible) — ring 1 has no such restriction.
 */
export function computeRingStats(homeCoord: AxialCoord, placements: PlacedTile[], ring: number): RingStats {
  const otherHomeCoords = placements
    .filter((p) => p.role === 'home' && (p.coord.q !== homeCoord.q || p.coord.r !== homeCoord.r))
    .map((p) => p.coord);

  const stats = emptyRingStats();
  for (const p of placements) {
    if (p.role !== 'pool') continue;
    if (distance(homeCoord, p.coord) !== ring) continue;
    if (ring === 2 && !isRing2Eligible(p.coord, homeCoord, otherHomeCoords)) continue;

    if (p.tile.tileBack === 'red') stats.anomalyCount += 1;

    for (const planet of p.tile.planets) {
      stats.resources += planet.resources;
      stats.influence += planet.influence;
      stats.planetCount += 1;
      if (planet.techSpecialty) stats.techSpecialtyCount += 1;
      if (planet.trait) stats.traitCounts[planet.trait] += 1;
      if (planet.isLegendary) stats.legendaryCount += 1;
    }
  }
  return stats;
}
