import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { exportXlsxMulti, exportPdfMulti, STT_COL, fileSlug, exportSubtitle } from '../lib/exportUtils';
import Avatar from '../components/Avatar.jsx';
import { IconDownload, IconPrinter, IconSliders } from '../components/Icons.jsx';
import { pickClass, rememberClass } from '../lib/lastClass';
import { toast } from '../lib/toast';
import { SkeletonTable } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import { byViName } from '../lib/viName';
import { useActiveTour } from '../lib/tour';
import PageHeader from '../components/PageHeader.jsx';

// Ngày dạng YYYY-MM-DD theo giờ ĐỊA PHƯƠNG (không dùng toISOString vì lệch múi giờ).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const weekdayOf = (s) => WEEKDAY[new Date(s + 'T00:00:00').getDay()];
// Nhãn ngắn dùng thống nhất cho nút, chip tổng hợp và bảng thống kê
const STATUSES = [
  { key: 'present', label: 'Có mặt', short: 'Có', code: 'C', title: 'Có mặt' },
  { key: 'late', label: 'Trễ', short: 'Trễ', code: 'T', title: 'Đi trễ' },
  { key: 'absent', label: 'Vắng', short: 'Vắng', code: 'V', title: 'Vắng không phép' },
  { key: 'excused', label: 'Có phép', short: 'Phép', code: 'P', title: 'Vắng có phép' },
];
const ST = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const ddmy = (d) => d.split('-').reverse().join('/');
const nameOf = (s) => (s.saint_name ? s.saint_name + ' ' : '') + s.full_name;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Khoảng tuần (CN -> T7) và tháng của một ngày
function weekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d); start.setDate(d.getDate() - d.getDay()); // Chủ nhật
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { from: ymd(start), to: ymd(end) };
}
function monthRange(dateStr) {
  const from = dateStr.slice(0, 8) + '01';
  const d = new Date(dateStr + 'T00:00:00');
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: ymd(last) };
}

/* Tự lưu: gom thay đổi, lưu sau ~0,8 giây; đổi lớp/ngày hoặc rời trang thì lưu ngay phần đang chờ. */
function useAutoSave(saveFn, key, paused) {
  const [st, setSt] = useState({ s: 'idle', at: null });
  const timer = useRef(null);
  const pending = useRef(null);
  const failed = useRef(null);
  const busy = useRef(false);
  const chain = useRef(Promise.resolve());
  const keyRef = useRef(key);
  const fnRef = useRef(saveFn);
  fnRef.current = saveFn;

  function run(payload) {
    const k = keyRef.current;
    chain.current = chain.current.then(async () => {
      busy.current = true;
      if (keyRef.current === k) setSt((x) => ({ ...x, s: 'saving' }));
      try {
        await fnRef.current(payload);
        failed.current = null;
        if (keyRef.current === k) setSt({ s: 'saved', at: new Date() });
      } catch (e) {
        failed.current = payload;
        if (keyRef.current === k) setSt({ s: 'error', at: null });
        toast.err('Chưa lưu được điểm danh. Kiểm tra kết nối rồi bấm "Thử lại".');
      } finally { busy.current = false; }
    });
  }
  function flush() {
    clearTimeout(timer.current);
    if (pending.current) { const p = pending.current; pending.current = null; run(p); }
  }
  function schedule(payload) {
    if (paused) return;
    pending.current = payload;
    setSt((x) => ({ ...x, s: 'pending' }));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }
  const retry = () => { if (failed.current) run(failed.current); };
  // Đổi lớp/ngày: lưu ngay phần đang chờ của lớp/ngày cũ rồi mới chuyển
  useEffect(() => { keyRef.current = key; setSt({ s: 'idle', at: null }); return () => flush(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Rời trang khi còn thay đổi chưa lưu: trình duyệt hỏi lại
  useEffect(() => {
    const h = (e) => { if (pending.current || busy.current || failed.current) { flush(); e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { st, schedule, retry };
}

function SaveStatus({ st, onRetry, practicing, idleText }) {
  if (practicing) return <span className="atx-save warn">Đang làm bài tập: thay đổi trên trang này không được lưu</span>;
  if (st.s === 'error') return <span className="atx-save err">Chưa lưu được <button type="button" className="atx-link" onClick={onRetry}>Thử lại</button></span>;
  if (st.s === 'pending' || st.s === 'saving') return <span className="atx-save">Đang lưu…</span>;
  if (st.s === 'saved') return <span className="atx-save ok">Đã lưu lúc {hhmm(st.at)}</span>;
  return <span className="atx-save">{idleText}</span>;
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
  const [mode, setMode] = useState('day'); // day (điểm danh) | week | month (thống kê)
  const [parish, setParish] = useState(null);
  const [report, setReport] = useState(false); // modal xuất báo cáo tổng hợp

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);
  // Mở trang là chọn sẵn lớp (lớp đã chọn lần trước, hoặc lớp đầu tiên).
  useEffect(() => { if (!classId && classes.length) setClassId(pickClass(classes)); }, [classes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rememberClass(classId); }, [classId]);
  const cls = classes.find((c) => c.id === classId) || {};
  const className = cls.name || '';
  const range = mode === 'week' ? weekRange(date) : mode === 'month' ? monthRange(date) : null;
  const isToday = date === today();

  return (
    <div>
      <PageHeader title="Điểm danh" subtitle="Ghi nhận có mặt, đi trễ, vắng của từng buổi học và việc thiêng liêng.">
        <div className="seg">
          <button className={tab === 'giaoly' ? 'on' : ''} onClick={() => setTab('giaoly')}>Giáo lý</button>
          <button className={tab === 'thieng' ? 'on' : ''} onClick={() => setTab('thieng')}>Việc thiêng liêng</button>
        </div>
      </PageHeader>

      <div className="toolbar atx-toolbar">
        <select data-tour="att-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="atx-class">
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="atx-datenav" data-tour="att-date">
          <button type="button" className="atx-step" onClick={() => setDate(addDays(date, -7))} title="Lùi 1 tuần" aria-label="Lùi 1 tuần">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ngày điểm danh" />
          <button type="button" className="atx-step" onClick={() => setDate(addDays(date, 7))} title="Tiến 1 tuần" aria-label="Tiến 1 tuần">›</button>
          {!isToday && <button type="button" className="btn ghost sm" onClick={() => setDate(today())}>Hôm nay</button>}
        </div>
        <div className="seg sm atx-view" role="group" aria-label="Chế độ xem">
          <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>Điểm danh</button>
          <button className={mode !== 'day' ? 'on' : ''} onClick={() => mode === 'day' && setMode('week')}>Thống kê</button>
        </div>
        <button className="btn ghost atx-report" disabled={!classId} onClick={() => setReport(true)}><IconDownload className="bi" />Xuất báo cáo</button>
      </div>

      {report && <ReportModal classId={classId} cls={cls} parish={parish} defaultRange={range || { from: date, to: date }} onClose={() => setReport(false)} />}

      {!classId ? (
        <div className="panel"><p className="muted">{classes.length ? 'Hãy chọn lớp để điểm danh.' : 'Chưa có lớp nào. Vào mục Lớp học để tạo lớp trước.'}</p></div>
      ) : mode === 'day' ? (
        tab === 'giaoly'
          ? <GiaoLyDay classId={classId} date={date} />
          : <ThiengDay classId={classId} date={date} />
      ) : (
        <div className="panel">
          <div className="stats-bar atx-statsbar">
            <div className="seg sm" role="group" aria-label="Khoảng thống kê">
              <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>Tuần</button>
              <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Tháng</button>
            </div>
            <span className="muted">{mode === 'week' ? 'Tuần' : 'Tháng'} {ddmm(range.from)} đến {ddmm(range.to)}</span>
          </div>
          {tab === 'giaoly'
            ? <GiaoLyStats classId={classId} range={range} />
            : <ThiengStats classId={classId} range={range} />}
        </div>
      )}
    </div>
  );
}

/* ---------------- GIÁO LÝ: điểm danh theo ngày (tự lưu) ---------------- */
function GiaoLyDay({ classId, date }) {
  const [rows, setRows] = useState([]);
  const [loadedKey, setLoadedKey] = useState(''); // lớp + ngày đã tải xong
  const key = `${classId}|${date}`;
  const tour = useActiveTour();
  const practicing = !!tour;
  const { st, schedule, retry } = useAutoSave(
    (p) => api.post('/attendance', { date: p.date, records: p.rows.map((r) => ({ student_id: r.id, status: r.status || null, note: r.note || '' })) }),
    key, practicing,
  );
  function load() {
    api.get(`/attendance?class_id=${classId}&date=${date}`).then((r) => { setRows(r.data); setLoadedKey(key); });
  }
  useEffect(load, [classId, date]); // eslint-disable-line react-hooks/exhaustive-deps
  // Hết bài tập: bỏ các thay đổi khi tập, tải lại dữ liệu thật
  const wasPracticing = useRef(practicing);
  useEffect(() => { if (wasPracticing.current && !practicing) load(); wasPracticing.current = practicing; }, [practicing]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(fn) {
    setRows((rs) => { const next = fn(rs); schedule({ date, rows: next }); return next; });
  }
  const setStatus = (id, status) => update((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  const setRowNote = (id, note) => update((rs) => rs.map((r) => (r.id === id ? { ...r, note } : r)));
  const allPresent = rows.length > 0 && rows.every((r) => r.status === 'present');
  async function markAll() {
    if (allPresent) {
      if (!(await confirmDialog('Bỏ đánh dấu cả lớp? Điểm danh ngày này của cả lớp sẽ bị xóa.'))) return;
      update((rs) => rs.map((r) => ({ ...r, status: null })));
    } else {
      update((rs) => rs.map((r) => ({ ...r, status: r.status || 'present' })));
    }
  }
  const count = (k) => rows.filter((r) => (r.status || null) === k).length;
  const notYet = count(null);

  if (loadedKey !== key) return <div className="panel"><SkeletonTable rows={6} cols={3} /></div>;
  if (rows.length === 0) return <div className="panel"><p className="muted">Lớp chưa có học viên.</p></div>;
  return (
    <div className="panel atx-panel">
      <div className="atx-head">
        <div className="atx-day"><b>{weekdayOf(date)}, {ddmy(date)}</b><span className="muted"> · Sĩ số {rows.length}</span></div>
        <div data-tour="att-summary" className="atx-sum">
          {STATUSES.map((s) => <span key={s.key} className={`atx-chip ${s.key}`} title={s.title}>{s.label} <b>{count(s.key)}</b></span>)}
          <span className={`atx-chip none${notYet ? ' warn' : ''}`}>Chưa điểm danh <b>{notYet}</b></span>
        </div>
      </div>
      {(allPresent || notYet > 0) && (
        <div className="atx-actions">
          <button className="btn ghost sm" onClick={markAll}>
            {allPresent ? 'Bỏ đánh dấu cả lớp' : notYet === rows.length ? 'Đánh dấu tất cả có mặt' : `Các em còn lại có mặt (${notYet})`}
          </button>
        </div>
      )}
      <div className="atx-list" data-tour="att-status">
        {rows.map((r) => (
          <div className={`atx-row${r.status ? ' ' + r.status : ''}`} key={r.id}>
            <div className="atx-who">
              <Avatar url={r.avatar_url} name={r.full_name} size={30} />
              <span className="atx-name">{r.saint_name && <small>{r.saint_name}</small>}<span>{r.full_name}</span></span>
            </div>
            <div className="atx-btns" role="group" aria-label={`Trạng thái của ${r.full_name}`}>
              {STATUSES.map((s) => (
                <button key={s.key} type="button" title={s.title} aria-pressed={r.status === s.key}
                  className={`atx-btn ${s.key}${r.status === s.key ? ' on' : ''}`}
                  onClick={() => setStatus(r.id, r.status === s.key ? null : s.key)}>
                  <span className="lg">{s.label}</span><span className="sm">{s.short}</span>
                </button>
              ))}
            </div>
            {r.status === 'excused' && (
              <input className="atx-note" value={r.note || ''} onChange={(e) => setRowNote(r.id, e.target.value)} placeholder="Lý do nghỉ phép (không bắt buộc)" />
            )}
          </div>
        ))}
      </div>
      <div className="atx-savebar" data-tour="att-save">
        <SaveStatus st={st} onRetry={retry} practicing={practicing} idleText="Bấm chọn trạng thái, điểm danh tự lưu" />
      </div>
    </div>
  );
}

/* ---------------- GIÁO LÝ: thống kê tuần/tháng ---------------- */
function GiaoLyStats({ classId, range }) {
  const [data, setData] = useState(null);
  const [byDiligence, setByDiligence] = useState(false);
  useEffect(() => {
    setData(null);
    api.get(`/attendance-range?class_id=${classId}&from=${range.from}&to=${range.to}`).then((r) => setData(r.data));
  }, [classId, range.from, range.to]);
  if (!data) return <SkeletonTable rows={5} cols={4} />;

  const total = data.dates.length;
  // Vắng có phép (excused) không tính vào tỷ lệ chuyên cần
  const rateA = (s) => { const c = s.present + s.absent + s.late; return c ? s.present / c : 0; };
  const pct = (s) => { const c = s.present + s.absent + s.late; return c ? Math.round((100 * s.present) / c) : null; };
  const students = [...data.students].sort((a, b) => (byDiligence ? rateA(b) - rateA(a) || byViName(a, b) : byViName(a, b)));
  const avgRate = data.students.length ? Math.round((100 * data.students.reduce((a, s) => a + rateA(s), 0)) / data.students.length) : 0;
  const diligent = [...data.students].filter((s) => rateA(s) >= 0.8).sort((a, b) => b.present - a.present)
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${s.present}/${total}` }));
  const remind = [...data.students].filter((s) => rateA(s) < 0.5).sort((a, b) => b.absent - a.absent)
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `vắng ${s.absent}/${total}` }));

  if (total === 0) return <p className="muted">Chưa có buổi điểm danh nào trong khoảng này.</p>;
  return (
    <>
      <div className="stat-cards">
        <div className="stat-mini"><div className="lbl">Buổi đã điểm danh</div><div className="num">{total}</div></div>
        <div className="stat-mini"><div className="lbl">Tỷ lệ đi học trung bình</div><div className="num">{avgRate}%</div></div>
        <div className="stat-mini"><div className="lbl">Sĩ số</div><div className="num">{data.students.length}</div></div>
      </div>
      <div className="rank-grid">
        <RankList title="Chuyên cần (đi học từ 80%)" tone="good" rows={diligent} emptyText="Chưa có em nào đạt từ 80%" />
        <RankList title="Cần nhắc nhở (đi học dưới 50%)" tone="warn" rows={remind} emptyText="Không có em nào cần nhắc" />
      </div>
      <div className="atx-gridbar">
        <div className="atx-legend">{STATUSES.map((s) => <span key={s.key}><i className={`atx-code ${s.key}`}>{s.code}</i>{s.title}</span>)}</div>
        <label className="fp-chk"><input type="checkbox" checked={byDiligence} onChange={(e) => setByDiligence(e.target.checked)} /><span>Xếp theo chuyên cần</span></label>
      </div>
      <div className="table-scroll">
        <table className="grid-att atx-grid">
          <thead>
            <tr><th className="sticky-col">Học viên</th>{data.dates.map((d) => <th key={d} className="col-day">{ddmm(d)}</th>)}<th>Có mặt</th><th>Tỷ lệ</th></tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const p = pct(s);
              return (
                <tr key={s.id}>
                  <td className="sticky-col"><span className="atx-name">{s.saint_name && <small>{s.saint_name}</small>}<span>{s.full_name}</span></span></td>
                  {data.dates.map((d) => (
                    <td key={d} className="col-day">
                      {s.byDate[d] ? <i className={`atx-code ${s.byDate[d]}`} title={ST[s.byDate[d]]?.title}>{ST[s.byDate[d]]?.code}</i> : <span className="atx-dot">·</span>}
                    </td>
                  ))}
                  <td><b>{s.present}</b><span className="muted">/{total}</span></td>
                  <td className={p != null && p < 50 ? 'atx-low' : ''}>{p == null ? <span className="atx-dot">·</span> : `${p}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- VIỆC THIÊNG LIÊNG: theo ngày (tự lưu) ---------------- */
function ThiengDay({ classId, date }) {
  const [tasks, setTasks] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [recorded, setRecorded] = useState(false); // ngày này đã có ghi nhận chưa
  const [gear, setGear] = useState(false);
  const key = `${classId}|${date}`;
  const tour = useActiveTour();
  const practicing = !!tour;
  const { st, schedule, retry } = useAutoSave(async (p) => {
    const records = [];
    p.rows.forEach((r) => p.tasks.forEach((t) => records.push({ student_id: r.id, task_id: t.id, done: !!r.done[t.id] })));
    await api.post('/spiritual', { date: p.date, records });
  }, key, practicing);

  function loadTasks() { api.get('/spiritual-tasks').then((r) => setTasks(r.data)).catch(() => setTasks([])); }
  function load() {
    api.get(`/spiritual?class_id=${classId}&date=${date}`).then((r) => {
      setRows(r.data); setLoadedKey(key);
      setRecorded((r.data || []).some((x) => Object.keys(x.done || {}).length > 0));
    });
  }
  useEffect(() => { loadTasks(); }, []);
  useEffect(load, [classId, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const wasPracticing = useRef(practicing);
  useEffect(() => { if (wasPracticing.current && !practicing) load(); wasPracticing.current = practicing; }, [practicing]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(fn) {
    setRows((rs) => { const next = fn(rs); schedule({ date, tasks: tasks || [], rows: next }); return next; });
    if (!practicing) setRecorded(true);
  }
  const toggle = (sid, tid) => update((rs) => rs.map((r) => (r.id === sid ? { ...r, done: { ...r.done, [tid]: !r.done[tid] } } : r)));
  const colAll = (tid) => rows.length > 0 && rows.every((r) => r.done[tid]);
  const toggleCol = (tid) => { const v = !colAll(tid); update((rs) => rs.map((r) => ({ ...r, done: { ...r.done, [tid]: v } }))); };

  if (tasks === null || loadedKey !== key) return <div className="panel"><SkeletonTable rows={6} cols={3} /></div>;
  return (
    <div className="panel atx-panel">
      <div className="atx-head">
        <div className="atx-day"><b>{weekdayOf(date)}, {ddmy(date)}</b>
          {tasks.length > 0 && rows.length > 0 && <span className={`atx-rec${recorded ? ' ok' : ''}`}>{recorded ? 'Đã ghi nhận' : 'Chưa ghi nhận ngày này'}</span>}
        </div>
        <button className="btn ghost sm" onClick={() => setGear(true)}><IconSliders className="bi" />Quản lý việc</button>
      </div>
      {tasks.length === 0 ? (
        <p className="muted">Chưa có việc thiêng liêng nào. Bấm "Quản lý việc" để thêm (Dự lễ, Đọc kinh…).</p>
      ) : rows.length === 0 ? (
        <p className="muted">Lớp chưa có học viên.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="atx-tl">
              <thead>
                <tr>
                  <th className="sticky-col">Học viên</th>
                  {tasks.map((t) => (
                    <th key={t.id}>
                      <label className="atx-colhead" title={`Đánh dấu "${t.name}" cho cả lớp`}>
                        <input type="checkbox" className="big-check" checked={colAll(t.id)} onChange={() => toggleCol(t.id)} />
                        <span>{t.name}</span>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sticky-col"><span className="atx-name">{r.saint_name && <small>{r.saint_name}</small>}<span>{r.full_name}</span></span></td>
                    {tasks.map((t) => (
                      <td key={t.id}>
                        <input type="checkbox" className="big-check" checked={!!r.done[t.id]} onChange={() => toggle(r.id, t.id)} aria-label={`${t.name}: ${r.full_name}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="atx-savebar">
            <SaveStatus st={st} onRetry={retry} practicing={practicing} idleText="Tích ô việc đã làm, tự lưu. Tích ô ở tiêu đề để chọn cả lớp." />
          </div>
        </>
      )}
      {gear && <TaskManager tasks={tasks} onChange={loadTasks} onClose={() => setGear(false)} />}
    </div>
  );
}

/* Danh mục việc thiêng liêng: dùng chung cả giáo xứ (quản trị viên và giáo lý viên đều chỉnh được) */
function TaskManager({ tasks, onChange, onClose }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try { await api.post('/spiritual-tasks', { name: n, order_index: tasks.length }); setName(''); onChange(); toast(`Đã thêm "${n}"`); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa thêm được'); }
    finally { setBusy(false); }
  }
  async function rename(t, input) {
    const n = input.value.trim();
    if (n === t.name) return;
    if (!n) { input.value = t.name; toast.err('Tên việc không được để trống'); return; }
    try { await api.put(`/spiritual-tasks/${t.id}`, { name: n }); onChange(); toast('Đã đổi tên'); }
    catch (err) { input.value = t.name; toast.err(err.response?.data?.error || 'Chưa đổi được tên'); }
  }
  async function del(t) {
    if (!(await confirmDialog(`Xóa việc "${t.name}"?\n\nViệc này dùng chung cho MỌI LỚP trong giáo xứ. Xóa sẽ mất toàn bộ dữ liệu đã ghi nhận của việc này ở tất cả các lớp.`))) return;
    try { await api.delete(`/spiritual-tasks/${t.id}`); onChange(); toast(`Đã xóa "${t.name}"`); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa xóa được'); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="atxTaskT">
        <h2 id="atxTaskT">Việc thiêng liêng của giáo xứ</h2>
        <p className="muted atx-tm-sub">Danh sách dùng chung cho mọi lớp trong giáo xứ. Sửa tên rồi bấm ra ngoài là tự lưu.</p>
        <div className="atx-tm-list">
          {tasks.map((t) => (
            <div className="atx-tm-row" key={t.id}>
              <input defaultValue={t.name} aria-label="Tên việc" onBlur={(e) => rename(t, e.target)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              <button type="button" className="atx-del" onClick={() => del(t)} title={`Xóa "${t.name}"`} aria-label={`Xóa ${t.name}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
            </div>
          ))}
          {tasks.length === 0 && <p className="muted" style={{ margin: '4px 0' }}>Chưa có việc nào.</p>}
        </div>
        <form className="atx-tm-add" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Dự lễ Chúa nhật, Đọc kinh, Xưng tội" aria-label="Tên việc thiêng liêng" />
          <button className="btn" type="submit" disabled={busy || !name.trim()}>{busy ? 'Đang thêm…' : 'Thêm'}</button>
        </form>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Xong</button></div>
      </div>
    </div>
  );
}

/* ---------------- VIỆC THIÊNG LIÊNG: thống kê tuần/tháng ---------------- */
function ThiengStats({ classId, range }) {
  const [tasks, setTasks] = useState([]);
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/spiritual-tasks').then((r) => setTasks(r.data)); }, []);
  useEffect(() => {
    setData(null);
    api.get(`/spiritual-range?class_id=${classId}&from=${range.from}&to=${range.to}`).then((r) => setData(r.data));
  }, [classId, range.from, range.to]);
  if (!data) return <SkeletonTable rows={5} cols={4} />;

  const total = data.dates.length;
  const students = [...data.students].sort((a, b) => byViName(a, b));
  const totalPossible = total * tasks.length;
  const doneOf = (s) => tasks.reduce((a, t) => a + (s.counts[t.id] || 0), 0);
  const rateT = (s) => (totalPossible ? doneOf(s) / totalPossible : 0);
  const siengNang = [...data.students].filter((s) => rateT(s) >= 0.8).sort((a, b) => doneOf(b) - doneOf(a))
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${doneOf(s)}/${totalPossible}` }));
  const canNhac = [...data.students].filter((s) => rateT(s) < 0.5).sort((a, b) => doneOf(a) - doneOf(b))
    .slice(0, 5).map((s) => ({ name: nameOf(s), detail: `${doneOf(s)}/${totalPossible}` }));

  if (tasks.length === 0) return <p className="muted">Chưa có việc thiêng liêng nào.</p>;
  if (total === 0) return <p className="muted">Chưa có ngày nào ghi nhận việc thiêng liêng trong khoảng này.</p>;
  return (
    <>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>{total} ngày có ghi nhận</p>
      <div className="rank-grid">
        <RankList title="Siêng năng (làm từ 80%)" tone="good" rows={siengNang} emptyText="Chưa có em nào đạt từ 80%" />
        <RankList title="Cần nhắc nhở (làm dưới 50%)" tone="warn" rows={canNhac} emptyText="Không có em nào cần nhắc" />
      </div>
      <div className="table-scroll">
        <table className="atx-tl">
          <thead><tr><th className="sticky-col">Học viên</th>{tasks.map((t) => <th key={t.id}>{t.name}</th>)}<th>Tỷ lệ</th></tr></thead>
          <tbody>
            {students.map((s) => {
              const p = totalPossible ? Math.round(100 * rateT(s)) : null;
              return (
                <tr key={s.id}>
                  <td className="sticky-col"><span className="atx-name">{s.saint_name && <small>{s.saint_name}</small>}<span>{s.full_name}</span></span></td>
                  {tasks.map((t) => <td key={t.id}><b>{s.counts[t.id] || 0}</b><span className="muted">/{total}</span></td>)}
                  <td className={p != null && p < 50 ? 'atx-low' : ''}>{p == null ? '' : `${p}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- XUẤT BÁO CÁO TỔNG HỢP (Giáo lý + Việc Thiêng liêng) ---------------- */
const GLCODE = { present: '+', late: 'T', absent: 'V', excused: 'P' };

function ReportModal({ classId, cls, parish, defaultRange, onClose }) {
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [wantGL, setWantGL] = useState(true);
  const [wantTL, setWantTL] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function buildAndExport(kind) {
    if (!wantGL && !wantTL) { setErr('Hãy chọn ít nhất một loại báo cáo.'); return; }
    if (from > to) { setErr('“Từ ngày” phải trước hoặc bằng “Đến ngày”.'); return; }
    setBusy(true); setErr('');
    try {
      const className = cls?.name || '';
      const kyBaoCao = `Kỳ báo cáo: ${ddmy(from)} - ${ddmy(to)}`;
      const lead = [
        STT_COL,
        { label: 'Tên thánh', get: (r) => r.saint_name || '', width: 14 },
        { label: 'Họ và tên', get: (r) => r.full_name, width: 22 },
      ];

      let gl = null, tl = null;
      if (wantGL) {
        const { data } = await api.get(`/attendance-range?class_id=${classId}&from=${from}&to=${to}`);
        const cols = [
          ...data.dates.map((d) => ({ label: ddmm(d), get: (r) => GLCODE[r.byDate?.[d]] || '', width: 6 })),
          { label: 'Có mặt', get: (r) => r.present ?? 0, width: 8 },
          { label: 'Trễ', get: (r) => r.late ?? 0, width: 6 },
          { label: 'Vắng KP', get: (r) => r.absent ?? 0, width: 8 },
          { label: 'Vắng CP', get: (r) => r.excused ?? 0, width: 8 },
          { label: 'Tỷ lệ đi học', get: (r) => { const c = (r.present || 0) + (r.late || 0) + (r.absent || 0); return c ? Math.round((100 * (r.present || 0)) / c) + '%' : '—'; }, width: 12 },
        ];
        gl = { data, cols, extra: [`Số buổi đã điểm danh: ${data.dates.length}`, 'Chú thích: + Có mặt, T Trễ, V Vắng không phép, P Vắng có phép'] };
      }
      if (wantTL) {
        const [tRes, dRes] = await Promise.all([
          api.get('/spiritual-tasks'),
          api.get(`/spiritual-range?class_id=${classId}&from=${from}&to=${to}`),
        ]);
        const tasks = tRes.data;
        const data = dRes.data;
        const totalPossible = data.dates.length * tasks.length;
        const doneOf = (r) => tasks.reduce((a, t) => a + (r.counts?.[t.id] || 0), 0);
        const cols = [
          ...tasks.map((t) => ({ label: t.name, get: (r) => r.counts?.[t.id] || 0, width: 10 })),
          { label: 'Tổng TThL', get: (r) => doneOf(r), width: 10 },
          { label: 'Tỷ lệ TThL', get: (r) => (totalPossible ? Math.round((100 * doneOf(r)) / totalPossible) + '%' : '—'), width: 10 },
        ];
        tl = { data, cols, extra: [`Số ngày ghi nhận việc thiêng liêng: ${data.dates.length}`, `Số việc thiêng liêng: ${tasks.length}`] };
      }

      const glRows = gl?.data.students || [];
      const tlRows = tl?.data.students || [];
      if (!glRows.length && !tlRows.length) { setErr('Lớp chưa có học viên để xuất.'); setBusy(false); return; }

      const subOf = (parts) => exportSubtitle({ parish, cls, extra: [kyBaoCao, ...parts] });
      const fname = `bao-cao-${fileSlug(className) || 'lop'}-${from}_${to}`;

      if (kind === 'xlsx') {
        let sheet;
        if (gl && tl) {
          // Gộp Giáo lý + Việc Thiêng liêng vào MỘT bảng: mỗi học viên một dòng đủ thông tin.
          const byId = {};
          glRows.forEach((s) => { byId[s.id] = { ...s, counts: {} }; });
          tlRows.forEach((s) => {
            byId[s.id] = { ...(byId[s.id] || { id: s.id, saint_name: s.saint_name, full_name: s.full_name, byDate: {}, present: 0, late: 0, absent: 0, excused: 0 }), counts: s.counts };
          });
          const order = glRows.length ? glRows : tlRows;
          const rows = order.map((s) => byId[s.id]);
          sheet = { name: 'Báo cáo', title: 'BÁO CÁO ĐIỂM DANH GIÁO LÝ & VIỆC THIÊNG LIÊNG', subtitle: subOf([...gl.extra, ...tl.extra]), columns: [...lead, ...gl.cols, ...tl.cols], rows };
        } else if (gl) {
          sheet = { name: 'Giáo lý', title: 'BÁO CÁO ĐIỂM DANH GIÁO LÝ', subtitle: subOf(gl.extra), columns: [...lead, ...gl.cols], rows: glRows };
        } else {
          sheet = { name: 'Việc thiêng liêng', title: 'BÁO CÁO VIỆC THIÊNG LIÊNG', subtitle: subOf(tl.extra), columns: [...lead, ...tl.cols], rows: tlRows };
        }
        exportXlsxMulti({ filename: `${fname}.xlsx`, sheets: [sheet] });
      } else {
        const sections = [];
        if (gl) sections.push({ heading: 'Điểm danh Giáo lý', subtitle: subOf(gl.extra), columns: [...lead, ...gl.cols], rows: glRows });
        if (tl) sections.push({ heading: 'Việc Thiêng liêng', subtitle: subOf(tl.extra), columns: [...lead, ...tl.cols], rows: tlRows });
        exportPdfMulti({ title: 'BÁO CÁO ĐIỂM DANH', sections });
      }
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Xuất báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Xuất báo cáo điểm danh</h2>
        <div className="row">
          <div className="field"><label>Từ ngày</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label>Đến ngày</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Nội dung báo cáo</label>
          <label className="fp-chk"><input type="checkbox" checked={wantGL} onChange={(e) => setWantGL(e.target.checked)} /><span>Giáo lý (đi học)</span></label>
          <label className="fp-chk"><input type="checkbox" checked={wantTL} onChange={(e) => setWantTL(e.target.checked)} /><span>Việc Thiêng liêng</span></label>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Chọn cả hai: Excel gộp chung một bảng (mỗi học viên một dòng đủ thông tin), PDF tách 2 mục.</p>
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn ghost" disabled={busy} onClick={() => buildAndExport('pdf')}><IconPrinter className="bi" />PDF</button>
          <button className="btn" disabled={busy} onClick={() => buildAndExport('xlsx')}>{busy ? 'Đang xuất...' : <><IconDownload className="bi" />Excel</>}</button>
        </div>
      </div>
    </div>
  );
}
