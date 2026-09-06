import type { PresetId, PresetScenario } from '../types';

export interface PlaybackState {
  isPlaying: boolean;
  speed: number; // event-groups executed per playback tick, 1-8
  hasMore: boolean; // false once the workload's event queue is empty
  disabled: boolean; // true while the engine for the active preset isn't wired/ready yet
  onStepOnce: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: number) => void;
}

interface Props {
  presets: PresetScenario[];
  activeId: PresetId;
  onSelect: (id: PresetId) => void;
  playback: PlaybackState;
}

export function Toolbar({ presets, activeId, onSelect, playback }: Props) {
  const { isPlaying, speed, hasMore, disabled, onStepOnce, onTogglePlay, onRestart, onSpeedChange } = playback;

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
      <div
        className="sim-playback"
        title={disabled ? '이 프리셋은 아직 실제 엔진에 연결되지 않았어요' : !hasMore ? '워크로드 이벤트가 모두 처리됐어요' : undefined}
      >
        <button type="button" disabled={disabled} onClick={onRestart}>
          ⏮
        </button>
        <button type="button" disabled={disabled || !hasMore} onClick={onTogglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button type="button" disabled={disabled || !hasMore || isPlaying} onClick={onStepOnce}>
          ⏭
        </button>
        <span>속도</span>
        <input
          className="sim-speed-slider"
          type="range"
          min={1}
          max={8}
          step={1}
          value={speed}
          disabled={disabled}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
        <span>{speed}×</span>
      </div>
    </div>
  );
}
