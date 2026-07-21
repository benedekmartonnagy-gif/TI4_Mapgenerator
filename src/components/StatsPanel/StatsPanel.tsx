import { useState } from 'react';
import type { GeneratedMap } from '../../data/types';
import { computeRingStats, type RingStats } from '../../engine/ringStats';
import { buildMapString } from '../../engine/mapString';
import './StatsPanel.css';

interface StatsPanelProps {
  map: GeneratedMap;
}

interface StatRow {
  label: string;
  read: (stats: RingStats) => number;
}

const STAT_ROWS: StatRow[] = [
  { label: 'Resources', read: (s) => s.resources },
  { label: 'Influence', read: (s) => s.influence },
  { label: 'Total planets', read: (s) => s.planetCount },
  { label: 'Tech specialty planets', read: (s) => s.techSpecialtyCount },
  { label: 'Hazardous planets', read: (s) => s.traitCounts.hazardous },
  { label: 'Industrial planets', read: (s) => s.traitCounts.industrial },
  { label: 'Cultural planets', read: (s) => s.traitCounts.cultural },
  { label: 'Legendary planets', read: (s) => s.legendaryCount },
  { label: 'Anomalies (red tiles)', read: (s) => s.anomalyCount },
];

export function StatsPanel({ map }: StatsPanelProps) {
  const homeSlots = map.placements
    .filter((p) => p.role === 'home' && p.seat !== undefined)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  const [selectedSeat, setSelectedSeat] = useState(homeSlots[0]?.seat ?? 0);
  const [copied, setCopied] = useState(false);

  const selectedHome = homeSlots.find((p) => p.seat === selectedSeat);
  const ring1 = selectedHome ? computeRingStats(selectedHome.coord, map.placements, 1) : null;
  const ring2 = selectedHome ? computeRingStats(selectedHome.coord, map.placements, 2) : null;

  const mapString = buildMapString(map);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mapString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="stats-panel">
      <h2>Player Stats</h2>

      <div className="seat-selector">
        {homeSlots.map((slot) => (
          <button
            key={slot.seat}
            type="button"
            className={slot.seat === selectedSeat ? 'selected' : ''}
            onClick={() => setSelectedSeat(slot.seat ?? 0)}
          >
            {(slot.seat ?? 0) + 1}
          </button>
        ))}
      </div>

      {ring1 && ring2 && (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>Ring 1</th>
              <th>Ring 2</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.read(ring1)}</td>
                <td>{row.read(ring2)}</td>
                <td>{row.read(ring1) + row.read(ring2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="map-string-section">
        <h3>Map String</h3>
        <p className="map-string-hint">Paste this into twilightwars.com to set up the game.</p>
        <textarea className="map-string-text" readOnly value={mapString} onFocus={(e) => e.target.select()} />
        <button type="button" className="map-string-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
