import type { GenerateConfig, GeneratedMap } from '../data/types';
import { BOARD_LAYOUTS } from '../data/layouts';
import { buildShuffledPool } from './pool';
import { placeTiles } from './placement';
import { balancePlacements, computeSeatRawTotals } from './balance';
import { mulberry32, randomSeed } from './rng';

export function generateMap(config: GenerateConfig): GeneratedMap {
  const seed = config.seed ?? randomSeed();
  const rng = mulberry32(seed);
  const layout = BOARD_LAYOUTS[config.playerCount];

  const poolSlotCount = layout.slots.filter((s) => s.role === 'pool').length;
  const shuffledPool = buildShuffledPool(config.expansions, poolSlotCount, rng);

  const initialPlacements = placeTiles(layout, shuffledPool, config.expansions);
  const homeCoords = initialPlacements.filter((p) => p.role === 'home').map((p) => p.coord);
  const balanced = balancePlacements(initialPlacements, homeCoords);

  const perPlayerTotals: GeneratedMap['perPlayerTotals'] = Object.fromEntries(computeSeatRawTotals(balanced));

  return {
    playerCount: config.playerCount,
    expansionsUsed: config.expansions,
    seed,
    placements: balanced,
    perPlayerTotals,
  };
}
