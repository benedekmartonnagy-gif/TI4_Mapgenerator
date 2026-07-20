import './RegenerateButton.css';

interface RegenerateButtonProps {
  seed: number;
  onRegenerate: () => void;
  onBackToSetup: () => void;
}

export function RegenerateButton({ seed, onRegenerate, onBackToSetup }: RegenerateButtonProps) {
  return (
    <div className="controls-bar">
      <span className="seed-label">Seed: {seed}</span>
      <button type="button" onClick={onRegenerate}>
        Regenerate
      </button>
      <button type="button" onClick={onBackToSetup}>
        Back to Setup
      </button>
    </div>
  );
}
