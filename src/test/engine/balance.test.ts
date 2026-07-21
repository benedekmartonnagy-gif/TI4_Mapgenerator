import { describe, expect, it } from 'vitest';
import { balancePlacements } from '../../engine/balance';
import { computeSeatCompositeScores, MAX_RELEVANT_DISTANCE } from '../../engine/scoring';
import { generateMap } from '../../engine/generate';
import { BOARD_LAYOUTS } from '../../data/layouts';
import { buildShuffledPool } from '../../engine/pool';
import { placeTiles } from '../../engine/placement';
import { mulberry32 } from '../../engine/rng';
import { MIN_LEGENDARY_DISTANCE } from '../../engine/constraints';
import { distance } from '../../engine/axial';
import type { AxialCoord, PlacedTile, SystemTile } from '../../data/types';

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `bal-test-${tileCounter}`,
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

describe('hard constraints survive the composite-scoring rewrite', () => {
  it('never places a legendary planet within MIN_LEGENDARY_DISTANCE of a home, even when doing so would improve composite balance', () => {
    const home0: AxialCoord = { q: 0, r: 0 };
    const home1: AxialCoord = { q: 10, r: 0 };
    // Too-close slot (distance 1, illegal for legendary) currently holds a low-value tile;
    // a safely-distant slot (distance 3) holds a legendary planet. Seat0 is far behind
    // seat1 in composite score, so moving the legendary tile closer (raising its weight)
    // would look like the best possible improving swap — if constraints didn't block it.
    const tooClose: AxialCoord = { q: 1, r: 0 };
    const safe: AxialCoord = { q: 3, r: 0 };
    const seat1Tile: AxialCoord = { q: 9, r: 0 };

    const placements: PlacedTile[] = [
      home(home0, 0),
      home(home1, 1),
      pool(tooClose, { tileBack: 'blue', planets: [{ name: 'Low', resources: 1, influence: 0 }] }),
      pool(safe, { tileBack: 'blue', planets: [{ name: 'Legend', resources: 2, influence: 2, isLegendary: true }] }),
      pool(seat1Tile, { tileBack: 'blue', planets: [{ name: 'Rich', resources: 5, influence: 5 }] }),
    ];

    const result = balancePlacements(placements, [home0, home1]);

    for (const p of result) {
      if (p.role !== 'pool') continue;
      if (p.tile.planets.some((pl) => pl.isLegendary)) {
        const nearestHome = Math.min(distance(p.coord, home0), distance(p.coord, home1));
        expect(nearestHome).toBeGreaterThanOrEqual(MIN_LEGENDARY_DISTANCE);
      }
    }
  });
});

describe('balancing optimizes the composite score, not raw resources+influence', () => {
  it('makes no swap when composite spread is already within tolerance, even though a raw-R+I-improving swap exists', () => {
    const home0: AxialCoord = { q: 0, r: 0 };
    const home1: AxialCoord = { q: 10, r: 0 };
    const p: AxialCoord = { q: 1, r: 0 }; // weight 3, seat0-only
    const q: AxialCoord = { q: 3, r: 0 }; // weight 1, seat0-only
    const r: AxialCoord = { q: 9, r: 0 }; // weight 3, seat1-only

    // Engineered so composite spread (~0.5) is already under the default tolerance (3),
    // but a raw-R+I-improving swap of p/q (spread 8 -> 4) is available. If the balancer
    // were still optimizing raw R+I, it would apply that swap; since it optimizes the
    // composite score instead, it should recognize things are already balanced and stop.
    const placements: PlacedTile[] = [
      home(home0, 0),
      home(home1, 1),
      pool(p, { tileBack: 'red', planets: [{ name: 'P', resources: 4, influence: 4 }] }),
      pool(q, { tileBack: 'blue', planets: [{ name: 'Q', resources: 1, influence: 1 }] }),
      pool(r, { tileBack: 'blue', planets: [{ name: 'R', resources: 3, influence: 3 }] }),
    ];

    const result = balancePlacements(placements, [home0, home1]);
    const byId = new Map(result.map((placed) => [placed.tile.id, placed.coord]));

    // Unchanged: the tile originally at p is still at p, etc.
    for (const original of placements) {
      if (original.role !== 'pool') continue;
      expect(byId.get(original.tile.id)).toEqual(original.coord);
    }
  });
});

describe('Entropic Scar is a positive draw for the balancer', () => {
  it('pulls a distant Entropic Scar tile into the lagging seat\'s range to close the composite-score gap', () => {
    const home0: AxialCoord = { q: 0, r: 0 };
    const home1: AxialCoord = { q: 10, r: 0 };
    const leaderSlot: AxialCoord = { q: 1, r: 0 }; // seat0's ring 1: already valuable
    const laggerSlot: AxialCoord = { q: 9, r: 0 }; // seat1's ring 1: worthless, the swap target
    const farAway: AxialCoord = { q: 30, r: 30 }; // outside MAX_RELEVANT_DISTANCE of both homes

    const placements: PlacedTile[] = [
      home(home0, 0),
      home(home1, 1),
      pool(leaderSlot, { tileBack: 'blue', planets: [{ name: 'Leader', resources: 2, influence: 2 }] }),
      pool(laggerSlot, { tileBack: 'blue', planets: [] }),
      pool(farAway, { tileBack: 'red', anomaly: 'entropicScar', planets: [] }),
    ];

    expect(distance(home0, farAway)).toBeGreaterThan(MAX_RELEVANT_DISTANCE);

    const result = balancePlacements(placements, [home0, home1]);
    const entropicScarPlacement = result.find((p) => p.tile.anomaly === 'entropicScar')!;

    expect(distance(home1, entropicScarPlacement.coord)).toBeLessThanOrEqual(MAX_RELEVANT_DISTANCE);
  });
});

describe('5-player positional fairness', () => {
  it('crowded seats (closer neighbors) trend toward higher raw composite scores than roomy seats after balancing', () => {
    const CROWDED_SEATS = [1, 2, 3];
    const ROOMY_SEATS = [0, 4];
    const SEEDS = Array.from({ length: 12 }, (_, i) => i * 777 + 3);

    let crowdedTotal = 0;
    let roomyTotal = 0;

    for (const seed of SEEDS) {
      const map = generateMap({ playerCount: 5, expansions: ['base', 'pok'], seed });
      const composite = computeSeatCompositeScores(map.placements);
      for (const seat of CROWDED_SEATS) crowdedTotal += composite.get(seat) ?? 0;
      for (const seat of ROOMY_SEATS) roomyTotal += composite.get(seat) ?? 0;
    }

    const crowdedAvg = crowdedTotal / (CROWDED_SEATS.length * SEEDS.length);
    const roomyAvg = roomyTotal / (ROOMY_SEATS.length * SEEDS.length);
    expect(crowdedAvg).toBeGreaterThan(roomyAvg);
  });
});

describe('positional factor has no effect on uniformly-spaced boards', () => {
  for (const playerCount of [3, 4, 6] as const) {
    it(`${playerCount}p: balancing is identical whether positionalStrength is 0 or default`, () => {
      const layout = BOARD_LAYOUTS[playerCount];
      const poolSlotCount = layout.slots.filter((s) => s.role === 'pool').length;
      const rng = mulberry32(12345);
      const shuffledPool = buildShuffledPool(['base', 'pok'], poolSlotCount, rng);
      const initialPlacements = placeTiles(layout, shuffledPool, ['base', 'pok']);
      const homeCoords = initialPlacements.filter((p) => p.role === 'home').map((p) => p.coord);

      const withDefault = balancePlacements(initialPlacements, homeCoords, { positionalStrength: 0.6 });
      const withZero = balancePlacements(initialPlacements, homeCoords, { positionalStrength: 0 });

      const idsDefault = withDefault.map((p) => `${p.coord.q},${p.coord.r}:${p.tile.id}`).sort();
      const idsZero = withZero.map((p) => `${p.coord.q},${p.coord.r}:${p.tile.id}`).sort();
      expect(idsDefault).toEqual(idsZero);
    });
  }
});
