import type { Expansion, GenerateConfig, GeneratedMap } from '../data/types';
import { BOARD_LAYOUTS } from '../data/layouts';
import { buildShuffledPool } from './pool';
import { placeTiles } from './placement';
import { balancePlacements, computeSeatRawTotals } from './balance';
import { enforceRing1Floors } from './ring1Floor';
import { enforceTotalSpread } from './totalSpread';
import { mulberry32, randomSeed } from './rng';

export function generateMap(config: GenerateConfig): GeneratedMap {
  if (config.twilightwarsVariant && (config.expansions.includes('pok') || config.expansions.includes('thundersEdge'))) {
    throw new Error('Invalid selection');
  }

  const seed = config.seed ?? randomSeed();
  const rng = mulberry32(seed);
  const layout = BOARD_LAYOUTS[config.playerCount];

  // The variant always draws from Base+PoK regardless of the raw expansion
  // toggles (which, per the check above, can only be ['base'] here).
  const poolExpansions: Expansion[] = config.twilightwarsVariant ? ['base', 'pok'] : config.expansions;

  const poolSlotCount = layout.slots.filter((s) => s.role === 'pool').length;
  const shuffledPool = buildShuffledPool(poolExpansions, poolSlotCount, rng, {
    excludeGravityRift: config.twilightwarsVariant,
  });

  const initialPlacements = placeTiles(layout, shuffledPool, poolExpansions);
  const homeCoords = initialPlacements.filter((p) => p.role === 'home').map((p) => p.coord);
  const balanced = balancePlacements(initialPlacements, homeCoords);
  const withRing1Floors = enforceRing1Floors(balanced, homeCoords);
  const withSpreadCap = enforceTotalSpread(withRing1Floors, homeCoords);

  const perPlayerTotals: GeneratedMap['perPlayerTotals'] = Object.fromEntries(computeSeatRawTotals(withSpreadCap));

  return {
    playerCount: config.playerCount,
    expansionsUsed: poolExpansions,
    seed,
    placements: withSpreadCap,
    perPlayerTotals,
  };
}
