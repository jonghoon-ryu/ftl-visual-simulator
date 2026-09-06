import { useEffect, useState } from 'react';
import createMQSimModule from '../wasm-build/mqsim.mjs';

// Loads the WASM-compiled MQSim engine once and initializes it with the
// given config/workload XML text (see src/data/mqsimConfigs.ts). Slice 1 of
// the Session 7 WASM-wiring plan - see the ftl_visual_simulator_project
// memory note for the full slice list if picking this back up later.
//
// Deliberately no "already initialized" ref guard here: React StrictMode
// (main.tsx) runs this effect mount -> cleanup -> mount once in dev, and a
// guard that skips the second mount interacts badly with the first mount's
// `cancelled` flag (set true by its own cleanup) silently discarding the
// real result once the async work resolves - it looked exactly like the
// module just hung forever with zero errors anywhere. Calling init() twice
// is harmless (it tears down and rebuilds - see bindings.cpp's init()), so
// just let both mounts run; only the second (uncancelled) one's result
// actually gets applied.
export function useMqsimEngine(ssdConfigXml: string, workloadXml: string) {
  const [module, setModule] = useState<MqsimModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createMQSimModule()
      .then((mod) => {
        if (cancelled) return;
        mod.init(ssdConfigXml, workloadXml);
        setModule(mod);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { module, error, ready: module !== null };
}
