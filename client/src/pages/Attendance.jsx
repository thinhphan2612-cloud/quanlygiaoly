import { useEffect, useState } from 'react';
import api from '../api';
import { exportXlsx, exportPdf, STT_COL, ATT_LABEL, fileSlug, exportSubtitle } from '../lib/exportUtils';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = [
  { key: 'present', label: 'Có mặt' },
  { key: 'late', label: 'Trễ' },
  { key: 'absent', label: 'Vắng KP' },
  { key: 'excused', label: 'Vắng CP' },
];
const ICON = { present: '✓', absent: '✗', late: '⏱', excused: 'P' };
const ICON_CLASS = { present: 'ic-present', absent: 'ic-absent', late: 'ic-late', excused: 'ic-excused' };
const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

// Khoảng tuần (CN -> T7) và tháng của một ngày
function weekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d); start.setDate(d.getDate() - d.getDay()); // Chủ nhật
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const iso = (x) => x.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}
function monthRange(dateStr) {
  const from = dateStr.slice(0, 8) + '01';
  const d = new Date(dateStr + 'T00:00:00');
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: last.toISOString().slice(0, 10) };
}

// Danh sách xếp hạng (chuyên cần nhất / cần nhắc nhở)
function RankList({ title, tone, rows, emptyText = 'Chưa có dữ liệu' }) {
  return (
    <div className={`rank-block ${tone}`}>
      <div className="rank-title">{title}</div>
      {rows.length === 0 ? <div className="muted" style={{ fontSize: 13, padding: '6px 2px' }}>{emptyText}</div>
        : rows.map((r, i) => (
          <div className="rank-row" key={i}>
            <span className="rank-no">{i + 1}</span>
            <span className="rank-name">{r.name}</span>
            <span className="rank-detail">{r.detail}</span>
          </div>
        ))}
    </div>
  );
}

export default function Attendance() {
  const [tab, setTab] = useState('giaoly'); // giaoly | thieng
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState('day'); // day | week | month
  const [parish, setParish] = useState(null);

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);
  const cls = classes.find((c) => c.id === classId) || {};
  const className = cls.name || '';
  const range = mode === 'week' ? weekRange(date) : mode === 'month' ? monthRange(date) : null;

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Điểm danh</h1>
        <div className="seg">
          <button className={tab === 'giaoly' ? 'on' : ''} onClick={() => { setTab('giaoly'); setMode('day'); }}>Giáo lý</button>
          <button className={tab === 'thieng' ? 'on' : ''} onClick={() => { setTab('thieng'); setMode('day'); }}>Việc Thiêng liêng</button>
        </div>
      </div>

      <div className="toolbar">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 200 }}>
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
        <div className="seg sm">
          <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>Ngày</button>
          <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>Tuần</button>
          <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Tháng</button>
        </div>
      </div>

      {!classId ? (
        <div className="panel"><p className="muted">Hãy chọn lớp để điểm danh.</p></div>
      ) : tab === 'giaoly' ? (
        mode === 'day'
          ? <GiaoLyDay classId={classId} date={date} cls={cls} parish={parish} />
          : <GiaoLyStats classId={classId} range={range} mode={mode} className={className} />
      ) : (
        mode === 'day'
          ? <ThiengDay classId={classId} date={date} />
          : <ThiengStats classId={classId} range={range} className={className} />
      )}
    </div>
  );
}

/* ---------------- GIÁO LÝ: điểm danh theo ngày ---------------- */
function GiaoLyDay({ classId, date, cls, parish }) {
  const className = cls?.name || '';
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.get(`/attendance?class_id=${classId}&date=${date}`).then((r) => setRows(r.data));
    setSaved(false);
  }, [classId, date]);

  const setStatus = (id, status) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r))); setSaved(false); };
  const setRowNote = (id, note) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, note } : r))); setSaved(false); };
  const markAll = (status) => { setRows((rs) => rs.map((r) => ({ ...r, status }))); setSaved(false); };
  const allPresent = rows.length > 0 && rows.every((r) => r.status === 'present');
  async function save() {
    await api.post('/attendance', { date, records: rows.map((r) => ({ student_id: r.id, status: r.status || 'present', note: r.note || '' })) });
    setSaved(true);
  }
  const attColumns = [
    STT_COL,
    { label: 'Tên thánh', get: (r) => r.saint_name || '', width: 14 },
    { label: 'Họ và tên', get: (r) => r.full_name, width: 24 },
    { label: 'Trạng thái', get: (r) => ATT_LABEL[r.status] || 'Chưa điểm danh', width: 16 },
  ];
  const meta = { title: 'Phiếu điểm danh', subtitle: exportSubtitle({ parish, cls, extra: [`Ngày: ${date.split('-').reverse().join('/')}`] }), columns: attColumns, rows };

  if (rows.length === 0) return <div className="panel"><p className="muted">Lớp chưa có học viên.</p></div>;
  return (
    <div className="panel">
      <div className="toolbar" style={{ marginTop: 0 }}>
        <button className="btn ghost" onClick={() => markAll(allPresent ? null : 'present')}>{allPresent ? '↩ Bỏ đánh dấu tất cả' : 'Đánh dấu tất cả có mặt'}</button>
        <button className="btn ghost" onClick={() => exportXlsx({ filename: `diem-danh-${fileSlug(className)}-${date}.xlsx`, sheetName: 'Điểm danh', ...meta })}>⬇ Excel</button>
        <button className="btn ghost" onClick={() => exportPdf(meta)}>🖨 PDF</button>
      </div>
      <table>
        <thead><tr><th>Tên thánh</th><th>Họ tên</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.saint_name || '—'}</td>
              <td>{r.full_name}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {STATUSES.map((s) => (
                    <button key={s.key} className={`btn sm ${r.status === s.key ? '' : 'ghost'}`} onClick={() => setStatus(r.id, s.key)}>{s.label}</button>
                  ))}
                  {r.status === 'excused' && (
                    <input className="excuse-note" value={r.note || ''} onChange={(e) => setRowNote(r.id, e.target.value)} placeholder="Lý do nghỉ phép..." />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={save}>Lưu điểm danh</button>
        {saved && <span style={{ color: 'var(--success)' }}>✓ Đã lưu</span>}
      </div>
    </div>
  );
}

/* ---------------- GIÁO LÝ: thống kê tuần/tháng ---------------- */
function GiaoLyStats({ classId, range, mode }) {
  const [data, setData] = useState({ dates: [], students: [] });
  const [byDiligence, setByDiligence] = useState(false);
  useEffect(() => {
    api.get(`/attendance-range?class_id=${classId}&from=${range.from}&to=${range.to}`).then((r) => setData(r.data));
  }, [classId, range.from, range.to]);

  const total = data.dates.length;
  let students = [...data.students];
  if (byDiligence) students.sort((a, b) => b.present - a.present);
  else students.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

  const nameOf = (s) => (s.saint_name ? s.saint_name + ' ' : '') + s.full_name;
  // Vắng có phép (excused) không tính vào tỷ lệ chuyên cần
  const rateA = (s) => { const c = s.present + s.absent + s.late; return c ? s.present / c : 0; };
  const avgRate = data.students.length
    ? Math.round((100 * data.students.reduce((a, s) => a + rateA(s), 0)) / data.students.length) : 0;
  const diligent = [...data.students].filter((s) => rateA(s) >= 0.8).sort((a, b) => b.present - a.present)
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${s.present}/${total}` }));
  const remind = [...data.students].filter((s) => rateA(s) < 0.5).sort((a, b) => b.absent - a.absent)
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `vắng ${s.absent}/${total}` }));

  return (
    <div className="panel">
      <div className="stats-bar">
        <span className="muted">{mode === 'week' ? 'Tuần' : 'Tháng'}: {ddmm(range.from)} – {ddmm(range.to)} · {total} buổi đã điểm danh</span>
        <label className="fp-chk"><input type="checkbox" checked={byDiligence} onChange={(e) => setByDiligence(e.target.checked)} /><span>Sắp xếp chuyên cần</span></label>
      </div>
      {total > 0 && (
        <>
          <div className="stat-cards">
            <div className="stat-mini"><div className="lbl">Buổi đã điểm danh</div><div className="num">{total}</div></div>
            <div className="stat-mini"><div className="lbl">Tỷ lệ đi học TB lớp</div><div className="num">{avgRate}%</div></div>
            <div className="stat-mini"><div className="lbl">Sĩ số</div><div className="num">{data.students.length}</div></div>
          </div>
          <div className="rank-grid">
            <RankList title="🌟 Chuyên cần (đi học ≥ 80%)" tone="good" rows={diligent} emptyText="Chưa có bạn nào đạt ≥ 80%" />
            <RankList title="⚠ Cần nhắc nhở (đi học < 50%)" tone="warn" rows={remind} emptyText="Không có bạn nào cần nhắc 👍" />
          </div>
        </>
      )}
      {total === 0 ? <p className="muted">Chưa có buổi điểm danh nào trong khoảng này.</p> : (
        <div className="table-scroll">
          <table className="grid-att">
            <thead>
              <tr><th>Học viên</th>{data.dates.map((d) => <th key={d} className="col-day">{ddmm(d)}</th>)}<th>Thống kê</th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</td>
                  {data.dates.map((d) => (
                    <td key={d} className="col-day">
                      {s.byDate[d] ? <span className={`att-ic ${ICON_CLASS[s.byDate[d]]}`}>{ICON[s.byDate[d]]}</span> : <span className="muted">·</span>}
                    </td>
                  ))}
                  <td><b>{s.present}</b><span className="muted">/{total}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- VIỆC THIÊNG LIÊNG: theo ngày ---------------- */
function ThiengDay({ classId, date }) {
  const [tasks, setTasks] = useState([]);
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(false);
  const [gear, setGear] = useState(false);
  const [newTask, setNewTask] = useState('');

  function loadTasks() { api.get('/spiritual-tasks').then((r) => setTasks(r.data)); }
  useEffect(() => { loadTasks(); }, []);
  useEffect(() => {
    api.get(`/spiritual?class_id=${classId}&date=${date}`).then((r) => setRows(r.data));
    setSaved(false);
  }, [classId, date]);

  const toggle = (sid, tid) => {
    setRows((rs) => rs.map((r) => (r.id === sid ? { ...r, done: { ...r.done, [tid]: !r.done[tid] } } : r)));
    setSaved(false);
  };
  const allChecked = rows.length > 0 && tasks.length > 0 && rows.every((r) => tasks.every((t) => r.done[t.id]));
  function markAll(val) {
    setRows((rs) => rs.map((r) => ({ ...r, done: Object.fromEntries(tasks.map((t) => [t.id, val])) })));
    setSaved(false);
  }
  async function save() {
    const records = [];
    rows.forEach((r) => tasks.forEach((t) => records.push({ student_id: r.id, task_id: t.id, done: !!r.done[t.id] })));
    await api.post('/spiritual', { date, records });
    setSaved(true);
  }
  async function addTask() {
    if (!newTask.trim()) return;
    await api.post('/spiritual-tasks', { name: newTask.trim(), order_index: tasks.length });
    setNewTask(''); loadTasks();
  }
  async function delTask(id) {
    if (!confirm('Xóa việc thiêng liêng này? Các bản ghi liên quan cũng bị xóa.')) return;
    await api.delete(`/spiritual-tasks/${id}`); loadTasks();
  }

  return (
    <div className="panel">
      <div className="toolbar" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <span className="muted">Đánh dấu việc thiêng liêng ngày {date.split('-').reverse().join('/')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {tasks.length > 0 && rows.length > 0 && (
            <button className="btn ghost" onClick={() => markAll(!allChecked)}>{allChecked ? '↩ Bỏ chọn tất cả' : '✓ Chọn tất cả'}</button>
          )}
          <button className="btn ghost" onClick={() => setGear(true)}>⚙ Quản lý việc</button>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="muted">Chưa có việc thiêng liêng nào. Bấm "⚙ Quản lý việc" để thêm (Đi lễ, Đọc kinh...).</p>
      ) : rows.length === 0 ? (
        <p className="muted">Lớp chưa có học viên.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Học viên</th>{tasks.map((t) => <th key={t.id} style={{ textAlign: 'center' }}>{t.name}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.saint_name ? r.saint_name + ' ' : ''}{r.full_name}</td>
                    {tasks.map((t) => (
                      <td key={t.id} style={{ textAlign: 'center' }}>
                        <input type="checkbox" className="big-check" checked={!!r.done[t.id]} onChange={() => toggle(r.id, t.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn" onClick={save}>Lưu</button>
            {saved && <span style={{ color: 'var(--success)' }}>✓ Đã lưu</span>}
          </div>
        </>
      )}

      {gear && (
        <div className="modal-backdrop" onClick={() => setGear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Quản lý việc thiêng liêng</h2>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <input className="grow" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="VD: Đi lễ, Đọc kinh, Xưng tội..." />
              <button className="btn" onClick={addTask}>+ Thêm</button>
            </div>
            <table>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}><td>{t.name}</td><td style={{ textAlign: 'right' }}><button className="btn danger sm" onClick={() => delTask(t.id)}>Xóa</button></td></tr>
                ))}
                {tasks.length === 0 && <tr><td className="muted">Chưa có việc nào</td></tr>}
              </tbody>
            </table>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setGear(false)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- VIỆC THIÊNG LIÊNG: thống kê tuần/tháng ---------------- */
function ThiengStats({ classId, range }) {
  const [tasks, setTasks] = useState([]);
  const [data, setData] = useState({ dates: [], students: [] });
  useEffect(() => { api.get('/spiritual-tasks').then((r) => setTasks(r.data)); }, []);
  useEffect(() => {
    api.get(`/spiritual-range?class_id=${classId}&from=${range.from}&to=${range.to}`).then((r) => setData(r.data));
  }, [classId, range.from, range.to]);

  const total = data.dates.length;
  const students = [...data.students].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  const nameOf = (s) => (s.saint_name ? s.saint_name + ' ' : '') + s.full_name;
  const totalPossible = total * tasks.length;
  const doneOf = (s) => tasks.reduce((a, t) => a + (s.counts[t.id] || 0), 0);
  const rateT = (s) => (totalPossible ? doneOf(s) / totalPossible : 0);
  const siengNang = [...data.students].filter((s) => rateT(s) >= 0.8).sort((a, b) => doneOf(b) - doneOf(a))
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${doneOf(s)}/${totalPossible}` }));
  const canNhac = [...data.students].filter((s) => rateT(s) < 0.5).sort((a, b) => doneOf(a) - doneOf(b))
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${doneOf(s)}/${totalPossible}` }));

  return (
    <div className="panel">
      <div className="stats-bar"><span className="muted">{ddmm(range.from)} – {ddmm(range.to)} · {total} ngày có ghi nhận</span></div>
      {tasks.length > 0 && total > 0 && (
        <div className="rank-grid">
          <RankList title="🌟 Siêng năng (làm ≥ 80%)" tone="good" rows={siengNang} emptyText="Chưa có bạn nào đạt ≥ 80%" />
          <RankList title="⚠ Cần nhắc nhở (làm < 50%)" tone="warn" rows={canNhac} emptyText="Không có bạn nào cần nhắc 👍" />
        </div>
      )}
      {tasks.length === 0 ? <p className="muted">Chưa có việc thiêng liêng nào.</p> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Học viên</th>{tasks.map((t) => <th key={t.id} style={{ textAlign: 'center' }}>{t.name}</th>)}</tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</td>
                  {tasks.map((t) => <td key={t.id} style={{ textAlign: 'center' }}><b>{s.counts[t.id] || 0}</b><span className="muted">/{total}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
