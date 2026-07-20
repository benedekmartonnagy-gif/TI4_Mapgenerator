import type { BoardLayout, Expansion, LayoutSlot, PlacedTile, SystemTile } from '../data/types';
import { mecatolTile } from '../data/expansions';
import { distance, key } from './axial';
import { violatesAnyConstraint } from './constraints';

const ORIGIN = { q: 0, r: 0 };

function homePlaceholderTile(seat: number): SystemTile {
  return {
    id: `home-seat-${seat}`,
    tileNumber: '',
    expansion: 'base',
    tileBack: null,
    planets: [],
    isHyperlane: false,
    isMecatolRex: false,
    isHomeSystem: true,
  };
}

/**
 * Ring-by-ring constrained random placement: Mecatol and home slots are
 * fixed first, then pool slots are filled outward from the center, picking
 * the first remaining pool tile that doesn't violate adjacency/legendary
 * constraints against tiles already placed, falling back to "place anyway"
 * if every remaining tile would violate (matching official rule text).
 */
export function placeTiles(layout: BoardLayout, shuffledPool: SystemTile[], expansions: Expansion[]): PlacedTile[] {
  const placedByCoord = new Map<string, PlacedTile>();
  const homeCoords = layout.slots.filter((s) => s.role === 'home').map((s) => s.coord);

  const place = (slot: LayoutSlot, tile: SystemTile) => {
    const placed: PlacedTile = { coord: slot.coord, tile, role: slot.role, seat: slot.seat };
    placedByCoord.set(key(slot.coord), placed);
  };

  const mecatolSlot = layout.slots.find((s) => s.role === 'mecatol');
  if (mecatolSlot) place(mecatolSlot, mecatolTile(expansions));

  for (const slot of layout.slots.filter((s) => s.role === 'home')) {
    place(slot, homePlaceholderTile(slot.seat ?? 0));
  }

  const poolSlots = layout.slots
    .filter((s) => s.role === 'pool')
    .slice()
    .sort((a, b) => distance(a.coord, ORIGIN) - distance(b.coord, ORIGIN));

  const remaining = shuffledPool.slice();

  for (const slot of poolSlots) {
    let chosenIndex = remaining.findIndex((t) => !violatesAnyConstraint(slot.coord, t, placedByCoord, homeCoords));
    if (chosenIndex === -1) chosenIndex = 0; // fallback: every candidate violates, place anyway
    const [tile] = remaining.splice(chosenIndex, 1);
    place(slot, tile);
  }

  return Array.from(placedByCoord.values());
}
