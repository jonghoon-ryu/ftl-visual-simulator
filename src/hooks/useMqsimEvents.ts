import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

const MAX_LOG_ENTRIES = 50;

// dynamic_wl_block_allocated/freed fire on every write-frontier rotation
// (see their doc comments in Simulation_Events.h) - 1493 times just for the
// default sample scenario. Logging every one would flood the panel, so
// only 1 in N gets a line; the rest are silently dropped (they don't feed
// any counter here, unlike mapping_updated - see hostWrites/hostReads
// below, which must stay exact since StatsPanel's WAF depends on them).
const DYNAMIC_WL_LOG_SAMPLE_RATE = 20;

export interface SimulationCounters {
  hostWrites: number;
  hostReads: number;
}

function formatAddress(a: MqsimBlockAddress, page?: number): string {
  return page === undefined ? `Block ${a.block}` : `Block ${a.block} · Page ${page}`;
}

function describeEvent(event: MqsimEvent): string | null {
  switch (event.type) {
    case 'mapping_updated': {
      const lpaHex = `0x${(event.lpa ?? 0n).toString(16).padStart(3, '0')}`;
      const where = event.address ? formatAddress(event.address, event.address.page) : '';
      return `LPA ${lpaHex} 이(가) ${where} 에 매핑됨 (${event.isWrite ? '쓰기' : '읽기'})`;
    }
    case 'gc_started':
      return `${event.block ? formatAddress(event.block) : ''} GC 시작`;
    case 'gc_page_migrated':
      return `${event.block ? formatAddress(event.block, 'page' in event.block ? event.block.page : undefined) : ''} 의 유효 페이지를 GC 로 이동`;
    case 'gc_block_erased':
      return `${event.block ? formatAddress(event.block) : ''} 소거 완료 (GC)`;
    case 'wl_started':
      return `${event.block ? formatAddress(event.block) : ''} 정적 마모평준화(WL) 시작`;
    case 'wl_page_migrated':
      return `${event.block ? formatAddress(event.block, 'page' in event.block ? event.block.page : undefined) : ''} 의 데이터를 WL 로 이동`;
    case 'wl_block_erased':
      return `${event.block ? formatAddress(event.block) : ''} 소거 완료 (WL)`;
    case 'dynamic_wl_block_allocated':
      return `${event.block ? formatAddress(event.block) : ''} 이(가) 새 쓰기 프론티어로 할당됨 (erase count ${event.eraseCount})`;
    case 'dynamic_wl_block_freed':
      return `${event.block ? formatAddress(event.block) : ''} 이(가) free pool 로 반환됨 (erase count ${event.eraseCount})`;
    default:
      return null;
  }
}

// Registers module.setEventCallback() and turns the raw event stream into
// (a) a capped, human-readable log for EventLog.tsx and (b) exact
// host-write/read counters for StatsPanel.tsx's WAF calculation.
// mapping_updated fires exactly once per logical page the host touches -
// the same page granularity as Stats::IssuedProgramCMD (the flash-side
// write count getState().stats exposes) - so counting it here is the
// correct WAF denominator, unlike a raw host I/O-request count (one
// request can span several pages).
export function useMqsimEvents(module: MqsimModule | null) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [counters, setCounters] = useState<SimulationCounters>({ hostWrites: 0, hostReads: 0 });
  const dynamicWlSeenRef = useRef(0);

  const reset = () => {
    setLog([]);
    setCounters({ hostWrites: 0, hostReads: 0 });
    dynamicWlSeenRef.current = 0;
  };

  useEffect(() => {
    if (!module) return;

    // Reset whenever `module` changes identity (in practice: the one
    // null->real-module transition on load, see useMqsimEngine). oxlint's
    // react(set-state-in-effect) rule flags any setState called directly in
    // an effect body, but React's own "adjusting state on a prop change"
    // guidance has no lint-clean form when the dependency is a ref/object
    // rather than a plain prop value already available during render - the
    // cost here is one extra render on a transition that happens once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    // oxlint-disable-next-line react/set-state-in-effect
    reset();

    module.setEventCallback((event) => {
      if (event.type === 'mapping_updated') {
        setCounters((prev) =>
          event.isWrite ? { ...prev, hostWrites: prev.hostWrites + 1 } : { ...prev, hostReads: prev.hostReads + 1 },
        );
      }

      let shouldLog = true;
      if (event.type === 'dynamic_wl_block_allocated' || event.type === 'dynamic_wl_block_freed') {
        dynamicWlSeenRef.current += 1;
        shouldLog = dynamicWlSeenRef.current % DYNAMIC_WL_LOG_SAMPLE_RATE === 0;
      }
      if (!shouldLog) return;

      const text = describeEvent(event);
      if (text === null) return;

      const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
      setLog((prev) => [{ time, text }, ...prev].slice(0, MAX_LOG_ENTRIES));
    });

    return () => module.setEventCallback(null);
  }, [module]);

  return { log, counters, reset };
}
