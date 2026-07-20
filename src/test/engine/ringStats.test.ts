import { describe, expect, it } from 'vitest';
import { computeRingStats } from '../../engine/ringStats';
import type { AxialCoord, PlacedTile, SystemTile } from '../../data/types';

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `ring-test-${tileCounter}`,
    tileNumber: String(tileCounter),
    expansion: 'base',
    tileBack: 'blue',
    planets: [],
    isHyperlane: false,
    isMecatolRex: false,
    isHomeSystem: false,
    ...overrides,
  };
}

function pool(coord: AxialCoord, tileOverrides: Partial<SystemTile> = {}): PlacedTile {
  return { coord, role: 'pool', tile: tile(tileOverrides) };
}

function home(coord: AxialCoord, seat: number): PlacedTile {
  return { coord, role: 'home', seat, tile: tile({ isHomeSystem: true, tileBack: null }) };
}

const HOME: AxialCoord = { q: 0, r: 0 };

describe('computeRingStats', () => {
  it('only counts pool tiles at exactly the requested ring distance', () => {
    const placements = [
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 1, influence: 1 }] }), // ring 1
      pool({ q: 2, r: 0 }, { planets: [{ name: 'B', resources: 5, influence: 5 }] }), // ring 2
      pool({ q: 3, r: 0 }, { planets: [{ name: 'C', resources: 9, influence: 9 }] }), // ring 3, excluded
    ];
    const ring1 = computeRingStats(HOME, placements, 1);
    const ring2 = computeRingStats(HOME, placements, 2);
    expect(ring1.resources).toBe(1);
    expect(ring2.resources).toBe(5);
  });

  it('sums resources/influence and counts planets, tech specialties, traits, and legendary planets', () => {
    const placements = [
      pool({ q: 1, r: 0 }, {
        planets: [
          { name: 'A', resources: 2, influence: 1, trait: 'industrial', techSpecialty: 'warfare' },
          { name: 'B', resources: 1, influence: 3, trait: 'cultural', isLegendary: true },
        ],
      }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'C', resources: 0, influence: 2, trait: 'hazardous' }] }),
    ];
    const stats = computeRingStats(HOME, placements, 1);
    expect(stats.resources).toBe(3);
    expect(stats.influence).toBe(6);
    expect(stats.planetCount).toBe(3);
    expect(stats.techSpecialtyCount).toBe(1);
    expect(stats.traitCounts).toEqual({ industrial: 1, cultural: 1, hazardous: 1 });
    expect(stats.legendaryCount).toBe(1);
  });

  it('counts red-backed tiles as anomalies, regardless of planet content', () => {
    const placements = [
      pool({ q: 1, r: 0 }, { tileBack: 'red', planets: [] }),
      pool({ q: 1, r: -1 }, { tileBack: 'red', planets: [{ name: 'D', resources: 1, influence: 0 }] }),
      pool({ q: 0, r: -1 }, { tileBack: 'blue', planets: [{ name: 'E', resources: 1, influence: 0 }] }),
    ];
    const stats = computeRingStats(HOME, placements, 1);
    expect(stats.anomalyCount).toBe(2);
  });

  it('ignores home/mecatol placements even if coincidentally at the right distance', () => {
    const placements: PlacedTile[] = [{ coord: { q: 1, r: 0 }, role: 'home', seat: 0, tile: tile({ isHomeSystem: true, tileBack: null }) }];
    const stats = computeRingStats(HOME, placements, 1);
    expect(stats.planetCount).toBe(0);
    expect(stats.resources).toBe(0);
  });
});

describe('computeRingStats ring-2 exclusivity/neighbor-tie rule', () => {
  // S at origin; N1 and N2 are its two closest neighbors (distance 3 each);
  // F is a third, farther home (distance 6) that should never qualify a tie.
  const S: AxialCoord = { q: 0, r: 0 };
  const N1: AxialCoord = { q: 3, r: 0 };
  const N2: AxialCoord = { q: 0, r: 3 };
  const F: AxialCoord = { q: 6, r: 0 };
  const homes = [home(S, 0), home(N1, 1), home(N2, 2), home(F, 3)];

  it('counts a ring-2 tile exclusively closest to this seat', () => {
    const exclusive: AxialCoord = { q: -2, r: 0 }; // distance 2 from S, far from everyone else
    const placements = [...homes, pool(exclusive, { planets: [{ name: 'X', resources: 1, influence: 0 }] })];
    expect(computeRingStats(S, placements, 2).planetCount).toBe(1);
  });

  it('counts a ring-2 tile tied for closest between this seat and its nearest neighbor N1', () => {
    const tiedWithN1: AxialCoord = { q: 1, r: 1 }; // distance 2 from S, distance 2 from N1
    const placements = [...homes, pool(tiedWithN1, { planets: [{ name: 'Y', resources: 1, influence: 0 }] })];
    expect(computeRingStats(S, placements, 2).planetCount).toBe(1);
  });

  it('counts a ring-2 tile tied for closest between this seat and its second-nearest neighbor N2', () => {
    const tiedWithN2: AxialCoord = { q: -1, r: 2 }; // distance 2 from S, distance 2 from N2
    const placements = [...homes, pool(tiedWithN2, { planets: [{ name: 'Z', resources: 1, influence: 0 }] })];
    expect(computeRingStats(S, placements, 2).planetCount).toBe(1);
  });

  it('excludes a ring-2 tile that is strictly closer to a different player than to this seat', () => {
    const closerToN1: AxialCoord = { q: 2, r: 0 }; // distance 2 from S, distance 1 from N1
    const placements = [...homes, pool(closerToN1, { planets: [{ name: 'W', resources: 1, influence: 0 }] })];
    expect(computeRingStats(S, placements, 2).planetCount).toBe(0);
  });

  it('does not apply the exclusivity/tie restriction to ring 1', () => {
    // Same relative situation (closer to N1 than to S) but at ring 1 distance from S — should still count in full.
    const closerToN1AtRing1: AxialCoord = { q: 1, r: 0 }; // distance 1 from S, distance 2 from N1
    const placements = [...homes, pool(closerToN1AtRing1, { planets: [{ name: 'V', resources: 1, influence: 0 }] })];
    expect(computeRingStats(S, placements, 1).planetCount).toBe(1);
  });
});
