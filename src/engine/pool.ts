import type { Expansion, SystemTile } from '../data/types';
import { poolTilesFor } from '../data/expansions';
import { shuffle } from './rng';

/**
 * Picks exactly `requiredCount` tiles uniformly at random from the available
 * pool. This must happen before any constraint-aware placement: deciding
 * which tiles are selected has to stay independent of which coordinates they
 * could legally occupy, otherwise tiles with extra constraints (legendary
 * planets, wormholes) get silently skipped at slot after slot and end up
 * under-represented in the final map even though every skip individually
 * looked harmless. Where a selected tile ends up is a separate, later
 * concern for the placement step.
 */
export function buildShuffledPool(expansions: Expansion[], requiredCount: number, rng: () => number): SystemTile[] {
  const available = poolTilesFor(expansions);
  if (available.length < requiredCount) {
    throw new Error(
      `Not enough pool tiles for the selected expansions: need ${requiredCount}, have ${available.length}. Enable more expansions.`,
    );
  }
  return shuffle(available, rng).slice(0, requiredCount);
}
