import { useState } from 'react';
import type { GenerateConfig, GeneratedMap } from './data/types';
import { generateMap } from './engine/generate';
import { SetupScreen } from './components/SetupScreen/SetupScreen';
import { MapView } from './components/MapView/MapView';
import { StatsPanel } from './components/StatsPanel/StatsPanel';
import { RegenerateButton } from './components/Controls/RegenerateButton';
import './App.css';

function App() {
  const [config, setConfig] = useState<GenerateConfig | null>(null);
  const [map, setMap] = useState<GeneratedMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runGeneration = (nextConfig: GenerateConfig) => {
    try {
      const generated = generateMap(nextConfig);
      setConfig(nextConfig);
      setMap(generated);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRegenerate = () => {
    if (config) runGeneration({ ...config, seed: undefined });
  };

  const handleBackToSetup = () => {
    setMap(null);
  };

  if (!map) {
    return <SetupScreen onGenerate={runGeneration} error={error} />;
  }

  return (
    <div className="app-map-page">
      <RegenerateButton seed={map.seed} onRegenerate={handleRegenerate} onBackToSetup={handleBackToSetup} />
      <div className="app-content-row">
        <MapView map={map} />
        <StatsPanel map={map} />
      </div>
    </div>
  );
}

export default App;
