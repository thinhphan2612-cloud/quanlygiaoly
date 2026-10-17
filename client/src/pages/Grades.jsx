import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { isPro } from '../lib/plans';
import { byViName } from '../lib/viName';
import { exportXlsx, exportPdf, STT_COL, fileSlug, exportSubtitle } from '../lib/exportUtils';
import { IconDownload, IconPrinter, IconSliders } from '../components/Icons.jsx';
import { pickClass, rememberClass } from '../lib/lastClass';
import { toast } from '../lib/toast';
import { SkeletonTable } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import RowMenu from '../components/RowMenu.jsx';

const round1 = (n) => Math.round(n * 10) / 10;

// Điểm hợp lệ: số 0 đến 10, tối đa 2 chữ số thập phân, nhận cả dấu phẩy ("8,5").
// Trả về '' (ô trống), số, hoặc null nếu không hợp lệ.
function parseScore(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (s === '') return '';
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 10 ? n : null;
}
const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);

// Xếp loại theo điểm trung bình
const BANDS = [
  { key: 'gioi', label: 'Giỏi', tone: 'green', test: (a) => a >= 8 },
  { key: 'kha', label: 'Khá', tone: 'indigo', test: (a) => a >= 6.5 && a < 8 },
  { key: 'tb', label: 'Trung bình', tone: 'yellow', test: (a) => a >= 5 && a < 6.5 },
  { key: 'yeu', label: 'Yếu', tone: 'red', test: (a) => a < 5 },
];
const bandOf = (a) => (a == null ? null : BANDS.find((b) => b.test(a)));

// Tách phần "· dd/MM HH:mm(:ss)" ở cuối tên cột (đề thi) xuống dòng nhỏ cho gọn.
const COL_TIME_RE = /^(.*?)\s·\s(\d{2}\/\d{2}\s\d{2}:\d{2}(?::\d{2})?)$/;
function colTitle(name) {
  const m = String(name || '').match(COL_TIME_RE);
  if (!m) return name;
  return <>{m[1]}<span className="col-time">{m[2]}</span></>;
}
const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;

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
  const [loadedFor, setLoadedFor] = useState(''); // lớp đã tải xong dữ liệu điểm
  const [sortBy, setSortBy] = useState('name');   // name | rank
  const [band, setBand] = useState('');           // '' | gioi | kha | tb | yeu | missing
  const [mode, setMode] = useState(() => (isNarrow() ? 'col' : 'table')); // table | col (nhập theo cột)
  const [colSel, setColSel] = useState('');
  const [gear, setGear] = useState(false);
  const [cellState, setCellState] = useState({}); // { 'sid|cid': 'saving' | 'saved' | 'err' }
  const [parish, setParish] = useState(null);
  const saved = useRef({});                        // điểm đã lưu trên server, để chỉ ghi khi có thay đổi
  const gridRef = useRef(null);
  const isFree = !isPro(parish?.plan || 'free');

  const [searchParams] = useSearchParams();
  const isCurrent = !year || year === currentYear;
  useEffect(() => {
    Promise.all([
      api.get('/classes'),
      api.get('/archive-years').catch(() => ({ data: [] })),
      api.get('/parish').catch(() => ({ data: null })),
    ]).then(([c, ay, p]) => {
      setActiveClasses(c.data);
      setClasses(c.data);
      setParish(p.data);
      const activeYears = [...new Set(c.data.map((x) => x.year).filter(Boolean))];
      const cur = p.data?.settings?.current_school_year || activeYears[0] || '';
      setCurrentYear(cur);
      const list = [...new Set([cur, ...activeYears, ...(ay.data || []).map((y) => y.year)].filter(Boolean))].sort().reverse();
      setYearList(list);
      setYear(cur || list[0] || '');
    });
  }, []);
  useEffect(() => { const c = searchParams.get('class'); if (c) setClassId(c); }, [searchParams]);
  // đổi năm học -> đổi danh sách lớp
  useEffect(() => {
    if (!year) return;
    setClassId(''); setData({ students: [], columns: [], scores: {} });
    if (year === currentYear) setClasses(activeClasses);
    else api.get(`/archive-classes?year=${encodeURIComponent(year)}`).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [year, currentYear, activeClasses]);
  // Năm học hiện tại: mở trang là chọn sẵn lớp (lớp trên URL, lớp đã chọn lần trước, hoặc lớp đầu tiên).
  // Đặt SAU effect đổi năm ở trên: effect đó xóa lớp đang chọn, effect này chạy sau nên chọn lại được.
  useEffect(() => {
    if (!classId && isCurrent && classes.length) setClassId(pickClass(classes, searchParams.get('class')));
  }, [classes, isCurrent, year]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isCurrent) rememberClass(classId); }, [classId, isCurrent]);
  function load() {
    if (!classId) { setData({ students: [], columns: [], scores: {} }); return; }
    const url = isCurrent ? `/grades-class?class_id=${classId}` : `/archive-class?class_id=${classId}`;
    const forClass = classId;
    api.get(url).then((r) => {
      const d = r.data || { students: [], columns: [], scores: {} };
      saved.current = JSON.parse(JSON.stringify(d.scores || {}));
      setData(d); setLoadedFor(forClass);
    });
  }
  async function endYear() {
    const catechism = (classes || []).filter((c) => c.kind !== 'external');
    if (catechism.length && !catechism.some((c) => c.is_graduation)) {
      if (!await confirmDialog('Bạn CHƯA gắn nhãn "Lớp tốt nghiệp" cho lớp giáo lý nào.\n\nHệ thống sẽ tự lấy lớp bậc cao nhất làm lớp tốt nghiệp. Nên vào "Lớp học" → sửa lớp cao nhất → bật "Đây là lớp tốt nghiệp" để chính xác.\n\nVẫn tiếp tục?')) return;
    }
    if (!await confirmDialog(
      'KẾT THÚC NĂM HỌC & LÊN LỚP\n\n' +
      'Chỉ thực hiện khi TẤT CẢ các lớp đã được duyệt (GLV chốt lớp → Admin duyệt ở Tổng quan).\n\n' +
      'Hệ thống áp quyết định từng em: "lên lớp" chuyển lên bậc kế (điểm bắt đầu lại), "ở lại" giữ nguyên lớp năm sau. ' +
      'Học viên "lớp tốt nghiệp" được cho lên lớp sẽ ra trường.\n\n' +
      'Dữ liệu năm hiện tại được đóng băng, tra cứu ở tab "Lưu trữ".\n\nBạn chắc chắn?'
    )) return;
    try {
      const r = await api.post('/promote', {});
      toast(`Đã lên lớp ${r.data.promoted} học viên` + (r.data.stayed ? `, ${r.data.stayed} em ở lại` : '') + `, ${r.data.graduated} em ra trường.` + (r.data.new_year ? ` Năm học mới: ${r.data.new_year}.` : ''));
      setClassId('');
      api.get('/classes').then((res) => setClasses(res.data));
    } catch (e) { toast.err(e.response?.data?.error || 'Lên lớp thất bại'); }
  }
  useEffect(() => { load(); setBand(''); }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rev = useRealtime(['grades', 'grade_columns', 'students']);
  useEffect(() => {
    // không tải lại khi người dùng đang gõ điểm để tránh mất nội dung đang nhập
    if (rev && isCurrent && !document.activeElement?.classList?.contains('cell-input')) load();
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const { students, columns, scores } = data;
  useEffect(() => { if (!columns.some((c) => c.id === colSel)) setColSel(columns[0]?.id || ''); }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const cls = classes.find((c) => c.id === classId) || {};
  const className = cls.name || '';
  // Thông tin đầu bảng điểm khi xuất: giáo xứ, lớp, năm học, GV phụ trách
  const expSub = exportSubtitle({ parish, cls });

  function cellVal(sid, cid) { const v = scores[sid]?.[cid]; return v == null ? '' : v; }
  function setCell(sid, cid, val) {
    setData((d) => ({ ...d, scores: { ...d.scores, [sid]: { ...(d.scores[sid] || {}), [cid]: val } } }));
  }
  function markCell(key, st) {
    setCellState((m) => { const n = { ...m }; if (st) n[key] = st; else delete n[key]; return n; });
  }
  async function saveCell(sid, cid, raw) {
    const key = sid + '|' + cid;
    const prev = saved.current[sid]?.[cid];
    const v = parseScore(raw);
    if (v === null) {
      toast.err('Điểm phải là số từ 0 đến 10, ví dụ 8.5');
      setCell(sid, cid, prev == null ? '' : prev);
      return;
    }
    setCell(sid, cid, v);                              // chuẩn hóa "8,5" -> 8.5
    if (v === (prev == null ? '' : prev) && cellState[key] !== 'err') return; // không đổi -> không ghi
    markCell(key, 'saving');
    try {
      await api.post('/grade-cell', { student_id: sid, column_id: cid, score: v });
      const row = { ...(saved.current[sid] || {}) };
      if (v === '') delete row[cid]; else row[cid] = v;
      saved.current[sid] = row;
      markCell(key, 'saved');
      setTimeout(() => setCellState((m) => (m[key] === 'saved' ? (({ [key]: _, ...rest }) => rest)(m) : m)), 1200);
    } catch (e) {
      markCell(key, 'err');
      toast.err('Chưa lưu được điểm. Kiểm tra kết nối rồi sửa lại ô đang báo đỏ.');
    }
  }
  // Enter / mũi tên xuống: sang em kế tiếp cùng cột; Shift+Enter / mũi tên lên: em phía trên; Esc: bỏ sửa
  function onCellKey(e, row, col, sid, cid) {
    let next = null;
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'ArrowDown') next = row + 1;
    else if ((e.key === 'Enter' && e.shiftKey) || e.key === 'ArrowUp') next = row - 1;
    else if (e.key === 'Escape') {
      const prev = saved.current[sid]?.[cid];
      setCell(sid, cid, prev == null ? '' : prev);
      e.currentTarget.blur();
      return;
    } else return;
    e.preventDefault();
    const el = gridRef.current?.querySelector(`[data-cell="${next}-${col}"]`);
    if (el) { el.focus(); el.select(); } else e.currentTarget.blur();
  }

  function weightedAvg(sid) {
    let s = 0, sw = 0;
    columns.forEach((c) => {
      const v = parseScore(scores[sid]?.[c.id]);
      if (isNum(v)) { s += v * Number(c.weight); sw += Number(c.weight); }
    });
    return sw ? round1(s / sw) : null;
  }
  const scoreCount = (id) => columns.filter((c) => isNum(parseScore(scores[id]?.[c.id]))).length;

  // Xếp hạng theo TB, đồng điểm thì đồng hạng (1, 2, 2, 4)
  const withAvg = students.map((s) => ({ ...s, avg: weightedAvg(s.id) }));
  const rankOf = {};
  withAvg.forEach((s) => { rankOf[s.id] = s.avg == null ? null : 1 + withAvg.filter((o) => o.avg != null && o.avg > s.avg).length; });
  const ranked = [...withAvg].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || byViName(a, b));
  const ordered = sortBy === 'rank' ? ranked : [...withAvg].sort((a, b) => byViName(a, b));

  // Số liệu tổng hợp của lớp + lọc nhanh
  const avgs = withAvg.map((s) => s.avg).filter((a) => a != null);
  const classAvg = avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
  const bandCount = Object.fromEntries(BANDS.map((b) => [b.key, avgs.filter(b.test).length]));
  const missingCount = students.filter((s) => scoreCount(s.id) < columns.length).length;
  const display = ordered.filter((s) => {
    if (!band) return true;
    if (band === 'missing') return scoreCount(s.id) < columns.length;
    return bandOf(s.avg)?.key === band;
  });
  const curCol = columns.find((c) => c.id === colSel);

  // export
  function exportSheet(kind) {
    const cols = [
      STT_COL,
      { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
      { label: 'Họ và tên', get: (s) => s.full_name, width: 24 },
      ...columns.map((c) => ({ label: `${c.name}${Number(c.weight) !== 1 ? ` (x${c.weight})` : ''}`, get: (s) => cellVal(s.id, c.id), width: 10 })),
      { label: 'TB', get: (s) => s.avg ?? '', width: 8 },
      { label: 'Hạng', get: (s) => rankOf[s.id] ?? '', width: 7 },
    ];
    const meta = { title: 'Bảng điểm', subtitle: expSub, columns: cols, rows: display };
    if (kind === 'excel') exportXlsx({ filename: `bang-diem-${fileSlug(className)}.xlsx`, sheetName: 'Bảng điểm', ...meta });
    else exportPdf(meta);
  }

  const scoreInput = (s, c, row, col) => {
    const key = s.id + '|' + c.id;
    const st = cellState[key];
    return (
      <input
        className={`cell-input${st ? ' ' + st : ''}`}
        type="text" inputMode="decimal" autoComplete="off" placeholder="–"
        aria-label={`Điểm ${c.name} của ${s.full_name}`}
        data-cell={`${row}-${col}`}
        value={cellVal(s.id, c.id)}
        onChange={(e) => setCell(s.id, c.id, e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => saveCell(s.id, c.id, e.target.value)}
        onKeyDown={(e) => onCellKey(e, row, col, s.id, c.id)}
      />
    );
  };
  const readCell = (v) => (v === '' || v == null ? <span className="gx-empty">–</span> : <span>{v}</span>);
  const avgCell = (a) => {
    const b = bandOf(a);
    return a == null ? <span className="gx-empty">–</span> : <b className={`gx-avg${b ? ' ' + b.key : ''}`}>{a}</b>;
  };
  const nameCell = (s) => (
    <span className="gx-name">{s.saint_name && <small>{s.saint_name}</small>}<span>{s.full_name}</span></span>
  );

  const ready = classId && loadedFor === classId && columns.length > 0 && students.length > 0;

  return (
    <div>
      <PageHeader title="Điểm số" subtitle="Nhập điểm theo cột điểm của từng lớp, xem điểm trung bình và thứ hạng.">
        {isAdmin && isCurrent && !isFree && parish?.settings?.auto_promote !== false && (
          <span data-tour="grades-endyear" title="Thao tác cho cả giáo xứ">
            <RowMenu label="Thao tác cho cả giáo xứ" items={[{ label: 'Kết thúc năm học, lên lớp…', onClick: endYear }]} />
          </span>
        )}
      </PageHeader>

      <div className="toolbar gx-toolbar">
        {yearList.length > 1 && (
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 170 }}>
            {yearList.map((y) => <option key={y} value={y}>Năm {y}{y === currentYear ? ' (nay)' : ''}</option>)}
          </select>
        )}
        <select data-tour="grades-class" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 220 }}>
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classId && isCurrent && <button data-tour="grades-cols" className="btn ghost" onClick={() => setGear(true)}><IconSliders className="bi" />Cột điểm</button>}
        {classId && (
          <div className="gx-export">
            <button data-tour="grades-export" className="btn ghost" onClick={() => exportSheet('excel')} disabled={!ready}><IconDownload className="bi" />Excel</button>
            <button className="btn ghost" onClick={() => exportSheet('pdf')} disabled={!ready}><IconPrinter className="bi" />PDF</button>
          </div>
        )}
      </div>

      {!classId ? (
        <div className="panel"><p className="muted">Hãy chọn lớp để nhập điểm.</p></div>
      ) : loadedFor !== classId ? (
        <div className="panel"><SkeletonTable rows={6} cols={5} /></div>
      ) : columns.length === 0 ? (
        <div className="panel gx-emptybox">
          <p className="muted">{isCurrent ? 'Lớp chưa có cột điểm nào. Tạo các cột như "Kiểm tra 15 phút", "Thi học kỳ I" rồi nhập điểm.' : 'Lớp này không có cột điểm trong năm học đã chọn.'}</p>
          {isCurrent && <button className="btn" onClick={() => setGear(true)}><IconSliders className="bi" />Tạo cột điểm</button>}
        </div>
      ) : students.length === 0 ? (
        <div className="panel"><p className="muted">Lớp chưa có học viên.</p></div>
      ) : (
        <>
          <div className="gx-stats" role="group" aria-label="Tổng hợp và lọc nhanh">
            <button type="button" className={`gx-stat${band === '' ? ' on' : ''}`} onClick={() => setBand('')}><span>Sĩ số</span><b>{students.length}</b></button>
            <div className="gx-stat static"><span>TB lớp</span><b>{classAvg ?? '–'}</b></div>
            {BANDS.map((b) => (
              <button type="button" key={b.key} className={`gx-stat tone-${b.tone}${band === b.key ? ' on' : ''}`} onClick={() => setBand(band === b.key ? '' : b.key)}
                title={b.key === 'gioi' ? 'TB từ 8' : b.key === 'kha' ? 'TB từ 6.5 đến dưới 8' : b.key === 'tb' ? 'TB từ 5 đến dưới 6.5' : 'TB dưới 5'}>
                <span>{b.label}</span><b>{bandCount[b.key]}</b>
              </button>
            ))}
            <button type="button" className={`gx-stat tone-gray${band === 'missing' ? ' on' : ''}`} onClick={() => setBand(band === 'missing' ? '' : 'missing')} title="Học viên còn ô điểm trống">
              <span>Thiếu điểm</span><b>{missingCount}</b>
            </button>
          </div>

          <div className="gx-bar">
            <p className="muted gx-hint">
              {isCurrent
                ? <>Gõ điểm rồi bấm <kbd>Enter</kbd> để xuống em kế tiếp. Điểm tự lưu, nhận cả dấu phẩy (8,5).</>
                : `Đang xem điểm năm học ${year} (đã lưu trữ, chỉ đọc).`}
            </p>
            <div className="gx-ctrls">
              <div className="seg sm" role="group" aria-label="Sắp xếp">
                <button type="button" className={`seg-btn${sortBy === 'name' ? ' on' : ''}`} onClick={() => setSortBy('name')}>Theo tên</button>
                <button type="button" className={`seg-btn${sortBy === 'rank' ? ' on' : ''}`} onClick={() => setSortBy('rank')}>Theo hạng</button>
              </div>
              {isCurrent && (
                <div className="seg sm" role="group" aria-label="Cách nhập">
                  <button type="button" className={`seg-btn${mode === 'table' ? ' on' : ''}`} onClick={() => setMode('table')}>Bảng</button>
                  <button type="button" className={`seg-btn${mode === 'col' ? ' on' : ''}`} onClick={() => setMode('col')}>Nhập theo cột</button>
                </div>
              )}
            </div>
          </div>

          {display.length === 0 ? (
            <div className="panel"><p className="muted" style={{ margin: 0 }}>Không có học viên nào trong nhóm này. <button type="button" className="gx-link" onClick={() => setBand('')}>Bỏ lọc</button></p></div>
          ) : mode === 'col' && isCurrent ? (
            <div className="panel gx-colmode" ref={gridRef}>
              <div className="gx-colpick" role="tablist" aria-label="Chọn cột điểm">
                {columns.map((c) => {
                  const filled = students.filter((s) => isNum(parseScore(scores[s.id]?.[c.id]))).length;
                  return (
                    <button type="button" role="tab" aria-selected={c.id === colSel} key={c.id} className={`gx-colchip${c.id === colSel ? ' on' : ''}`} onClick={() => setColSel(c.id)}>
                      <span>{colTitle(c.name)}{Number(c.weight) !== 1 && <span className="wt">x{c.weight}</span>}</span>
                      <small>{filled}/{students.length}</small>
                    </button>
                  );
                })}
              </div>
              <div className="gx-list" data-tour="grades-table">
                {curCol && display.map((s, i) => (
                  <div className="gx-row" key={s.id}>
                    {nameCell(s)}
                    {scoreInput(s, curCol, i, 0)}
                    <span className="gx-row-avg">{avgCell(s.avg)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="panel gx-panel">
              <div className="table-scroll" ref={gridRef}>
                <table data-tour="grades-table" className="grade-table gx-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">Học viên</th>
                      {columns.map((c) => <th key={c.id} className="col-day">{colTitle(c.name)}{Number(c.weight) !== 1 && <span className="wt">x{c.weight}</span>}</th>)}
                      <th>TB</th><th>Hạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.map((s, i) => (
                      <tr key={s.id}>
                        <td className="sticky-col">{nameCell(s)}</td>
                        {columns.map((c, j) => (
                          <td key={c.id} className="col-day">{isCurrent ? scoreInput(s, c, i, j) : readCell(cellVal(s.id, c.id))}</td>
                        ))}
                        <td>{avgCell(s.avg)}</td>
                        <td>{rankOf[s.id] ? <span className="rank-chip">{rankOf[s.id]}</span> : <span className="gx-empty">–</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {gear && <ColumnManager classId={classId} columns={columns} onChange={load} onClose={() => setGear(false)} />}
    </div>
  );
}

/* ---------------- Quản lý cột điểm + hệ số ---------------- */
function ColumnManager({ classId, columns, onChange, onClose }) {
  const [list, setList] = useState(columns);
  const [nn, setNn] = useState({ name: '', weight: '1' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setList(columns); }, [columns]);
  const okWeight = (w) => { const n = Number(String(w).replace(',', '.')); return n > 0 && n <= 10 ? n : null; };

  async function add(e) {
    e.preventDefault();
    const name = nn.name.trim();
    if (!name) { toast.err('Nhập tên cột điểm'); return; }
    const w = okWeight(nn.weight);
    if (w == null) { toast.err('Hệ số phải là số lớn hơn 0, ví dụ 1 hoặc 2'); return; }
    setBusy(true);
    try {
      await api.post('/grade-columns', { class_id: classId, name, weight: w, order_index: list.length });
      setNn({ name: '', weight: '1' }); onChange(); toast(`Đã thêm cột "${name}"`);
    } catch (err) { toast.err(err.response?.data?.error || 'Chưa thêm được cột'); }
    finally { setBusy(false); }
  }
  async function saveCol(c, patch, input) {
    if (patch.name !== undefined && !patch.name.trim()) { toast.err('Tên cột không được để trống'); input.value = c.name; return; }
    if (patch.weight !== undefined) {
      const w = okWeight(patch.weight);
      if (w == null) { toast.err('Hệ số phải là số lớn hơn 0'); input.value = c.weight; return; }
      patch = { weight: w };
    }
    try { await api.put(`/grade-columns/${c.id}`, patch); onChange(); toast('Đã lưu'); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa lưu được'); }
  }
  async function del(c) {
    if (!(await confirmDialog(`Xóa cột "${c.name}"? Điểm của cả lớp ở cột này sẽ mất.`))) return;
    try { await api.delete(`/grade-columns/${c.id}`); onChange(); toast(`Đã xóa cột "${c.name}"`); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa xóa được cột'); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal gx-colmgr" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gxColT">
        <h2 id="gxColT">Cột điểm và hệ số</h2>
        <p className="muted gx-colmgr-sub">Hệ số dùng khi tính điểm trung bình: cột hệ số 2 được tính gấp đôi cột hệ số 1. Sửa tên hoặc hệ số rồi bấm ra ngoài là tự lưu.</p>
        <div className="gx-colmgr-list">
          {list.map((c) => (
            <div className="gx-colmgr-row" key={c.id}>
              <input defaultValue={c.name} aria-label="Tên cột điểm" onBlur={(e) => e.target.value !== c.name && saveCol(c, { name: e.target.value }, e.target)} />
              <label className="gx-w"><span>Hệ số</span>
                <input inputMode="decimal" defaultValue={c.weight} aria-label="Hệ số" onBlur={(e) => Number(e.target.value.replace(',', '.')) !== Number(c.weight) && saveCol(c, { weight: e.target.value }, e.target)} />
              </label>
              <button type="button" className="gx-del" onClick={() => del(c)} title={`Xóa cột "${c.name}"`} aria-label={`Xóa cột ${c.name}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
            </div>
          ))}
          {list.length === 0 && <p className="muted" style={{ margin: '4px 0' }}>Chưa có cột điểm nào.</p>}
        </div>
        <form className="gx-colmgr-add" onSubmit={add}>
          <div className="field"><label>Thêm cột điểm</label><input value={nn.name} onChange={(e) => setNn({ ...nn, name: e.target.value })} placeholder="VD: Kiểm tra 1 tiết" /></div>
          <div className="field gx-w-add"><label>Hệ số</label><input inputMode="decimal" value={nn.weight} onChange={(e) => setNn({ ...nn, weight: e.target.value })} /></div>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Đang thêm…' : 'Thêm cột'}</button>
        </form>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Xong</button></div>
      </div>
    </div>
  );
}
