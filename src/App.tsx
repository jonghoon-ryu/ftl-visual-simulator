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
import type { PresetId } from './types';

function App() {
  const [activeId, setActiveId] = useState<PresetId>('mapping');
  const active = presets.find((p) => p.id === activeId) ?? presets[0];
  const engine = useMqsimEngine(mappingBasicSsdConfigXml, mappingBasicWorkloadXml);

  return (
    <div className="sim-app">
      <header className="sim-app-header">
        <h1>FTL Visual Simulator</h1>
        <p>
          정적 목업 단계 — 프리셋 버튼을 눌러 화면 구성을 미리 볼 수 있습니다. 실제 MQSim
          WASM 엔진 연동은 아직입니다.
        </p>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          엔진 상태 (개발용): {engine.error ? `오류 - ${engine.error}` : engine.ready ? '준비 완료' : '로딩 중...'}
        </p>
      </header>
      <div className="sim-mockup">
        <Toolbar presets={presets} activeId={activeId} onSelect={setActiveId} />
        <div className="sim-body">
          {active.blocks && <FlashGrid blocks={active.blocks} caption={active.caption} />}
          {active.wearRows && <WearLevelingView rows={active.wearRows} caption={active.caption} />}
          <div className="sim-sidebar">
            <MappingTable rows={active.mapping} />
            <ParamPanel params={active.params} />
            <StatsPanel stats={active.stats} />
          </div>
        </div>
        <EventLog entries={active.log} />
      </div>
    </div>
  );
}

export default App;
