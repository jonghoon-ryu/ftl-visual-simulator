import type { MappingRow } from '../types';

// How many mapped rows to show in the "매핑 테이블 (일부)" panel - the
// underlying getState().mapping array covers every LPA in the address
// space (mostly unmapped until written), so this is a display-side slice,
// not a limit the engine itself applies.
const MAX_DISPLAY_ROWS = 20;

// Converts the WASM engine's raw getState().mapping (BigInt lpa/ppa, a
// decomposed physical address once mapped) into the plain-string rows
// MappingTable.tsx renders. Unmapped LPAs (never written) are dropped -
// showing hundreds of "미기록" rows on load isn't useful to a beginner.
export function toMappingRows(state: MqsimState | null): MappingRow[] {
  if (!state) return [];

  return state.mapping
    .filter((row): row is MqsimMappingRow & { address: MqsimPageAddress } => row.mapped && row.address !== null)
    .slice(0, MAX_DISPLAY_ROWS)
    .map((row) => ({
      lpa: `0x${row.lpa.toString(16).padStart(3, '0')}`,
      ppa: `B${row.address.block}·P${row.address.page}`,
      status: 'valid',
    }));
}
