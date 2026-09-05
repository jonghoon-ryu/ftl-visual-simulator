import type { ParamItem } from '../types';

export function ParamPanel({ params }: { params: ParamItem[] }) {
  if (params.length === 0) return null;

  return (
    <div className="sim-panel">
      <div className="sim-panel-title">파라미터</div>
      {params.map((p) => (
        <div className="param-row" key={p.label}>
          <div className="param-label">
            <span>{p.label}</span>
            <span>{p.value}</span>
          </div>
          {p.kind === 'slider' ? (
            <div className="param-slider" style={{ ['--pos' as string]: `${p.percent ?? 0}%` }} />
          ) : (
            <span className="param-select">{p.value} ▾</span>
          )}
          <div className="param-hint">{p.hint}</div>
        </div>
      ))}
    </div>
  );
}
