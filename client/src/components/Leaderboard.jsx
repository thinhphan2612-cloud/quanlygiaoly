import { useEffect, useState } from 'react';
import api from '../api';

const round1 = (n) => Math.round(n * 10) / 10;

// Bảng xếp hạng đầy đủ (kiểu BXH giải đấu): tổng hợp điểm TB + điểm danh + việc
// thiêng liêng của cả lớp trong khoảng đã chọn. Bấm tiêu đề cột để sắp xếp.
export default function Leaderboard({ classId, range, className, onClose }) {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState({ key: 'tb', dir: 'desc' });

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
      const wAvg = (id) => {
        let s = 0, w = 0;
        columns.forEach((c) => { const v = scores[id]?.[c.id]; if (v != null) { s += Number(v) * Number(c.weight); w += Number(c.weight); } });
        return w ? round1(s / w) : null;
      };
      const att = {}; (ar.data.students || []).forEach((s) => { att[s.id] = s; });
      const sessions = ar.data.dates.length;
      const sp = {}; (sr.data.students || []).forEach((s) => { sp[s.id] = s; });
      const taskCount = (tasksRes.data || []).length;
      const spPossible = sr.data.dates.length * taskCount;

      const merged = (students || []).map((s) => {
        const a = att[s.id] || { present: 0, absent: 0, late: 0 };
        const spDone = Object.values(sp[s.id]?.counts || {}).reduce((x, y) => x + y, 0);
        return {
          id: s.id,
          name: (s.saint_name ? s.saint_name + ' ' : '') + s.full_name,
          tb: wAvg(s.id),
          present: a.present, absent: a.absent, late: a.late,
          rate: sessions ? Math.round((a.present / sessions) * 100) : 0,
          sp: spDone, spPossible,
        };
      });
      setRows(merged);
    })();
    return () => { alive = false; };
  }, [classId, range.from, range.to]);

  function sortBy(key) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  }
  const sorted = rows ? [...rows].sort((a, b) => {
    if (sort.key === 'name') return (a.name.localeCompare(b.name, 'vi')) * (sort.dir === 'asc' ? 1 : -1);
    const av = a[sort.key] ?? -1, bv = b[sort.key] ?? -1;
    return (av - bv) * (sort.dir === 'asc' ? 1 : -1);
  }) : [];

  const cols = [
    { key: 'name', label: 'Học viên', align: 'left' },
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
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>🏆 Bảng xếp hạng — {className}</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>Khoảng {range.from.slice(8, 10)}/{range.from.slice(5, 7)} – {range.to.slice(8, 10)}/{range.to.slice(5, 7)}. Bấm tiêu đề cột để sắp xếp.</p>
        {!rows ? <p className="muted">Đang tải...</p> : (
          <div className="table-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  {cols.map((c) => (
                    <th key={c.key} onClick={() => sortBy(c.key)} className={`lb-th ${c.align === 'left' ? 'l' : ''} ${sort.key === c.key ? 'on' : ''}`}>
                      {c.label}{arrow(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.id} className={i < 3 ? `lb-top lb-top-${i + 1}` : ''}>
                    <td className="lb-rank">{i + 1}</td>
                    <td className="lb-name">{r.name}</td>
                    <td><b>{r.tb ?? '—'}</b></td>
                    <td>{r.present}</td>
                    <td className={r.absent > 0 ? 'lb-bad' : ''}>{r.absent}</td>
                    <td>{r.late}</td>
                    <td>{r.rate}%</td>
                    <td>{r.spPossible ? `${r.sp}/${r.spPossible}` : '—'}</td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={8} className="muted">Lớp chưa có học viên.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
