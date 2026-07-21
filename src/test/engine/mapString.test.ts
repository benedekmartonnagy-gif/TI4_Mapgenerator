import { describe, expect, it } from 'vitest';
import { ringClockwiseFromNorth, buildMapString } from '../../engine/mapString';
import { generateMap } from '../../engine/generate';
import { BOARD_LAYOUTS } from '../../data/layouts';
import { distance, hexSpiral, key } from '../../engine/axial';
import type { AxialCoord, GeneratedMap, PlacedTile, SystemTile } from '../../data/types';

const ORIGIN: AxialCoord = { q: 0, r: 0 };

let tileCounter = 0;
function tile(overrides: Partial<SystemTile> = {}): SystemTile {
  tileCounter += 1;
  return {
    id: `mapstring-test-${tileCounter}`,
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

describe('ringClockwiseFromNorth', () => {
  it('returns the 6 ring-1 neighbors in clockwise order starting due north', () => {
    expect(ringClockwiseFromNorth(ORIGIN, 1)).toEqual([
      { q: 0, r: -1 },
      { q: 1, r: -1 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: -1, r: 0 },
    ]);
  });

  it('returns 12 unique coordinates at hex-distance 2 for radius 2, starting due north', () => {
    const ring2 = ringClockwiseFromNorth(ORIGIN, 2);
    expect(ring2.length).toBe(12);
    expect(new Set(ring2.map((c) => key(c))).size).toBe(12);
    for (const c of ring2) expect(distance(ORIGIN, c)).toBe(2);
    expect(ring2[0]).toEqual({ q: 0, r: -2 });
  });
});

describe('buildMapString', () => {
  it('produces the exact expected 36-token string for a sparse hand-built fixture', () => {
    const map: GeneratedMap = {
      playerCount: 3,
      expansionsUsed: ['base'],
      seed: 1,
      placements: [
        home({ q: -1, r: -1 }, 0), // not on ring 1-3 of Mecatol; irrelevant coordinate
        pool({ q: 0, r: -1 }, { tileNumber: '11' }), // ring 1, due north
        pool({ q: 1, r: -1 }, { tileNumber: '22' }), // ring 1, 2nd clockwise
      ],
      perPlayerTotals: {},
    };

    const result = buildMapString(map);
    const tokens = result.split(', ');
    expect(tokens.length).toBe(36);
    expect(tokens[0]).toBe('11');
    expect(tokens[1]).toBe('22');
    expect(tokens.slice(2)).toEqual(new Array(34).fill('0'));
  });

  it('writes "0" for a home-system coordinate even if it falls on ring 1-3', () => {
    const map: GeneratedMap = {
      playerCount: 3,
      expansionsUsed: ['base'],
      seed: 1,
      placements: [home({ q: 0, r: -1 }, 0)], // ring 1, due north
      perPlayerTotals: {},
    };
    expect(buildMapString(map).split(', ')[0]).toBe('0');
  });
});

describe('buildMapString against real generation (regression for the reported 3p example)', () => {
  it('always emits exactly 36 tokens, with every home coordinate as "0"', () => {
    for (const playerCount of [3, 4, 5, 6] as const) {
      const map = generateMap({ playerCount, expansions: ['base', 'pok'], seed: 42 });
      const tokens = buildMapString(map).split(', ');
      expect(tokens.length).toBe(36);

      const homeCoordKeys = new Set(map.placements.filter((p) => p.role === 'home').map((p) => key(p.coord)));
      const allRingCoords = [1, 2, 3].flatMap((r) => ringClockwiseFromNorth({ q: 0, r: 0 }, r));
      allRingCoords.forEach((coord, i) => {
        if (homeCoordKeys.has(key(coord))) expect(tokens[i]).toBe('0');
      });
    }
  });

  it('emits "0" for exactly the ring-3 spiral indices the user identified (home slots + truly-unused positions)', () => {
    const map = generateMap({ playerCount: 3, expansions: ['base', 'pok'], seed: 42 });
    const tokens = buildMapString(map).split(', ');

    const spiral = hexSpiral({ q: 0, r: 0 }, 3); // index 0 = Mecatol, ring3 = 19-36
    // 3 of these (22, 28, 34) are the 3p home-system indices; the other 9 aren't
    // part of BOARD_LAYOUTS[3] at all. Both cases should render as '0'.
    const homeSpiralIndices = new Set([22, 28, 34]);
    const usedPoolCoordKeys = new Set(
      BOARD_LAYOUTS[3].slots.filter((s) => s.role === 'pool').map((s) => key(s.coord)),
    );
    const allRingCoords = [1, 2, 3].flatMap((r) => ringClockwiseFromNorth({ q: 0, r: 0 }, r));
    const indexInOutput = new Map(allRingCoords.map((c, i) => [key(c), i]));

    const removedRing3Indices = [19, 20, 22, 24, 25, 26, 28, 30, 31, 32, 34, 36];
    for (const spiralIndex of removedRing3Indices) {
      const coord = spiral[spiralIndex];
      // Confirms the premise: never a drawable pool position (either a home slot, or unused entirely).
      expect(usedPoolCoordKeys.has(key(coord))).toBe(false);
      expect(homeSpiralIndices.has(spiralIndex) || !BOARD_LAYOUTS[3].slots.some((s) => key(s.coord) === key(coord))).toBe(true);
      const outputIndex = indexInOutput.get(key(coord))!;
      expect(tokens[outputIndex]).toBe('0');
    }
  });
});
