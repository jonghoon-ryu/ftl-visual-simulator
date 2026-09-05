import type { LogEntry } from '../types';

export function EventLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="sim-log">
      <div className="sim-panel-title">이벤트 로그</div>
      {entries.map((e, i) => (
        <div className="log-entry" key={i}>
          <span className="log-time">{e.time}</span>
          {e.text}
        </div>
      ))}
    </div>
  );
}
