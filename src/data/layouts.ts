import type { BoardLayout, LayoutSlot } from './types';
import { hexSpiral } from '../engine/axial';

// Spiral index -> axial coordinate, using the standard TI4 community numbering
// convention: index 0 = Mecatol Rex, ring 1 = indices 1-6, ring 2 = indices
// 7-18, ring 3 = indices 19-36. This matches the index numbering used by the
// official 3/4/5/6-player "Game Rules" board layouts below.
const SPIRAL = hexSpiral({ q: 0, r: 0 }, 3);

// Index sets (home / primary / secondary / tertiary tile slots) for each
// player count's official ("Game Rules"-sourced) board, cross-checked against
// the per-player blue/red tile draw counts from the Living Rules Reference:
//   3p: 6 blue + 2 red per player (24 pool tiles)
//   4p: 5 blue + 3 red per player (32 pool tiles)
//   5p (no hyperlanes): 4 blue + 2 red per player, plus one extra tile the
//     speaker places adjacent to Mecatol Rex (31 pool tiles)
//   6p: 3 blue + 2 red per player (30 pool tiles)
// Primary/secondary/tertiary here just records draw order (primary = drawn
// and placed nearest home first); the engine uses it only as a weighting
// hint for the balancing pass, not a hard placement rule.
const LAYOUT_INDEXES: Record<3 | 4 | 5 | 6, { home: number[]; primary: number[]; secondary: number[]; tertiary: number[] }> = {
  3: {
    home: [22, 28, 34],
    primary: [9, 13, 17],
    secondary: [6, 4, 2, 21, 27, 33, 35, 29, 23],
    tertiary: [8, 12, 16, 18, 14, 10, 1, 3, 5, 15, 11, 7],
  },
  4: {
    home: [23, 27, 32, 36],
    primary: [9, 12, 15, 18, 7, 16, 13, 10],
    secondary: [2, 4, 5, 1, 19, 33, 28, 24, 22, 26, 31, 35],
    tertiary: [3, 6, 17, 14, 11, 8, 20, 25, 29, 34, 30, 21],
  },
  5: {
    home: [21, 25, 28, 31, 35],
    primary: [13, 15, 11, 17, 9],
    secondary: [4, 3, 5, 6, 2, 29, 30, 26, 8, 18, 27, 24, 32, 34, 22],
    tertiary: [1, 16, 7, 10, 12, 14, 33, 23, 20, 36, 19],
  },
  6: {
    home: [19, 22, 25, 28, 31, 34],
    primary: [7, 9, 11, 13, 15, 17],
    secondary: [6, 5, 4, 3, 2, 1, 20, 21, 24, 27, 30, 33],
    tertiary: [18, 16, 14, 12, 10, 8, 23, 26, 29, 32, 35, 36],
  },
};

function buildLayout(playerCount: 3 | 4 | 5 | 6): BoardLayout {
  const { home, primary, secondary, tertiary } = LAYOUT_INDEXES[playerCount];
  const slots: LayoutSlot[] = [{ coord: SPIRAL[0], role: 'mecatol' }];

  home.forEach((index, seat) => {
    slots.push({ coord: SPIRAL[index], role: 'home', seat });
  });

  for (const index of [...primary, ...secondary, ...tertiary]) {
    slots.push({ coord: SPIRAL[index], role: 'pool' });
  }

  return { playerCount, slots };
}

export const BOARD_LAYOUTS: Record<3 | 4 | 5 | 6, BoardLayout> = {
  3: buildLayout(3),
  4: buildLayout(4),
  5: buildLayout(5),
  6: buildLayout(6),
};
