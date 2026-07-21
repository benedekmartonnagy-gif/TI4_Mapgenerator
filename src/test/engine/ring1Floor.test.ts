import { describe, expect, it } from 'vitest';
import { enforceRing1Floors, MIN_RING1_INFLUENCE, MIN_RING1_RESOURCES } from '../../engine/ring1Floor';
import { computeRingStats } from '../../engine/ringStats';
import type { AxialCoord, PlacedTile, SystemTile } from '../../data/types';

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `r1f-test-${tileCounter}`,
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

describe('enforceRing1Floors', () => {
  it('repairs a lopsided Ring 1 (all resources, no influence) by swapping in a distant influence-only tile', () => {
    const placements: PlacedTile[] = [
      home(HOME, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 2, influence: 0 }] }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'B', resources: 2, influence: 0 }] }),
      pool({ q: 0, r: -1 }, { planets: [{ name: 'C', resources: 2, influence: 0 }] }),
      pool({ q: 5, r: 5 }, { planets: [{ name: 'D', resources: 0, influence: 5 }] }), // far away, ring 1 of nobody
    ];

    const result = enforceRing1Floors(placements, [HOME]);
    const stats = computeRingStats(HOME, result, 1);

    expect(stats.resources).toBeGreaterThanOrEqual(MIN_RING1_RESOURCES);
    expect(stats.influence).toBeGreaterThanOrEqual(MIN_RING1_INFLUENCE);
  });

  it('leaves an already-compliant Ring 1 untouched', () => {
    const placements: PlacedTile[] = [
      home(HOME, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 2, influence: 2 }] }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'B', resources: 1, influence: 1 }] }),
    ];

    const result = enforceRing1Floors(placements, [HOME]);

    expect(result.map((p) => [p.coord, p.tile.id])).toEqual(placements.map((p) => [p.coord, p.tile.id]));
  });

  it('never breaks a wormhole adjacency constraint to satisfy the floor, and leaves the seat deficient if no legal fix exists', () => {
    const obstacle: AxialCoord = { q: 2, r: 0 }; // ring 2 of home, neighbor of the ring-1 slot below
    const ring1Slot: AxialCoord = { q: 1, r: 0 };
    const trapTile: AxialCoord = { q: 10, r: 10 }; // has the stats to fix the floor, but also a conflicting wormhole

    const placements: PlacedTile[] = [
      home(HOME, 0),
      pool(ring1Slot, { planets: [] }), // deficient: 0 resources, 0 influence
      pool(obstacle, { wormhole: 'alpha', planets: [] }),
      pool(trapTile, {
        wormhole: 'alpha',
        planets: [{ name: 'Trap', resources: MIN_RING1_RESOURCES, influence: MIN_RING1_INFLUENCE }],
      }),
    ];

    const result = enforceRing1Floors(placements, [HOME]);
    const stats = computeRingStats(HOME, result, 1);

    // Still deficient: the only tile that could have fixed it was illegal to place there.
    expect(stats.resources).toBeLessThan(MIN_RING1_RESOURCES);
    expect(stats.influence).toBeLessThan(MIN_RING1_INFLUENCE);
    // The deficient slot's tile never moved.
    const ring1Placement = result.find((p) => p.coord.q === ring1Slot.q && p.coord.r === ring1Slot.r);
    expect(ring1Placement?.tile.planets.length).toBe(0);
  });
});
