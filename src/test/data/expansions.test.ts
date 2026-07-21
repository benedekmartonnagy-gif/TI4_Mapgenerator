import { describe, expect, it } from 'vitest';
import { poolTilesFor } from '../../data/expansions';

describe('poolTilesFor', () => {
  it('excludes only gravity rift tiles when excludeGravityRift is set, leaving everything else identical', () => {
    const withoutOption = poolTilesFor(['base', 'pok']);
    const withOption = poolTilesFor(['base', 'pok'], { excludeGravityRift: true });

    const keptIds = new Set(withOption.map((t) => t.id));
    const excludedTiles = withoutOption.filter((t) => !keptIds.has(t.id));
    const excludedIds = new Set(excludedTiles.map((t) => t.id));

    expect(excludedTiles.map((t) => t.tileNumber).sort()).toEqual(['41', '67']);
    expect(excludedTiles.every((t) => t.anomaly === 'gravityRift')).toBe(true);

    // Every other tile is untouched.
    const remainingWithoutOption = withoutOption.filter((t) => !excludedIds.has(t.id));
    expect(remainingWithoutOption.map((t) => t.id).sort()).toEqual(withOption.map((t) => t.id).sort());
  });

  it('is a no-op when excludeGravityRift is not passed', () => {
    const a = poolTilesFor(['base', 'pok']);
    const b = poolTilesFor(['base', 'pok'], {});
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
  });
});
