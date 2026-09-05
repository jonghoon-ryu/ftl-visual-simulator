import type { StatItem } from '../types';

export function StatsPanel({ stats }: { stats: StatItem[] }) {
  return (
    <div className="sim-panel">
      <div className="sim-panel-title">통계</div>
      {stats.map((s) => (
        <div key={s.label}>
          <div className="stat-row">
            <span>{s.label}</span>
            <span className="stat-value">{s.value}</span>
          </div>
          {s.hint && <div className="stat-hint" style={{ marginTop: '-6px', marginBottom: '8px' }}>{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
