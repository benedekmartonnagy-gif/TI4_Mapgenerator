export type Expansion = 'base' | 'pok' | 'thundersEdge';

export type TileBack = 'blue' | 'red';

export type WormholeType = 'alpha' | 'beta' | 'gamma' | 'delta' | 'epsilon';

export type AnomalyType = 'nebula' | 'supernova' | 'asteroidField' | 'gravityRift' | 'entropicScar';

export type TechSpecialty = 'biotic' | 'propulsion' | 'cybernetic' | 'warfare';

export type PlanetTrait = 'cultural' | 'hazardous' | 'industrial';

export interface Planet {
  name: string;
  resources: number;
  influence: number;
  trait?: PlanetTrait;
  techSpecialty?: TechSpecialty;
  isLegendary?: boolean;
  legendaryAbilityText?: string;
}

export interface SystemTile {
  /** Stable key, e.g. "base-18", "pok-65", "te-023". */
  id: string;
  /** Number printed on the physical tile, for cross-checking against real components. */
  tileNumber: string;
  expansion: Expansion;
  /** null for Mecatol Rex / home tiles, which aren't drawn from the pool. */
  tileBack: TileBack | null;
  planets: Planet[];
  wormhole?: WormholeType;
  anomaly?: AnomalyType;
  isHyperlane: boolean;
  isMecatolRex: boolean;
  isHomeSystem: boolean;
  homeFactionName?: string;
  /** Variant/scenario-only tile (e.g. Mallice) excluded from the standard random draw pool. */
  isSpecial?: boolean;
}

export interface AxialCoord {
  q: number;
  r: number;
}

export type BoardRole = 'mecatol' | 'home' | 'pool';

export interface LayoutSlot {
  coord: AxialCoord;
  role: BoardRole;
  /** Stable seat index for home slots, used to attribute nearby tiles to a player for balancing. */
  seat?: number;
}

export interface BoardLayout {
  playerCount: 3 | 4 | 5 | 6;
  slots: LayoutSlot[];
}

export interface PlacedTile {
  coord: AxialCoord;
  tile: SystemTile;
  role: BoardRole;
  seat?: number;
}

export interface GeneratedMap {
  playerCount: 3 | 4 | 5 | 6;
  expansionsUsed: Expansion[];
  seed: number;
  placements: PlacedTile[];
  perPlayerTotals: Record<number, { resources: number; influence: number }>;
}

export interface GenerateConfig {
  playerCount: 3 | 4 | 5 | 6;
  expansions: Expansion[];
  seed?: number;
  /** Base+PoK tiles only, excluding gravity rift anomalies (twilightwars.com doesn't support them yet). Mutually exclusive with enabling PoK or Thunder's Edge in `expansions`. */
  twilightwarsVariant?: boolean;
}
