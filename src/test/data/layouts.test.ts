import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUTS } from '../../data/layouts';
import { key } from '../../engine/axial';

const EXPECTED_POOL_SIZE: Record<3 | 4 | 5 | 6, number> = {
  3: 24,
  4: 32,
  5: 31,
  6: 30,
};

describe('board layouts', () => {
  for (const playerCount of [3, 4, 5, 6] as const) {
    describe(`${playerCount}-player layout`, () => {
      const layout = BOARD_LAYOUTS[playerCount];

      it('has exactly one Mecatol slot at the origin', () => {
        const mecatolSlots = layout.slots.filter((s) => s.role === 'mecatol');
        expect(mecatolSlots.length).toBe(1);
        expect(mecatolSlots[0].coord).toEqual({ q: 0, r: 0 });
      });

      it(`has exactly ${playerCount} home slots with unique seat indices`, () => {
        const homeSlots = layout.slots.filter((s) => s.role === 'home');
        expect(homeSlots.length).toBe(playerCount);
        const seats = homeSlots.map((s) => s.seat).sort((a, b) => (a ?? -1) - (b ?? -1));
        expect(seats).toEqual(Array.from({ length: playerCount }, (_, i) => i));
      });

      it(`has ${EXPECTED_POOL_SIZE[playerCount]} pool slots matching the official per-player draw counts`, () => {
        const poolSlots = layout.slots.filter((s) => s.role === 'pool');
        expect(poolSlots.length).toBe(EXPECTED_POOL_SIZE[playerCount]);
      });

      it('has no duplicate coordinates', () => {
        const keys = layout.slots.map((s) => key(s.coord));
        expect(new Set(keys).size).toBe(keys.length);
      });
    });
  }

  it('6-player layout hex count (ring formula) matches: Mecatol + 3 full rings = 37', () => {
    const layout = BOARD_LAYOUTS[6];
    expect(layout.slots.length).toBe(1 + 6 + 12 + 18);
  });
});
