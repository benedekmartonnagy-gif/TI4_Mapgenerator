import type { Expansion, SystemTile } from './types';
import { baseTiles } from './tiles.base';
import { pokTiles } from './tiles.pok';
import { thundersEdgeTiles } from './tiles.thundersEdge';

export interface ExpansionEntry {
  label: string;
  tiles: SystemTile[];
  /** False until real tile data has been populated (see tiles.thundersEdge.ts). */
  available: boolean;
}

export const EXPANSION_REGISTRY: Record<Expansion, ExpansionEntry> = {
  base: { label: 'Base Game', tiles: baseTiles, available: baseTiles.length > 0 },
  pok: { label: 'Prophecy of Kings', tiles: pokTiles, available: pokTiles.length > 0 },
  thundersEdge: {
    label: "Thunder's Edge",
    tiles: thundersEdgeTiles,
    available: thundersEdgeTiles.length > 0,
  },
};

/** Pool-eligible tiles (excludes Mecatol Rex, home systems, hyperlanes, and variant-only tiles) for the given expansions. */
export function poolTilesFor(expansions: Expansion[]): SystemTile[] {
  return expansions
    .flatMap((exp) => EXPANSION_REGISTRY[exp].tiles)
    .filter((t) => !t.isMecatolRex && !t.isHomeSystem && !t.isHyperlane && !t.isSpecial);
}

/** Thunder's Edge replaces the standard Mecatol Rex tile with its own variant (tile 112) when enabled. */
export function mecatolTile(expansions: Expansion[] = []): SystemTile {
  const source = expansions.includes('thundersEdge') ? thundersEdgeTiles : baseTiles;
  const tile = source.find((t) => t.isMecatolRex);
  if (!tile) throw new Error('Mecatol Rex tile missing from expected tile data');
  return tile;
}
