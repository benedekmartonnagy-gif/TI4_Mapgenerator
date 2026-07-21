import { describe, expect, it } from 'vitest';
import { enforceTotalSpread, MAX_TOTAL_SPREAD, ring1Plus2Total } from '../../engine/totalSpread';
import { computeRingStats } from '../../engine/ringStats';
import { MIN_RING1_INFLUENCE, MIN_RING1_RESOURCES } from '../../engine/ring1Floor';
import type { AxialCoord, PlacedTile, SystemTile } from '../../data/types';

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `spread-test-${tileCounter}`,
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

const HOME0: AxialCoord = { q: 0, r: 0 };
const HOME1: AxialCoord = { q: 20, r: 0 };

describe('enforceTotalSpread', () => {
  it('reduces a large Ring1+Ring2 total spread to within MAX_TOTAL_SPREAD by swapping in a closer-valued tile', () => {
    const placements: PlacedTile[] = [
      home(HOME0, 0),
      home(HOME1, 1),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'Rich', resources: 20, influence: 0 }] }), // home0 ring1, total 20
      pool({ q: 40, r: 40 }, { planets: [{ name: 'Mid', resources: 10, influence: 0 }] }), // far away, total 10
      pool({ q: 41, r: 40 }, { planets: [{ name: 'Small', resources: 5, influence: 0 }] }), // far away, total 5
    ];

    const result = enforceTotalSpread(placements, [HOME0, HOME1]);
    const total0 = ring1Plus2Total(HOME0, result);
    const total1 = ring1Plus2Total(HOME1, result);

    expect(Math.abs(total0 - total1)).toBeLessThanOrEqual(MAX_TOTAL_SPREAD);
  });

  it('leaves an already-compliant spread untouched', () => {
    const placements: PlacedTile[] = [
      home(HOME0, 0),
      home(HOME1, 1),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 4, influence: 4 }] }), // total 8
      pool({ q: 21, r: 0 }, { planets: [{ name: 'B', resources: 3, influence: 2 }] }), // total 5, spread 3
    ];

    const result = enforceTotalSpread(placements, [HOME0, HOME1]);

    expect(result.map((p) => [p.coord, p.tile.id])).toEqual(placements.map((p) => [p.coord, p.tile.id]));
  });

  it('never breaks the legendary-distance constraint to fix the spread, leaving it unresolved if no legal fix exists', () => {
    const placements: PlacedTile[] = [
      home(HOME0, 0),
      home(HOME1, 1),
      pool({ q: 1, r: 0 }, { planets: [] }), // home0 ring1, total 0
      pool({ q: 21, r: 0 }, { planets: [{ name: 'Rich', resources: 10, influence: 10 }] }), // home1 ring1, total 20
      // Could fix the spread if it could land at either home's ring 1, but a legendary
      // planet can never legally sit within MIN_LEGENDARY_DISTANCE of any home.
      pool({ q: 50, r: 50 }, { planets: [{ name: 'Trap', resources: 10, influence: 10, isLegendary: true }] }),
    ];

    const before = Math.abs(ring1Plus2Total(HOME0, placements) - ring1Plus2Total(HOME1, placements));
    const result = enforceTotalSpread(placements, [HOME0, HOME1]);
    const after = Math.abs(ring1Plus2Total(HOME0, result) - ring1Plus2Total(HOME1, result));

    expect(after).toBe(before);
    expect(after).toBeGreaterThan(MAX_TOTAL_SPREAD);
  });

  it('never drags a Ring-1-floor-compliant seat back under the floor to fix the spread', () => {
    const placements: PlacedTile[] = [
      home(HOME0, 0),
      home(HOME1, 1),
      // home0's Ring 1 sits exactly at the floor (3 resources, 3 influence), split across two tiles.
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 2, influence: 2 }] }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'B', resources: 1, influence: 1 }] }),
      // A zero-value filler far from both homes — swapping it in for either home0 tile
      // would close the spread, but would also drop home0 under the floor.
      pool({ q: 50, r: 50 }, { planets: [] }),
      // home1 has nothing nearby: total 0, spread(home0=6, home1=0) = 6, just over MAX_TOTAL_SPREAD (5).
    ];

    const result = enforceTotalSpread(placements, [HOME0, HOME1]);
    const stats0 = computeRingStats(HOME0, result, 1);

    expect(stats0.resources).toBeGreaterThanOrEqual(MIN_RING1_RESOURCES);
    expect(stats0.influence).toBeGreaterThanOrEqual(MIN_RING1_INFLUENCE);
    // Left unresolved — the only spread-reducing move available would have broken the floor.
    expect(Math.abs(ring1Plus2Total(HOME0, result) - ring1Plus2Total(HOME1, result))).toBeGreaterThan(MAX_TOTAL_SPREAD);
  });
});
