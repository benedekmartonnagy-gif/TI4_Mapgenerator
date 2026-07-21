import { useState } from 'react';
import type { Expansion, GenerateConfig } from '../../data/types';
import { EXPANSION_REGISTRY } from '../../data/expansions';
import './SetupScreen.css';

const PLAYER_COUNTS = [3, 4, 5, 6] as const;

interface SetupScreenProps {
  onGenerate: (config: GenerateConfig) => void;
  error: string | null;
}

export function SetupScreen({ onGenerate, error }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState<3 | 4 | 5 | 6>(6);
  const [pokEnabled, setPokEnabled] = useState(true);
  const [thundersEdgeEnabled, setThundersEdgeEnabled] = useState(false);
  const [twilightwarsVariantEnabled, setTwilightwarsVariantEnabled] = useState(false);

  const handleGenerate = () => {
    const expansions: Expansion[] = ['base'];
    if (pokEnabled) expansions.push('pok');
    if (thundersEdgeEnabled && EXPANSION_REGISTRY.thundersEdge.available) expansions.push('thundersEdge');
    onGenerate({ playerCount, expansions, twilightwarsVariant: twilightwarsVariantEnabled });
  };

  return (
    <div className="setup-screen">
      <h1>TI4 Map Generator</h1>
      <p className="subtitle">Generate a galaxy map for Twilight Imperium 4th Edition before you play.</p>

      <fieldset>
        <legend>Player count</legend>
        <div className="segmented">
          {PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className={count === playerCount ? 'selected' : ''}
              onClick={() => setPlayerCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Expansions</legend>
        <label className="expansion-toggle">
          <input type="checkbox" checked disabled />
          Base Game
        </label>
        <label className="expansion-toggle">
          <input type="checkbox" checked={pokEnabled} onChange={(e) => setPokEnabled(e.target.checked)} />
          Prophecy of Kings
        </label>
        <label
          className="expansion-toggle"
          title={EXPANSION_REGISTRY.thundersEdge.available ? undefined : 'Tile data not yet loaded'}
        >
          <input
            type="checkbox"
            checked={thundersEdgeEnabled}
            disabled={!EXPANSION_REGISTRY.thundersEdge.available}
            onChange={(e) => setThundersEdgeEnabled(e.target.checked)}
          />
          Thunder's Edge{!EXPANSION_REGISTRY.thundersEdge.available && ' (no data yet)'}
        </label>
      </fieldset>

      <fieldset>
        <legend>Variant</legend>
        <label className="expansion-toggle">
          <input
            type="checkbox"
            checked={twilightwarsVariantEnabled}
            onChange={(e) => setTwilightwarsVariantEnabled(e.target.checked)}
          />
          Twilightwars variant
        </label>
        <p className="variant-hint">
          Uses Base + Prophecy of Kings tiles, excluding gravity rift tiles (not yet supported on twilightwars.com).
          Can't be combined with the Prophecy of Kings or Thunder's Edge toggles above.
        </p>
      </fieldset>

      {error && <p className="error">{error}</p>}

      <button type="button" className="generate-button" onClick={handleGenerate}>
        Generate Map
      </button>
    </div>
  );
}
