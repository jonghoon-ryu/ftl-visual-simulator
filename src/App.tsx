import { useState } from 'react';
import './App.css';
import { EventLog } from './components/EventLog';
import { FlashGrid } from './components/FlashGrid';
import { MappingTable } from './components/MappingTable';
import { ParamPanel } from './components/ParamPanel';
import { StatsPanel } from './components/StatsPanel';
import { Toolbar } from './components/Toolbar';
import { WearLevelingView } from './components/WearLevelingView';
import { presets } from './data/presets';
import { mappingBasicSsdConfigXml, mappingBasicWorkloadXml } from './data/mqsimConfigs';
import { useMqsimEngine } from './hooks/useMqsimEngine';
import { useMqsimEvents } from './hooks/useMqsimEvents';
import { useSimulationPlayback } from './hooks/useSimulationPlayback';
import { toBlockRows } from './lib/mqsimBlocks';
import { toMappingRows } from './lib/mqsimMapping';
import { toStatItems } from './lib/mqsimStats';
import type { PresetId } from './types';

function App() {
  const [activeId, setActiveId] = useState<PresetId>('mapping');
  const active = presets.find((p) => p.id === activeId) ?? presets[0];
  const engine = useMqsimEngine(mappingBasicSsdConfigXml, mappingBasicWorkloadXml);
  const events = useMqsimEvents(engine.subscribeEvents, engine.ready);
  const playback = useSimulationPlayback({
    engine,
    onRefresh: engine.refresh,
    onRestart: events.reset,
  });

  // Only the 'mapping' preset is wired to the real WASM engine so far (its
  // config/workload is what useMqsimEngine above loads) - the other presets
  // still show static mock data until their own future work lands.
  const wired = activeId === 'mapping' && engine.ready;
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
          &apos;매핑 기본&apos; 프리셋은 실제 MQSim WASM 엔진과 연동되어 있어요 - 재생 버튼으로
          시뮬레이션을 진행해보세요. 다른 프리셋은 아직 정적 목업입니다.
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
          <div className="sim-sidebar">
            <MappingTable rows={mappingRows} />
            <ParamPanel params={active.params} />
            <StatsPanel stats={statItems} />
          </div>
        </div>
        <EventLog entries={logEntries} />
      </div>
    </div>
  );
}

export default App;
