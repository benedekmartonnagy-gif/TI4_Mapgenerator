import type { AxialCoord, PlacedTile, SystemTile } from '../data/types';
import { distance, key, neighbors } from './axial';

/**
 * Minimum hex distance a legendary planet's tile must be from every home
 * system. Not confirmed against the official Living Rules Reference text —
 * flagged in the implementation plan for verification. Change this one
 * constant once confirmed; nothing else needs to change.
 */
export const MIN_LEGENDARY_DISTANCE = 2;

export function wormholeAdjacencyViolation(
  coord: AxialCoord,
  tile: SystemTile,
  placedByCoord: Map<string, PlacedTile>,
): boolean {
  if (!tile.wormhole) return false;
  return neighbors(coord).some((n) => placedByCoord.get(key(n))?.tile.wormhole === tile.wormhole);
}

export function anomalyAdjacencyViolation(
  coord: AxialCoord,
  tile: SystemTile,
  placedByCoord: Map<string, PlacedTile>,
): boolean {
  if (!tile.anomaly) return false;
  return neighbors(coord).some((n) => placedByCoord.get(key(n))?.tile.anomaly === tile.anomaly);
}

export function legendaryDistanceViolation(coord: AxialCoord, tile: SystemTile, homeCoords: AxialCoord[]): boolean {
  if (!tile.planets.some((p) => p.isLegendary)) return false;
  return homeCoords.some((home) => distance(coord, home) < MIN_LEGENDARY_DISTANCE);
}

export function violatesAnyConstraint(
  coord: AxialCoord,
  tile: SystemTile,
  placedByCoord: Map<string, PlacedTile>,
  homeCoords: AxialCoord[],
): boolean {
  return (
    wormholeAdjacencyViolation(coord, tile, placedByCoord) ||
    anomalyAdjacencyViolation(coord, tile, placedByCoord) ||
    legendaryDistanceViolation(coord, tile, homeCoords)
  );
}
