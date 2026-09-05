import type { BlockRow } from '../types';

const LABELS: Record<string, string> = {
  valid: 'valid ( 유효한 데이터 )',
  invalid: 'invalid ( 지워질 예정 )',
  free: 'free ( 빈 페이지 )',
  moving: 'GC 로 이동 중',
};

interface Props {
  blocks: BlockRow[];
  caption: string;
}

export function FlashGrid({ blocks, caption }: Props) {
  const usedStates = new Set(blocks.flatMap((b) => b.pages.map((p) => p.state)));

  return (
    <div className="sim-grid-panel">
      <div className="sim-panel-title">Flash Array — Block × Page</div>
      <div className="sim-caption">{caption}</div>
      {blocks.map((block) => (
        <div className="grid-row" key={block.label}>
          <div className="row-label">{block.label}</div>
          <div className="row-cells">
            {block.pages.map((page, i) => (
              <div
                key={i}
                className={`cell ${page.state}`}
                title={`${block.label} / Page ${i} — ${page.state}`}
              >
                {page.state === 'valid' ? 'V' : page.state === 'invalid' ? 'X' : page.state === 'moving' ? '→' : ''}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="sim-legend">
        {Array.from(usedStates).map((state) => (
          <span key={state}>
            <span className={`swatch ${state}`} />
            {LABELS[state]}
          </span>
        ))}
      </div>
    </div>
  );
}
