import type { PresetId, PresetScenario } from '../types';

interface Props {
  presets: PresetScenario[];
  activeId: PresetId;
  onSelect: (id: PresetId) => void;
}

export function Toolbar({ presets, activeId, onSelect }: Props) {
  return (
    <div className="sim-toolbar">
      <div className="sim-presets">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === activeId ? 'active' : ''}
            onClick={() => onSelect(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="sim-playback" title="엔진 연동 전 — 자리만 잡아둔 컨트롤 (Session 4 이후 동작 예정)">
        <button type="button" disabled>⏮</button>
        <button type="button" disabled>⏸</button>
        <button type="button" disabled>⏭</button>
        <span>속도</span>
        <span className="sim-speed-track" />
        <span>1×</span>
      </div>
    </div>
  );
}
