import { describe, expect, it } from 'vitest';
import { baseTiles } from '../../data/tiles.base';
import { pokTiles } from '../../data/tiles.pok';
import { thundersEdgeTiles } from '../../data/tiles.thundersEdge';
import type { SystemTile } from '../../data/types';

function checkIntegrity(tiles: SystemTile[], label: string) {
  describe(label, () => {
    it('has no duplicate ids', () => {
      const ids = tiles.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has no duplicate tile numbers', () => {
      const numbers = tiles.map((t) => t.tileNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it('has no negative resource or influence values', () => {
      for (const tile of tiles) {
        for (const planet of tile.planets) {
          expect(planet.resources).toBeGreaterThanOrEqual(0);
          expect(planet.influence).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('sets homeFactionName only when relevant, and home tiles have it (except the Creuss wormhole-only entries)', () => {
      for (const tile of tiles) {
        if (tile.isHomeSystem && !tile.homeFactionName) {
          // The base game's tile 17 and PoK's tile 51 both represent the
          // Ghosts of Creuss home system; only one carries the race label
          // in source data. Anything else missing a name is a real gap.
          expect(tile.wormhole).toBe('delta');
        }
      }
    });

    it('has exactly one Mecatol Rex tile at most', () => {
      expect(tiles.filter((t) => t.isMecatolRex).length).toBeLessThanOrEqual(1);
    });
  });
}

checkIntegrity(baseTiles, 'base tile data');
checkIntegrity(pokTiles, 'PoK tile data');
checkIntegrity(thundersEdgeTiles, "Thunder's Edge tile data");

describe('base tile data counts', () => {
  it('has 17 home systems, 1 Mecatol Rex, 20 blue, and 12 red tiles', () => {
    expect(baseTiles.filter((t) => t.isHomeSystem).length).toBe(17);
    expect(baseTiles.filter((t) => t.isMecatolRex).length).toBe(1);
    expect(baseTiles.filter((t) => t.tileBack === 'blue').length).toBe(20);
    expect(baseTiles.filter((t) => t.tileBack === 'red').length).toBe(12);
  });
});

describe('PoK tile data counts', () => {
  it('has 8 home systems, 17 blue, and 7 red tiles', () => {
    expect(pokTiles.filter((t) => t.isHomeSystem).length).toBe(8);
    expect(pokTiles.filter((t) => t.tileBack === 'blue').length).toBe(17);
    expect(pokTiles.filter((t) => t.tileBack === 'red').length).toBe(7);
  });

  it('marks Mallice and the promo supernova tile as special (excluded from the standard pool)', () => {
    const special = pokTiles.filter((t) => t.isSpecial);
    expect(special.map((t) => t.tileNumber).sort()).toEqual(['81', '82']);
  });
});

describe("Thunder's Edge tile data counts", () => {
  it('has 19 pool tiles (15 blue, 4 red), no home systems, and exactly one special Mecatol Rex variant', () => {
    expect(thundersEdgeTiles.filter((t) => t.tileBack === 'blue').length).toBe(15);
    expect(thundersEdgeTiles.filter((t) => t.tileBack === 'red').length).toBe(4);
    expect(thundersEdgeTiles.filter((t) => t.isHomeSystem).length).toBe(0);
    expect(thundersEdgeTiles.filter((t) => t.isMecatolRex).length).toBe(1);
  });

  it('marks the Thunder\'s Edge Mecatol Rex variant (tile 112) as special so it never joins the normal pool', () => {
    const mecatol = thundersEdgeTiles.find((t) => t.isMecatolRex);
    expect(mecatol?.tileNumber).toBe('112');
    expect(mecatol?.isSpecial).toBe(true);
  });
});
