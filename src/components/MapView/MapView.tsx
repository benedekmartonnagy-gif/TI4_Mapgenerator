import { useEffect, useRef, useState } from 'react';
import type { GeneratedMap } from '../../data/types';
import { axialToPixel, hexCorners } from '../../engine/axial';
import { HexTile } from './HexTile';
import './MapView.css';

const HEX_SIZE = 60;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 1;

interface MapViewProps {
  map: GeneratedMap;
}

export function MapView({ map }: MapViewProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const mapViewRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  // A regenerated map is a new object even at the same seed; start each new map centered.
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [map]);

  // Attached as a native listener (not React's onWheel) because React marks wheel
  // handlers passive by default, which silently ignores preventDefault() and lets
  // the page scroll instead of zooming.
  useEffect(() => {
    const container = mapViewRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const dx = e.clientX - originX;
      const dy = e.clientY - originY;

      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * Math.exp(-e.deltaY * 0.001)));
      const ratio = nextZoom / prevZoom;

      // Keep the point under the cursor fixed on screen while the scale changes.
      setZoom(nextZoom);
      setPan({ x: dx * (1 - ratio) + prevPan.x * ratio, y: dy * (1 - ratio) + prevPan.y * ratio });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { mouseX, mouseY, panX, panY } = dragOrigin.current;
      setPan({ x: panX + (e.clientX - mouseX), y: panY + (e.clientY - mouseY) });
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const positioned = map.placements.map((placement) => ({
    placement,
    center: axialToPixel(placement.coord, HEX_SIZE),
  }));

  const padding = HEX_SIZE * 1.5;
  const xs = positioned.map((p) => p.center.x);
  const ys = positioned.map((p) => p.center.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  const clipPoints = hexCorners(HEX_SIZE)
    .map((c) => `${c.x},${c.y}`)
    .join(' ');

  return (
    <div className="map-view-page">
      <div
        ref={mapViewRef}
        className={`map-view${isDragging ? ' dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <svg
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          className="map-svg"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <defs>
            <clipPath id="hex-clip" clipPathUnits="userSpaceOnUse">
              <polygon points={clipPoints} />
            </clipPath>
          </defs>
          {positioned.map(({ placement, center }) => (
            // Keyed by the tile's own id, not its coordinate: the board's coordinates are
            // stable across regenerations but which tile occupies each one isn't, and this
            // component tracks per-tile image-loading state internally (see HexTile). Keying
            // by coordinate would let a tile with no image "poison" that position forever,
            // since a fresh tile placed there later would wrongly inherit the old exhausted state.
            <HexTile key={placement.tile.id} placement={placement} center={center} hexSize={HEX_SIZE} />
          ))}
        </svg>
      </div>

      <div className="zoom-bar">
        <span className="zoom-label">Zoom</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom map"
        />
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
