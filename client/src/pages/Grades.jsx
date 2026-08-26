import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { byViName } from '../lib/viName';
import { exportXlsx, exportPdf, STT_COL, fileSlug, exportSubtitle } from '../lib/exportUtils';

const round1 = (n) => Math.round(n * 10) / 10;

export default function Grades() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [classes, setClasses] = useState([]);
  const [activeClasses, setActiveClasses] = useState([]);
  const [currentYear, setCurrentYear] = useState('');
  const [year, setYear] = useState('');
  const [yearList, setYearList] = useState([]);
  const [classId, setClassId] = useState('');
  const [data, setData] = useState({ students: [], columns: [], scores: {} });
  const [sortByRank, setSortByRank] = useState(false);
  const [gf, setGf] = useState({ op: '', val: '', missingOnly: false });
  const [gear, setGear] = useState(false);
  const [overview, setOverview] = useState(false);
  const [savingCell, setSavingCell] = useState('');
  const [parish, setParish] = useState(null);

  const [searchParams] = useSearchParams();
  const isCurrent = !year || year === currentYear;
  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/archive-years').catch(() => ({ data: [] }))]).then(([c, ay]) => {
      setActiveClasses(c.data);
      setClasses(c.data);
      const cur = c.data[0]?.year || '';
      setCurrentYear(cur);
      const list = [...new Set([cur, ...(ay.data || []).map((y) => y.year)].filter(Boolean))];
      setYearList(list);
      setYear(cur || list[0] || '');
    });
  }, []);
  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);
  useEffect(() => { const c = searchParams.get('class'); if (c) setClassId(c); }, [searchParams]);
  // đổi năm học -> đổi danh sách lớp
  useEffect(() => {
    if (!year) return;
    setClassId(''); setData({ students: [], columns: [], scores: {} });
    if (year === currentYear) setClasses(activeClasses);
    else api.get(`/archive-classes?year=${encodeURIComponent(year)}`).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [year, currentYear, activeClasses]);
  function load() {
    if (!classId) { setData({ students: [], columns: [], scores: {} }); return; }
    const url = isCurrent ? `/grades-class?class_id=${classId}` : `/archive-class?class_id=${classId}`;
    api.get(url).then((r) => setData(r.data));
  }
  async function endYear() {
    if (!confirm(
      'KẾT THÚC NĂM HỌC & LÊN LỚP\n\n' +
      'Hệ thống sẽ tạo bộ lớp mới cho năm sau (sao chép các lớp bật "Tự động lên lớp"), ' +
      'chuyển học viên lên bậc kế tiếp (điểm bắt đầu lại). Học viên lớp cao nhất ra trường.\n\n' +
      'Dữ liệu năm hiện tại được đóng băng, tra cứu ở tab "Lưu trữ".\n\nBạn chắc chắn?'
    )) return;
    try {
      const r = await api.post('/promote', {});
      alert(`Đã lên lớp ${r.data.promoted} học viên, ${r.data.graduated} em ra trường.` + (r.data.new_year ? ` Năm học mới: ${r.data.new_year}.` : ''));
      setClassId('');
      api.get('/classes').then((res) => setClasses(res.data));
    } catch (e) { alert(e.response?.data?.error || 'Lên lớp thất bại'); }
  }
  useEffect(() => { load(); }, [classId]);

  const { students, columns, scores } = data;
  const cls = classes.find((c) => c.id === classId) || {};
  const className = cls.name || '';
  // Thông tin đầu bảng điểm khi xuất: giáo xứ, lớp, năm học, GV phụ trách
  const expSub = exportSubtitle({ parish, cls });

  function cellVal(sid, cid) { const v = scores[sid]?.[cid]; return v == null ? '' : v; }
  function setCell(sid, cid, val) {
    setData((d) => ({ ...d, scores: { ...d.scores, [sid]: { ...(d.scores[sid] || {}), [cid]: val } } }));
  }
  async function saveCell(sid, cid, val) {
    setSavingCell(sid + cid);
    await api.post('/grade-cell', { student_id: sid, column_id: cid, score: val === '' ? '' : Number(val) });
    setSavingCell('');
  }

  function weightedAvg(sid) {
    let s = 0, sw = 0;
    columns.forEach((c) => {
      const v = scores[sid]?.[c.id];
      if (v != null && v !== '') { s += Number(v) * Number(c.weight); sw += Number(c.weight); }
    });
    return sw ? round1(s / sw) : null;
  }

  // xếp hạng theo TB
  const ranked = [...students].map((s) => ({ ...s, avg: weightedAvg(s.id) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const rankOf = {}; ranked.forEach((s, i) => { rankOf[s.id] = s.avg == null ? null : i + 1; });

  const ordered = sortByRank ? ranked : [...students].sort((a, b) => byViName(a, b));
  // Lọc theo điểm TB / thiếu cột điểm (chuyển từ tab Học viên sang đây)
  const scoreCount = (id) => columns.filter((c) => scores[id]?.[c.id] != null).length;
  const display = ordered.filter((s) => {
    if (gf.op && gf.val !== '') {
      const a = weightedAvg(s.id);
      if (a == null) return false;
      if (gf.op === 'gte' && !(a >= Number(gf.val))) return false;
      if (gf.op === 'lte' && !(a <= Number(gf.val))) return false;
    }
    if (gf.missingOnly && !(scoreCount(s.id) < columns.length)) return false;
    return true;
  });

  // export
  function exportSheet(mode) {
    const cols = [
      STT_COL,
      { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
      { label: 'Họ và tên', get: (s) => s.full_name, width: 24 },
      ...columns.map((c) => ({ label: `${c.name}${Number(c.weight) !== 1 ? ` (x${c.weight})` : ''}`, get: (s) => cellVal(s.id, c.id), width: 10 })),
      { label: 'TB', get: (s) => weightedAvg(s.id) ?? '', width: 8 },
      { label: 'Hạng', get: (s) => rankOf[s.id] ?? '', width: 7 },
    ];
    const meta = { title: 'Bảng điểm', subtitle: expSub, columns: cols, rows: display };
    if (mode === 'excel') exportXlsx({ filename: `bang-diem-${fileSlug(className)}.xlsx`, sheetName: 'Bảng điểm', ...meta });
    else exportPdf(meta);
  }

  return (
    <div>
      <h1>Điểm số</h1>
      <div className="toolbar">
        {yearList.length > 1 && (
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 150 }}>
            {yearList.map((y) => <option key={y} value={y}>Năm {y}{y === currentYear ? ' (nay)' : ''}</option>)}
          </select>
        )}
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 220 }}>
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isAdmin && isCurrent && <button className="btn ghost" onClick={endYear}>🏁 Kết thúc năm học</button>}
        {classId && (
          <>
            {isCurrent && <button className="btn ghost" onClick={() => setGear(true)}>⚙ Cột điểm</button>}
            <button className="btn ghost" onClick={() => setOverview(true)} disabled={columns.length === 0}>📋 Tổng quát</button>
            <button className="btn ghost" onClick={() => exportSheet('excel')} disabled={columns.length === 0}>⬇ Excel</button>
            <button className="btn ghost" onClick={() => exportSheet('pdf')} disabled={columns.length === 0}>🖨 PDF</button>
            <div className="fp-inline" style={{ marginLeft: 'auto' }}>
              <span className="muted" style={{ fontSize: 13 }}>Lọc TB:</span>
              <select value={gf.op} onChange={(e) => setGf({ ...gf, op: e.target.value })} style={{ minWidth: 130 }}>
                <option value="">Không lọc</option>
                <option value="gte">≥</option>
                <option value="lte">≤</option>
              </select>
              <input type="number" step="0.1" min="0" max="10" placeholder="VD: 5" value={gf.val}
                onChange={(e) => setGf({ ...gf, val: e.target.value })} disabled={!gf.op} style={{ width: 80 }} />
            </div>
            <label className="fp-chk">
              <input type="checkbox" checked={gf.missingOnly} onChange={(e) => setGf({ ...gf, missingOnly: e.target.checked })} /><span>Thiếu cột điểm</span>
            </label>
            <label className="fp-chk">
              <input type="checkbox" checked={sortByRank} onChange={(e) => setSortByRank(e.target.checked)} /><span>Sắp xếp theo thứ hạng</span>
            </label>
          </>
        )}
      </div>

      {!classId ? (
        <div className="panel"><p className="muted">Hãy chọn lớp để nhập điểm.</p></div>
      ) : columns.length === 0 ? (
        <div className="panel"><p className="muted">{isCurrent ? 'Lớp chưa có cột điểm nào. Bấm "⚙ Cột điểm" để tạo (Kiểm tra 15\', Thi HK1...).' : 'Lớp này không có cột điểm trong năm học đã chọn.'}</p></div>
      ) : students.length === 0 ? (
        <div className="panel"><p className="muted">Lớp chưa có học viên.</p></div>
      ) : (
        <div className="panel">
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>{isCurrent ? 'Nhập điểm trực tiếp vào ô, tự lưu khi bấm ra ngoài.' : `Đang xem điểm năm học ${year} (đã lưu trữ — chỉ đọc).`}</p>
          <div className="table-scroll">
            <table className="grade-table">
              <thead>
                <tr>
                  <th className="sticky-col">Học viên</th>
                  {columns.map((c) => <th key={c.id} className="col-day">{c.name}{Number(c.weight) !== 1 && <span className="wt">x{c.weight}</span>}</th>)}
                  <th>TB</th><th>Hạng</th>
                </tr>
              </thead>
              <tbody>
                {display.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky-col">{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</td>
                    {columns.map((c) => (
                      <td key={c.id} className="col-day">
                        {isCurrent ? (
                          <input
                            className={`cell-input ${savingCell === s.id + c.id ? 'saving' : ''}`}
                            type="number" step="0.1" min="0" max="10"
                            value={cellVal(s.id, c.id)}
                            onChange={(e) => setCell(s.id, c.id, e.target.value)}
                            onBlur={(e) => saveCell(s.id, c.id, e.target.value)}
                          />
                        ) : (
                          <span>{cellVal(s.id, c.id) || '—'}</span>
                        )}
                      </td>
                    ))}
                    <td><b>{weightedAvg(s.id) ?? '—'}</b></td>
                    <td>{rankOf[s.id] ? <span className="rank-chip">{rankOf[s.id]}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gear && <ColumnManager classId={classId} columns={columns} onChange={load} onClose={() => setGear(false)} />}
      {overview && (
        <div className="modal-backdrop" onClick={() => setOverview(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>Bảng điểm tổng quát — {className}</h2>
            <div className="table-scroll">
              <table className="grade-table">
                <thead>
                  <tr><th>Học viên</th>{columns.map((c) => <th key={c.id}>{c.name}{Number(c.weight) !== 1 && <span className="wt">x{c.weight}</span>}</th>)}<th>TB</th><th>Hạng</th></tr>
                </thead>
                <tbody>
                  {ranked.map((s) => (
                    <tr key={s.id}>
                      <td>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</td>
                      {columns.map((c) => <td key={c.id} style={{ textAlign: 'center' }}>{cellVal(s.id, c.id) || '—'}</td>)}
                      <td style={{ textAlign: 'center' }}><b>{s.avg ?? '—'}</b></td>
                      <td style={{ textAlign: 'center' }}>{rankOf[s.id] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setOverview(false)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Quản lý cột điểm + hệ số ---------------- */
function ColumnManager({ classId, columns, onChange, onClose }) {
  const [list, setList] = useState(columns);
  const [nn, setNn] = useState({ name: '', weight: '1' });
  useEffect(() => { setList(columns); }, [columns]);

  async function add() {
    if (!nn.name.trim()) return;
    await api.post('/grade-columns', { class_id: classId, name: nn.name.trim(), weight: Number(nn.weight) || 1, order_index: list.length });
    setNn({ name: '', weight: '1' }); onChange();
  }
  async function saveCol(c, patch) { await api.put(`/grade-columns/${c.id}`, patch); onChange(); }
  async function del(c) { if (confirm(`Xóa cột "${c.name}"? Điểm của cột này sẽ mất.`)) { await api.delete(`/grade-columns/${c.id}`); onChange(); } }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cột điểm & hệ số</h2>
        <table>
          <thead><tr><th>Tên cột điểm</th><th style={{ width: 90 }}>Hệ số</th><th></th></tr></thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={c.id}>
                <td><input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && saveCol(c, { name: e.target.value })} /></td>
                <td><input type="number" step="0.5" min="0" defaultValue={c.weight} onBlur={(e) => Number(e.target.value) !== Number(c.weight) && saveCol(c, { weight: e.target.value })} /></td>
                <td><button className="btn danger sm" onClick={() => del(c)}>Xóa</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={3} className="muted">Chưa có cột điểm</td></tr>}
          </tbody>
        </table>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 12 }}>
          <div className="field"><label>Thêm cột điểm</label><input value={nn.name} onChange={(e) => setNn({ ...nn, name: e.target.value })} placeholder="VD: Kiểm tra 1 tiết" /></div>
          <div className="field" style={{ flex: '0 0 90px' }}><label>Hệ số</label><input type="number" step="0.5" min="0" value={nn.weight} onChange={(e) => setNn({ ...nn, weight: e.target.value })} /></div>
          <div className="field" style={{ flex: '0 0 auto' }}><button className="btn" onClick={add}>+ Thêm</button></div>
        </div>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
