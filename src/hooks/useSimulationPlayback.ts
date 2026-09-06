import { useCallback, useEffect, useRef, useState } from 'react';

// Real time between ticks while playing - `speed` (1-8, from Toolbar's
// slider) instead controls how many event-groups module.run() executes per
// tick, so higher speed means faster simulated progress at a constant
// real-time frame rate rather than a shorter interval.
const TICK_INTERVAL_MS = 300;

interface Options {
  module: MqsimModule | null;
  ssdConfigXml: string;
  workloadXml: string;
  onRefresh: () => void;
  onRestart: () => void;
}

// Drives module.step()/run() for Toolbar's playback controls. Kept separate
// from useMqsimEngine (which only loads/inits the module once) since this
// hook's state - isPlaying, speed, hasMore - is about *driving* an already-
// loaded engine, not loading it.
export function useSimulationPlayback({ module, ssdConfigXml, workloadXml, onRefresh, onRestart }: Options) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Keeps the interval/callbacks below calling the latest onRefresh without
  // needing it in their dependency arrays. Assigned in an effect (runs
  // after commit), not during render - mutating a ref's .current directly
  // in the render body is unsafe under Concurrent/Strict Mode.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  const stepOnce = useCallback(() => {
    if (!module) return;
    const more = module.step();
    onRefreshRef.current();
    setHasMore(more);
    if (!more) setIsPlaying(false);
  }, [module]);

  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => !playing);
  }, []);

  const restart = useCallback(() => {
    if (!module) return;
    setIsPlaying(false);
    module.configure(ssdConfigXml, workloadXml);
    setHasMore(true);
    onRestart();
    onRefreshRef.current();
  }, [module, ssdConfigXml, workloadXml, onRestart]);

  useEffect(() => {
    if (!isPlaying || !module) return;
    const id = setInterval(() => {
      const more = module.run(speed);
      onRefreshRef.current();
      setHasMore(more);
      if (!more) setIsPlaying(false);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, module, speed]);

  return { isPlaying, speed, hasMore, setSpeed, stepOnce, togglePlay, restart };
}
