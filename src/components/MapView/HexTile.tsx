import { useState } from 'react';
import type { PlacedTile } from '../../data/types';
import { hexCorners } from '../../engine/axial';

const WORMHOLE_SYMBOL: Record<string, string> = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ' };
const TECH_ABBR: Record<string, string> = { biotic: 'B', propulsion: 'P', cybernetic: 'C', warfare: 'W' };

// Font size / spacing tuned per planet count so multi-planet stacks stay
// clear of the flat top/bottom hex edges and don't overlap each other.
const PLANET_TEXT_LAYOUT: Record<number, { name: number; stat: number; blockSpacing: number }> = {
  1: { name: 0.2, stat: 0.17, blockSpacing: 0 },
  2: { name: 0.155, stat: 0.13, blockSpacing: 0.32 },
  3: { name: 0.125, stat: 0.105, blockSpacing: 0.27 },
};

/**
 * Optional user-supplied tile art: drop a file named "<tileNumber>.<ext>"
 * (e.g. "51.webp" or "51.png") in public/tiles/ and it's used automatically.
 * Extensions are tried in order per tile; a failed load is handled via
 * onError (browsers paint a visible broken-image icon for a bad <image>
 * href, so we can't just let it fail silently) by advancing to the next
 * extension, and once every extension has failed the <image> is removed so
 * the text-based rendering underneath shows through.
 */
const TILE_IMAGE_BASE_PATH = '/tiles';
const TILE_IMAGE_EXTENSIONS = ['webp', 'png'];

function fillColor(placement: PlacedTile): string {
  if (placement.tile.isMecatolRex) return '#d9a441';
  if (placement.role === 'home') return '#3f6b3f';
  if (placement.tile.tileBack === 'blue') return '#2f4f6f';
  if (placement.tile.tileBack === 'red') return '#6f3535';
  return '#333';
}

interface HexTileProps {
  placement: PlacedTile;
  center: { x: number; y: number };
  hexSize: number;
}

export function HexTile({ placement, center, hexSize }: HexTileProps) {
  const [extensionIndex, setExtensionIndex] = useState(0);
  const imageExhausted = extensionIndex >= TILE_IMAGE_EXTENSIONS.length;
  const corners = hexCorners(hexSize);
  const points = corners.map((c) => `${c.x},${c.y}`).join(' ');
  const { tile } = placement;

  const isHomePlaceholder = placement.role === 'home';
  const strokeWidth = tile.isMecatolRex || isHomePlaceholder ? 3 : 1;
  const stroke = tile.isMecatolRex ? '#f0c869' : isHomePlaceholder ? '#7fbf7f' : '#111';

  return (
    <g transform={`translate(${center.x}, ${center.y})`}>
      <polygon points={points} fill={fillColor(placement)} stroke={stroke} strokeWidth={strokeWidth} />

      {tile.isMecatolRex && (
        <text textAnchor="middle" dy="0.35em" fontSize={hexSize * 0.22} fill="#fff" fontWeight="bold">
          Mecatol Rex
        </text>
      )}

      {isHomePlaceholder && (
        <text textAnchor="middle" dy="0.35em" fontSize={hexSize * 0.22} fill="#fff" fontWeight="bold">
          Home {(placement.seat ?? 0) + 1}
        </text>
      )}

      {!tile.isMecatolRex && !isHomePlaceholder && (
        <>
          <text textAnchor="middle" x={0} y={-hexSize * 0.55} fontSize={hexSize * 0.18} fill="#aaa">
            #{tile.tileNumber}
          </text>

          {tile.planets.map((planet, i) => {
            const count = tile.planets.length;
            const layout = PLANET_TEXT_LAYOUT[count] ?? PLANET_TEXT_LAYOUT[3];
            const spacing = layout.blockSpacing * hexSize;
            const y = -((count - 1) * spacing) / 2 + i * spacing;
            return (
              <g key={planet.name} transform={`translate(0, ${y})`}>
                <text textAnchor="middle" fontSize={layout.name * hexSize} fill="#fff">
                  {planet.name}
                  {planet.isLegendary ? ' ★' : ''}
                </text>
                <text textAnchor="middle" dy="1.05em" fontSize={layout.stat * hexSize} fill="#ddd">
                  {planet.resources}/{planet.influence}
                  {planet.techSpecialty ? ` [${TECH_ABBR[planet.techSpecialty]}]` : ''}
                </text>
              </g>
            );
          })}

          {tile.wormhole && (
            <text textAnchor="middle" x={hexSize * 0.55} y={-hexSize * 0.45} fontSize={hexSize * 0.32} fill="#ffe08a">
              {WORMHOLE_SYMBOL[tile.wormhole]}
            </text>
          )}
        </>
      )}

      {tile.tileNumber && !imageExhausted && (
        <>
          <image
            href={`${TILE_IMAGE_BASE_PATH}/${tile.tileNumber}.${TILE_IMAGE_EXTENSIONS[extensionIndex]}`}
            x={-hexSize}
            y={-hexSize * (Math.sqrt(3) / 2)}
            width={hexSize * 2}
            height={hexSize * Math.sqrt(3)}
            clipPath="url(#hex-clip)"
            preserveAspectRatio="xMidYMid slice"
            onError={() => setExtensionIndex((i) => i + 1)}
          />
          <polygon points={points} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
        </>
      )}
    </g>
  );
}
