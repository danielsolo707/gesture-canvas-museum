import { usePerformance } from '../../hooks/usePerformance';

export function PerformanceHUD() {
  const { fps, showHud } = usePerformance();

  if (!showHud) return null;

  const color = fps >= 50 ? '#69db7c' : fps >= 30 ? '#ffd43b' : '#ff6b6b';

  return (
    <div className="performance-hud">
      <div>
        FPS: <span style={{ color }}>{fps}</span>
      </div>
    </div>
  );
}
