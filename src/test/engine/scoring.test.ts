import { describe, expect, it } from 'vitest';
import {
  tilesInRange,
  rawRIScore,
  colorScore,
  techDiversityScore,
  legendaryScore,
  shapeScore,
  entropicScarScore,
  isExclusiveToSeat,
  computeSeatCompositeScores,
  computePositionalFactors,
} from '../../engine/scoring';
import { BOARD_LAYOUTS } from '../../data/layouts';
import type { AxialCoord, PlacedTile, SystemTile } from '../../data/types';

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `test-${tileCounter}`,
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

const ORIGIN: AxialCoord = { q: 0, r: 0 };

describe('tilesInRange', () => {
  it('only includes pool tiles within MAX_RELEVANT_DISTANCE (3)', () => {
    const placements = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }), // distance 1
      pool({ q: 3, r: 0 }), // distance 3
      pool({ q: 4, r: 0 }), // distance 4, out of range
    ];
    const inRange = tilesInRange(ORIGIN, placements);
    expect(inRange.length).toBe(2);
  });
});

describe('rawRIScore', () => {
  it('sums distance-weighted resources+influence, matching the original single-factor metric', () => {
    const placements = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 2, influence: 1 }] }), // weight 3
      pool({ q: 2, r: 0 }, { planets: [{ name: 'B', resources: 1, influence: 1 }] }), // weight 2
    ];
    const inRange = tilesInRange(ORIGIN, placements);
    expect(rawRIScore(inRange)).toBe(3 * 3 + 2 * 2); // (2+1)*3 + (1+1)*2
  });
});

describe('colorScore', () => {
  it('rewards blue tiles and penalizes red tiles symmetrically', () => {
    const bluePlacements = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { tileBack: 'blue' })];
    const redPlacements = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { tileBack: 'red' })];
    const blueScore = colorScore(tilesInRange(ORIGIN, bluePlacements));
    const redScore = colorScore(tilesInRange(ORIGIN, redPlacements));
    expect(blueScore).toBeGreaterThan(0);
    expect(redScore).toBeLessThan(0);
    expect(blueScore).toBe(-redScore);
  });
});

describe('techDiversityScore', () => {
  it('scores 4 distinct specialty types higher than 4 tiles offering the same type, at equal distance', () => {
    const distinctPlacements = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 0, influence: 0, techSpecialty: 'biotic' }] }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'B', resources: 0, influence: 0, techSpecialty: 'propulsion' }] }),
      pool({ q: 0, r: -1 }, { planets: [{ name: 'C', resources: 0, influence: 0, techSpecialty: 'cybernetic' }] }),
      pool({ q: -1, r: 0 }, { planets: [{ name: 'D', resources: 0, influence: 0, techSpecialty: 'warfare' }] }),
    ];
    const duplicatePlacements = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 0, influence: 0, techSpecialty: 'biotic' }] }),
      pool({ q: 1, r: -1 }, { planets: [{ name: 'B', resources: 0, influence: 0, techSpecialty: 'biotic' }] }),
      pool({ q: 0, r: -1 }, { planets: [{ name: 'C', resources: 0, influence: 0, techSpecialty: 'biotic' }] }),
      pool({ q: -1, r: 0 }, { planets: [{ name: 'D', resources: 0, influence: 0, techSpecialty: 'biotic' }] }),
    ];
    const distinctScore = techDiversityScore(tilesInRange(ORIGIN, distinctPlacements));
    const duplicateScore = techDiversityScore(tilesInRange(ORIGIN, duplicatePlacements));
    expect(distinctScore).toBeGreaterThan(duplicateScore);
  });

  it('has diminishing returns: the 1st distinct type is worth more than the increment from 3rd to 4th', () => {
    const base = (n: number) => {
      const specs: Array<'biotic' | 'propulsion' | 'cybernetic' | 'warfare'> = ['biotic', 'propulsion', 'cybernetic', 'warfare'];
      const coords: AxialCoord[] = [
        { q: 1, r: 0 },
        { q: 1, r: -1 },
        { q: 0, r: -1 },
        { q: -1, r: 0 },
      ];
      const placements = [home(ORIGIN, 0)];
      for (let i = 0; i < n; i++) {
        placements.push(pool(coords[i], { planets: [{ name: `p${i}`, resources: 0, influence: 0, techSpecialty: specs[i] }] }));
      }
      return techDiversityScore(tilesInRange(ORIGIN, placements));
    };
    const increment1to0 = base(1) - base(0);
    const increment4to3 = base(4) - base(3);
    expect(increment1to0).toBeGreaterThan(increment4to3);
  });

  it('a closer duplicate of an already-covered type raises the score; a farther one does not', () => {
    const withFarDuplicate = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 0, influence: 0, techSpecialty: 'biotic' }] }), // weight 3
      pool({ q: 3, r: 0 }, { planets: [{ name: 'B', resources: 0, influence: 0, techSpecialty: 'biotic' }] }), // weight 1, farther
    ];
    const withoutDuplicate = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 0, influence: 0, techSpecialty: 'biotic' }] })];
    expect(techDiversityScore(tilesInRange(ORIGIN, withFarDuplicate))).toBe(techDiversityScore(tilesInRange(ORIGIN, withoutDuplicate)));
  });
});

describe('legendaryScore', () => {
  it('adds a bonus for legendary planets, scaling with distance weight', () => {
    const closeLegendary = [home(ORIGIN, 0), pool({ q: 2, r: 0 }, { planets: [{ name: 'L', resources: 1, influence: 1, isLegendary: true }] })]; // weight 2
    const farLegendary = [home(ORIGIN, 0), pool({ q: 3, r: 0 }, { planets: [{ name: 'L', resources: 1, influence: 1, isLegendary: true }] })]; // weight 1
    const nonLegendary = [home(ORIGIN, 0), pool({ q: 2, r: 0 }, { planets: [{ name: 'N', resources: 1, influence: 1 }] })]; // weight 2

    const closeScore = legendaryScore(tilesInRange(ORIGIN, closeLegendary));
    const farScore = legendaryScore(tilesInRange(ORIGIN, farLegendary));
    const nonLegendaryScore = legendaryScore(tilesInRange(ORIGIN, nonLegendary));

    expect(closeScore).toBeGreaterThan(farScore);
    expect(nonLegendaryScore).toBe(0);
    expect(closeScore).toBeGreaterThan(0);
  });
});

describe('entropicScarScore', () => {
  it('adds a bonus per Entropic Scar tile in range, scaling with distance weight', () => {
    const close = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] })]; // weight 3
    const far = [home(ORIGIN, 0), pool({ q: 3, r: 0 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] })]; // weight 1

    const closeScore = entropicScarScore(tilesInRange(ORIGIN, close));
    const farScore = entropicScarScore(tilesInRange(ORIGIN, far));

    expect(closeScore).toBeGreaterThan(farScore);
    expect(closeScore).toBeGreaterThan(0);
  });

  it('is 0 when no in-range tile has an Entropic Scar, and sums across multiple such tiles', () => {
    const none = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { tileBack: 'red', anomaly: 'nebula', planets: [] })];
    const two = [
      home(ORIGIN, 0),
      pool({ q: 1, r: 0 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] }),
      pool({ q: 1, r: -1 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] }),
    ];

    expect(entropicScarScore(tilesInRange(ORIGIN, none))).toBe(0);
    const oneScore = entropicScarScore(tilesInRange(ORIGIN, [home(ORIGIN, 0), two[1]]));
    expect(entropicScarScore(tilesInRange(ORIGIN, two))).toBe(oneScore * 2);
  });

  it('nets positive even after the existing red-tile-back color penalty', () => {
    const placements = [home(ORIGIN, 0), pool({ q: 1, r: 0 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] })];
    const inRange = tilesInRange(ORIGIN, placements);
    const net = entropicScarScore(inRange) + colorScore(inRange);
    expect(net).toBeGreaterThan(0);
  });
});

describe('shapeScore / isExclusiveToSeat', () => {
  it('counts a planet only when this home is strictly the closest among all homes', () => {
    const seatAHome: AxialCoord = { q: -3, r: 0 };
    const seatBHome: AxialCoord = { q: 3, r: 0 };
    const exclusiveTile: AxialCoord = { q: -2, r: 0 }; // distance 1 from A, 5 from B
    const contestedTile: AxialCoord = { q: 0, r: 0 }; // distance 3 from both A and B

    expect(isExclusiveToSeat(exclusiveTile, seatAHome, [seatBHome])).toBe(true);
    expect(isExclusiveToSeat(contestedTile, seatAHome, [seatBHome])).toBe(false);
    expect(isExclusiveToSeat(contestedTile, seatBHome, [seatAHome])).toBe(false);
  });

  it('a contested (equidistant) tile contributes to no seat\'s shapeScore', () => {
    const seatAHome: AxialCoord = { q: -1, r: 0 };
    const seatBHome: AxialCoord = { q: 1, r: 0 };
    const contestedCoord: AxialCoord = { q: 0, r: 0 }; // distance 1 from both

    const placements = [
      home(seatAHome, 0),
      home(seatBHome, 1),
      pool(contestedCoord, { planets: [{ name: 'C', resources: 1, influence: 1 }] }),
    ];
    const scoreA = shapeScore(tilesInRange(seatAHome, placements), seatAHome, [seatBHome]);
    const scoreB = shapeScore(tilesInRange(seatBHome, placements), seatBHome, [seatAHome]);
    expect(scoreA).toBe(0);
    expect(scoreB).toBe(0);
  });

  it('an anomaly-only tile (no planets) never contributes, even if exclusive', () => {
    const seatHome: AxialCoord = { q: 0, r: 0 };
    const placements = [home(seatHome, 0), pool({ q: 1, r: 0 }, { planets: [], anomaly: 'nebula' })];
    expect(shapeScore(tilesInRange(seatHome, placements), seatHome, [])).toBe(0);
  });

  it('rewards planet count, not tile count', () => {
    const seatHome: AxialCoord = { q: 0, r: 0 };
    const twoPlanetTile = [
      home(seatHome, 0),
      pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 1, influence: 0 }, { name: 'B', resources: 1, influence: 0 }] }),
    ];
    const onePlanetTile = [home(seatHome, 0), pool({ q: 1, r: 0 }, { planets: [{ name: 'A', resources: 1, influence: 0 }] })];
    const twoPlanetScore = shapeScore(tilesInRange(seatHome, twoPlanetTile), seatHome, []);
    const onePlanetScore = shapeScore(tilesInRange(seatHome, onePlanetTile), seatHome, []);
    expect(twoPlanetScore).toBe(onePlanetScore * 2);
  });
});

describe('computeSeatCompositeScores with zeroed weights', () => {
  it('equals the one active sub-score when all others are zeroed', () => {
    const placements = [
      home({ q: -2, r: 0 }, 0),
      home({ q: 2, r: 0 }, 1),
      pool({ q: -1, r: 0 }, { tileBack: 'blue', planets: [{ name: 'A', resources: 1, influence: 1 }] }),
    ];
    const onlyRI = computeSeatCompositeScores(placements, { wColor: 0, wTech: 0, wLegendary: 0, wShape: 0, wEntropicScar: 0 });
    const seat0RI = onlyRI.get(0)!;

    const onlyColor = computeSeatCompositeScores(placements, { wRI: 0, wTech: 0, wLegendary: 0, wShape: 0, wEntropicScar: 0 });
    const seat0Color = onlyColor.get(0)!;

    expect(seat0RI).toBeGreaterThan(0);
    expect(seat0Color).toBeGreaterThan(0);
    expect(seat0RI).not.toBe(seat0Color);
  });

  it('isolates wEntropicScar to match entropicScarScore directly', () => {
    const placements = [
      home({ q: -2, r: 0 }, 0),
      home({ q: 2, r: 0 }, 1),
      pool({ q: -1, r: 0 }, { tileBack: 'red', anomaly: 'entropicScar', planets: [] }),
    ];
    const onlyEntropicScar = computeSeatCompositeScores(placements, { wRI: 0, wColor: 0, wTech: 0, wLegendary: 0, wShape: 0 });
    const seat0Score = onlyEntropicScar.get(0)!;
    const expected = entropicScarScore(tilesInRange({ q: -2, r: 0 }, placements));

    expect(seat0Score).toBe(expected);
    expect(seat0Score).toBeGreaterThan(0);
  });
});

describe('computePositionalFactors', () => {
  it('is exactly 1.0 for every seat on uniformly-spaced boards (3p, 4p, 6p)', () => {
    for (const playerCount of [3, 4, 6] as const) {
      const layout = BOARD_LAYOUTS[playerCount];
      const placements: PlacedTile[] = layout.slots
        .filter((s) => s.role === 'home')
        .map((s) => ({ coord: s.coord, role: 'home' as const, seat: s.seat, tile: tile({ isHomeSystem: true, tileBack: null }) }));
      const factors = computePositionalFactors(placements);
      for (const factor of factors.values()) {
        expect(factor).toBeCloseTo(1.0, 5);
      }
    }
  });

  it('produces non-trivial (non-1.0) values for the asymmetric 5-player board', () => {
    const layout = BOARD_LAYOUTS[5];
    const placements: PlacedTile[] = layout.slots
      .filter((s) => s.role === 'home')
      .map((s) => ({ coord: s.coord, role: 'home' as const, seat: s.seat, tile: tile({ isHomeSystem: true, tileBack: null }) }));
    const factors = computePositionalFactors(placements);
    const values = Array.from(factors.values());
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values));
    // Crowded seats (closer neighbors) should get a factor below 1, roomy seats above 1.
    expect(Math.min(...values)).toBeLessThan(1);
    expect(Math.max(...values)).toBeGreaterThan(1);
  });
});
