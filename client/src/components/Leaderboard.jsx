import { useEffect, useState } from 'react';
import api from '../api';

const round1 = (n) => Math.round(n * 10) / 10;
const MEDAL = ['🥇', '🥈', '🥉'];

// Bảng xếp hạng THI ĐUA — podium top 3 + điểm thi đua tổng hợp + bảng sortable.
// Điểm thi đua = Học tập 50% + Chuyên cần 30% + Việc thiêng liêng 20% (thang 100).
export default function Leaderboard({ classId, range, className, onClose }) {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState({ key: 'points', dir: 'desc' });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [gc, ar, sr, tasksRes] = await Promise.all([
        api.get(`/grades-class?class_id=${classId}`),
        api.get(`/attendance-range?class_id=${classId}&from=${range.from}&to=${range.to}`),
        api.get(`/spiritual-range?class_id=${classId}&from=${range.from}&to=${range.to}`),
        api.get('/spiritual-tasks'),
      ]);
      if (!alive) return;
      const { students, columns, scores } = gc.data;
      const wAvg = (id) => { let s = 0, w = 0; columns.forEach((c) => { const v = scores[id]?.[c.id]; if (v != null) { s += Number(v) * Number(c.weight); w += Number(c.weight); } }); return w ? round1(s / w) : null; };
      const att = {}; (ar.data.students || []).forEach((s) => { att[s.id] = s; });
      const sessions = ar.data.dates.length;
      const sp = {}; (sr.data.students || []).forEach((s) => { sp[s.id] = s; });
      const spPossible = sr.data.dates.length * (tasksRes.data || []).length;

      const merged = (students || []).map((s) => {
        const a = att[s.id] || { present: 0, absent: 0, late: 0 };
        const spDone = Object.values(sp[s.id]?.counts || {}).reduce((x, y) => x + y, 0);
        const tb = wAvg(s.id);
        const rate = sessions ? Math.round((a.present / sessions) * 100) : 0;
        const tl = spPossible ? (spDone / spPossible) * 100 : 0;
        const points = Math.round((tb != null ? (tb / 10) * 100 : 0) * 0.5 + rate * 0.3 + tl * 0.2);
        return { id: s.id, name: (s.saint_name ? s.saint_name + ' ' : '') + s.full_name, tb, present: a.present, absent: a.absent, late: a.late, rate, sp: spDone, spPossible, points };
      });
      setRows(merged);
    })();
    return () => { alive = false; };
  }, [classId, range.from, range.to]);

  // Xếp hạng chính thức theo điểm thi đua (podium + huy chương cố định)
  const ranking = rows ? [...rows].sort((a, b) => b.points - a.points) : [];
  const medalRank = {}; ranking.forEach((r, i) => { if (i < 3) medalRank[r.id] = i; });

  function sortBy(key) { setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })); }
  const sorted = rows ? [...rows].sort((a, b) => {
    if (sort.key === 'name') return a.name.localeCompare(b.name, 'vi') * (sort.dir === 'asc' ? 1 : -1);
    return ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * (sort.dir === 'asc' ? 1 : -1);
  }) : [];

  const cols = [
    { key: 'name', label: 'Học viên', align: 'left' },
    { key: 'points', label: 'Điểm thi đua' },
    { key: 'tb', label: 'Điểm TB' },
    { key: 'present', label: 'Có mặt' },
    { key: 'absent', label: 'Vắng' },
    { key: 'late', label: 'Trễ' },
    { key: 'rate', label: 'Chuyên cần' },
    { key: 'sp', label: 'Việc TL' },
  ];
  const arrow = (k) => (sort.key === k ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide lb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lb-hero">
          <div className="lb-hero-title">🏆 Bảng xếp hạng thi đua</div>
          <div className="lb-hero-sub">{className} · {range.from.slice(8, 10)}/{range.from.slice(5, 7)} – {range.to.slice(8, 10)}/{range.to.slice(5, 7)}</div>
        </div>

        {!rows ? <p className="muted" style={{ padding: 20 }}>Đang tải...</p> : (
          <>
            <div className="table-scroll">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {cols.map((c) => (
                      <th key={c.key} onClick={() => sortBy(c.key)} className={`lb-th ${c.align === 'left' ? 'l' : ''} ${sort.key === c.key ? 'on' : ''}`}>{c.label}{arrow(c.key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const m = medalRank[r.id];
                    return (
                      <tr key={r.id} className={m != null ? `lb-top lb-top-${m + 1}` : ''}>
                        <td className="lb-rank">{m != null ? MEDAL[m] : i + 1}</td>
                        <td className="lb-name">{r.name}</td>
                        <td><span className="lb-points">{r.points}</span></td>
                        <td><b>{r.tb ?? '—'}</b></td>
                        <td>{r.present}</td>
                        <td className={r.absent > 0 ? 'lb-bad' : ''}>{r.absent}</td>
                        <td>{r.late}</td>
                        <td>
                          <div className="lb-bar"><span style={{ width: `${r.rate}%` }} /></div>
                          <span className="lb-bar-val">{r.rate}%</span>
                        </td>
                        <td>{r.spPossible ? `${r.sp}/${r.spPossible}` : '—'}</td>
                      </tr>
                    );
                  })}
                  {sorted.length === 0 && <tr><td colSpan={9} className="muted">Lớp chưa có học viên.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Điểm thi đua = Học tập 50% + Chuyên cần 30% + Việc thiêng liêng 20% (thang 100). Bấm tiêu đề cột để sắp xếp.</p>
          </>
        )}
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
