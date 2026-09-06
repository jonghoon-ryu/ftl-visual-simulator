import type { WearRow } from '../types';

// Converts the WASM engine's real per-block snapshot into the WearRow[]
// shape WearLevelingView.tsx renders. Unlike the static mock data (a fixed
// maxEraseCount: 120, calibrated to look good against upstream's realistic
// Block_PE_Cycles_Limit), this scales relative to whatever the *current*
// highest erase count in the device actually is - at this preset's demo
// scale that's usually single digits (see buildWlWorkloadXml's doc comment
// in mqsimConfigs.ts), so a fixed absolute scale would leave every bar
// looking empty.
export function toWearRows(state: MqsimState | null): WearRow[] {
  if (!state) return [];

  const maxEraseCount = Math.max(1, ...state.blocks.map((block) => block.eraseCount));

  return state.blocks.map((block) => {
    const ratio = block.eraseCount / maxEraseCount;
    const level: WearRow['level'] = ratio >= 0.8 ? 'hot' : ratio <= 0.3 ? 'cool' : 'warm';
    return {
      label: `Block ${block.block}`,
      eraseCount: block.eraseCount,
      maxEraseCount,
      level,
    };
  });
}
