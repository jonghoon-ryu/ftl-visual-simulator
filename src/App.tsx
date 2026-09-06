import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { EventLog } from './components/EventLog';
import { FlashGrid } from './components/FlashGrid';
import { MappingTable } from './components/MappingTable';
import { ParamPanel } from './components/ParamPanel';
import { StatsPanel } from './components/StatsPanel';
import { Toolbar } from './components/Toolbar';
import { WearLevelingView } from './components/WearLevelingView';
import { WorkloadPanel } from './components/WorkloadPanel';
import { presets } from './data/presets';
import {
  buildGcWorkloadXml,
  buildMappingWorkloadXml,
  buildSsdConfigXml,
  DEFAULT_GC_PARAMS,
  DEFAULT_MAPPING_PARAMS,
  DEFAULT_WORKLOAD_PARAMS,
} from './data/mqsimConfigs';
import type { SsdParams, WorkloadParams } from './data/mqsimConfigs';
import { useMqsimEngine } from './hooks/useMqsimEngine';
import { useMqsimEvents } from './hooks/useMqsimEvents';
import { useSimulationPlayback } from './hooks/useSimulationPlayback';
import { toBlockRows } from './lib/mqsimBlocks';
import { toMappingRows } from './lib/mqsimMapping';
import { toStatItems } from './lib/mqsimStats';
import type { PresetId } from './types';

// A param change reconfigures the engine on a short debounce (rather than
// on every slider-drag tick) - see the effect below.
const PARAM_APPLY_DEBOUNCE_MS = 400;

// "GC 시연"'s workload needs ~950k event-groups to reach its first GC
// (measured via a native step-count harness - see buildGcWorkloadXml's doc
// comment) versus "매핑 기본"'s few dozen, so it gets a much larger
// per-speed-unit multiplier. Only presets with a real engine config need an
// entry here; anything else defaults to 1 in useSimulationPlayback.
const TICKS_MULTIPLIER: Partial<Record<PresetId, number>> = {
  gc: 5000,
};

// Presets wired to the real WASM engine so far - each needs its own
// SsdParams (block/page counts, GC threshold, ...) since "GC 시연"
// deliberately uses a much higher GC_Exec_Threshold and a narrower
// workload working-set than "매핑 기본" (see mqsimConfigs.ts). Presets not
// listed here (마모평준화 시연) still show static mock data - static wear-
// leveling was never confirmed to actually trigger within a reasonable
// run even in dedicated testing (see the wl-bug-deviation writeup), so
// wiring it for real is deferred rather than shipped half-working.
const WIRED_PRESET_DEFAULTS: Partial<Record<PresetId, SsdParams>> = {
  mapping: DEFAULT_MAPPING_PARAMS,
  gc: DEFAULT_GC_PARAMS,
};

function buildWorkloadXmlFor(presetId: PresetId, params: SsdParams, workload: WorkloadParams): string {
  return presetId === 'gc' ? buildGcWorkloadXml(params, workload) : buildMappingWorkloadXml(params, workload);
}

function App() {
  const [activeId, setActiveId] = useState<PresetId>('mapping');
  const active = presets.find((p) => p.id === activeId) ?? presets[0];

  const [paramsByPreset, setParamsByPreset] = useState<Record<string, SsdParams>>({
    mapping: DEFAULT_MAPPING_PARAMS,
    gc: DEFAULT_GC_PARAMS,
  });
  // Session 10: workload generator knobs (sequential/random, read/write
  // 비율, burst 크기), independent of SsdParams and keyed per-preset the
  // same way - both wired presets start from the same DEFAULT_WORKLOAD_
  // PARAMS since that's exactly what their tuned Working_Set_Percentage/
  // Stop_Time values (mqsimConfigs.ts) were verified against.
  const [workloadByPreset, setWorkloadByPreset] = useState<Record<string, WorkloadParams>>({
    mapping: DEFAULT_WORKLOAD_PARAMS,
    gc: DEFAULT_WORKLOAD_PARAMS,
  });
  // Whichever wired preset is active drives the one live engine instance;
  // presets not in WIRED_PRESET_DEFAULTS just keep it configured for
  // 'mapping' in the background (harmless - its data isn't shown for them).
  const configKey: PresetId = WIRED_PRESET_DEFAULTS[activeId] ? activeId : 'mapping';
  const activeParams = paramsByPreset[configKey];
  const activeWorkload = workloadByPreset[configKey];
  const ssdConfigXml = useMemo(() => buildSsdConfigXml(activeParams), [activeParams]);
  const workloadXml = useMemo(
    () => buildWorkloadXmlFor(configKey, activeParams, activeWorkload),
    [configKey, activeParams, activeWorkload],
  );

  const engine = useMqsimEngine(ssdConfigXml, workloadXml);
  const events = useMqsimEvents(engine.subscribeEvents, engine.ready);
  const playback = useSimulationPlayback({
    engine,
    onRefresh: engine.refresh,
    onRestart: events.reset,
    ticksMultiplier: TICKS_MULTIPLIER[activeId] ?? 1,
  });

  // Reconfigures the engine whenever the active preset's params (or the
  // preset itself) change - restart() already does exactly this (it calls
  // engine.configure(), which closes over the current ssdConfigXml/
  // workloadXml) plus resets playback/event state, so this is handled
  // identically to pressing ⏮. Skips the very first run since
  // useMqsimEngine's own init() already applied these same default params.
  //
  // Preset switches reconfigure IMMEDIATELY (no debounce) - `wired` (and
  // so the Toolbar's disabled state) flips true the instant activeId
  // changes, in the same render, well before this effect can even run.
  // Debouncing a preset switch left a real window where pressing play
  // would start running against the *previous* preset's still-loaded
  // config, only to be silently paused and reset once the debounced
  // restart() finally fired - looked exactly like "pressed play, it just
  // stopped" for "GC 시연" if you didn't wait ~400ms before pressing play.
  // Only a same-preset param edit (a slider drag) still needs debouncing,
  // to avoid reconfiguring on every intermediate drag value.
  const prevConfigKeyRef = useRef(configKey);
  const isFirstConfigRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstConfigRenderRef.current) {
      isFirstConfigRenderRef.current = false;
      prevConfigKeyRef.current = configKey;
      return;
    }
    if (!engine.ready) return;

    const presetSwitched = prevConfigKeyRef.current !== configKey;
    prevConfigKeyRef.current = configKey;

    if (presetSwitched) {
      void playback.restart();
      return;
    }

    const id = setTimeout(() => {
      void playback.restart();
    }, PARAM_APPLY_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssdConfigXml, workloadXml, engine.ready]);

  const wired = Boolean(WIRED_PRESET_DEFAULTS[activeId]) && engine.ready;
  const mappingRows = wired ? toMappingRows(engine.state) : active.mapping;
  const blockRows = wired ? toBlockRows(engine.state) : active.blocks;
  const statItems = wired ? toStatItems(engine.state, events.counters) : active.stats;
  const logEntries = wired ? events.log : active.log;
  const caption = wired
    ? '▶ 재생 버튼을 눌러 실제 MQSim 엔진으로 워크로드를 실행해보세요 - 아래 블록/매핑 테이블/통계가 실시간으로 갱신됩니다'
    : active.caption;

  return (
    <div className="sim-app">
      <header className="sim-app-header">
        <h1>FTL Visual Simulator</h1>
        <p>
          &apos;매핑 기본&apos;·&apos;GC 시연&apos; 프리셋은 실제 MQSim WASM 엔진과 연동되어 있어요 -
          재생 버튼으로 시뮬레이션을 진행해보세요. &apos;마모평준화 시연&apos;은 아직 정적 목업입니다.
        </p>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          엔진 상태 (개발용): {engine.error ? `오류 - ${engine.error}` : engine.ready ? '준비 완료' : '로딩 중...'}
        </p>
      </header>
      <div className="sim-mockup">
        <Toolbar
          presets={presets}
          activeId={activeId}
          onSelect={setActiveId}
          playback={{
            isPlaying: playback.isPlaying,
            speed: playback.speed,
            hasMore: playback.hasMore,
            disabled: !wired,
            onStepOnce: playback.stepOnce,
            onTogglePlay: playback.togglePlay,
            onRestart: playback.restart,
            onSpeedChange: playback.setSpeed,
          }}
        />
        <div className="sim-body">
          {blockRows && <FlashGrid blocks={blockRows} caption={caption} />}
          {active.wearRows && <WearLevelingView rows={active.wearRows} caption={caption} />}
          {/* Only 매핑 기본/GC 시연 have a mapping table at all (마모평준화
              시연 never does) - keyed off which presets are wired, not off
              whether mappingRows currently has anything in it, so the
              column (and its "재생을 눌러보세요" empty state) stays visible
              from the moment the preset is selected, not just after the
              first write actually lands. */}
          {WIRED_PRESET_DEFAULTS[activeId] && (
            <div className="sim-mapping-col">
              <MappingTable rows={mappingRows} />
            </div>
          )}
          <div className="sim-sidebar">
            <ParamPanel
              params={activeParams}
              onChange={(next) => setParamsByPreset((prev) => ({ ...prev, [configKey]: next }))}
              disabled={!wired}
            />
            <WorkloadPanel
              workload={activeWorkload}
              onChange={(next) => setWorkloadByPreset((prev) => ({ ...prev, [configKey]: next }))}
              disabled={!wired}
            />
            <StatsPanel stats={statItems} />
          </div>
        </div>
        <EventLog entries={logEntries} />
      </div>
    </div>
  );
}

export default App;
