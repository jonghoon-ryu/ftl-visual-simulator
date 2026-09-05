import type { MappingRow } from '../types';

export function MappingTable({ rows }: { rows: MappingRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="sim-panel">
      <div className="sim-panel-title">매핑 테이블 ( 일부 )</div>
      <table className="mini-table">
        <tbody>
          <tr>
            <th>LPA</th>
            <th>PPA</th>
            <th>상태</th>
          </tr>
          {rows.map((r) => (
            <tr key={r.lpa}>
              <td>{r.lpa}</td>
              <td>{r.ppa}</td>
              <td style={r.status === 'invalid' ? { color: '#f16d75' } : undefined}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
