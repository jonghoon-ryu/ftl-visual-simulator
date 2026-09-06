import type { BlockRow } from '../types';

// Converts the WASM engine's real per-block/page snapshot into the
// BlockRow[] shape FlashGrid.tsx renders. No 'moving' state comes from
// here (see Block_Page_State's doc comment in Flash_Block_Manager_Base.h -
// a point-in-time snapshot can't see a transient GC/WL page move).
export function toBlockRows(state: MqsimState | null): BlockRow[] {
  if (!state) return [];

  return state.blocks.map((block) => ({
    label: `Block ${block.block}`,
    pages: block.pages.map((pageState) => ({ state: pageState })),
  }));
}
