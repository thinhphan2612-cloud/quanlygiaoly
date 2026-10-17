import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { exportXlsx, exportXlsxMulti, exportPdf, STT_COL, exportSubtitle, fileSlug } from '../lib/exportUtils';
import { IconDownload, IconGradCap, IconHome, IconPrinter } from '../components/Icons.jsx';
import { toast } from '../lib/toast';
import { viDate } from '../lib/date';
import PageHeader from '../components/PageHeader.jsx';

const NA = '–';
const ALL_TIME = 'from=2000-01-01&to=2099-12-31';
// Bỏ dấu để tìm kiếm
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const nameOf = (s) => [s.saint_name, s.full_name].filter(Boolean).join(' ');
// Điểm TB có hệ số của 1 học viên (giống trang Điểm số)
function avgOf(columns, rowScores) {
  let s = 0, w = 0;
  columns.forEach((c) => { const v = rowScores?.[c.id]; if (v !== undefined && v !== null && !Number.isNaN(Number(v))) { const wt = Number(c.weight) || 1; s += Number(v) * wt; w += wt; } });
  return w ? Math.round((s / w) * 10) / 10 : null;
}
// Chuyên cần = có mặt / (có mặt + trễ + vắng không phép), không tính có phép
const rateOf = (a) => { if (!a) return null; const c = a.present + a.late + a.absent; return c ? Math.round((100 * a.present) / c) : null; };
const DEC = { advance: ['Lên lớp', 'ok'], stay: ['Ở lại', 'bad'], pass: ['Đậu', 'ok'], fail: ['Không đạt', 'bad'] };

export default function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [years, setYears] = useState(null);
  const [open, setOpen] = useState(null);        // năm đang mở
  const [byYear, setByYear] = useState({});       // { year: [classes] | 'error' }
  const [detail, setDetail] = useState(null);     // { class, students, columns, scores, att, review }
  const [opening, setOpening] = useState('');
  const [parish, setParish] = useState(null);
  const [dl, setDl] = useState(null);             // { year, done, total } khi đang tải Excel cả năm
  const dlRef = useRef(false);
  const [grads, setGrads] = useState(null);
  const [gradYear, setGradYear] = useState('');
  const [gradKind, setGradKind] = useState('');
  const [gradResult, setGradResult] = useState('');
  const [gradSearch, setGradSearch] = useState('');
  const [gradPage, setGradPage] = useState(1);
  useEffect(() => { setGradPage(1); }, [gradYear, gradKind, gradResult, gradSearch]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/archive-years').then((r) => setYears(r.data)).catch(() => { setYears([]); toast.err('Không tải được danh sách năm học đã lưu trữ'); });
    api.get('/parish').then((r) => setParish(r.data)).catch(() => {});
    api.get('/graduates').then((r) => setGrads(r.data)).catch(() => { setGrads([]); toast.err('Không tải được danh sách học viên đã ra trường'); });
  }, [user]);

  const gradByYear = useMemo(() => {
    const m = {}; (grads || []).forEach((g) => { if (g.year) m[g.year] = (m[g.year] || 0) + 1; }); return m;
  }, [grads]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được truy cập lưu trữ.</div>;

  async function loadClasses(y) {
    const r = await api.get(`/archive-classes?year=${encodeURIComponent(y)}`);
    setByYear((m) => ({ ...m, [y]: r.data }));
    return r.data;
  }
  async function toggleYear(y) {
    if (open === y) { setOpen(null); return; }
    setOpen(y);
    if (!Array.isArray(byYear[y])) {
      try { await loadClasses(y); }
      catch { setByYear((m) => ({ ...m, [y]: 'error' })); toast.err(`Không tải được các lớp năm ${y}`); }
    }
  }

  async function openClass(c) {
    if (opening) return;
    setOpening(c.id);
    try {
      const [r, att, rev] = await Promise.all([
        api.get(`/archive-class?class_id=${c.id}`),
        api.get(`/attendance-range?class_id=${c.id}&${ALL_TIME}`).catch(() => ({ data: null })),
        api.get(`/class-review?class_id=${c.id}`).catch(() => ({ data: null })),
      ]);
      const attBy = {}; (att.data?.students || []).forEach((s) => { attBy[s.id] = s; });
      setDetail({ ...r.data, att: attBy, sessions: att.data?.dates?.length || 0, review: rev.data });
    } catch { toast.err(`Không mở được lớp ${c.name}`); }
    finally { setOpening(''); }
  }

  // Tải cả năm: Excel, mỗi lớp một sheet (điểm có hệ số + chuyên cần)
  async function downloadYear(y) {
    if (dlRef.current) return;
    dlRef.current = true;
    try {
      const cls = Array.isArray(byYear[y]) ? byYear[y] : await loadClasses(y);
      setDl({ year: y, done: 0, total: cls.length });
      const sheets = [];
      for (let i = 0; i < cls.length; i++) {
        const c = cls[i];
        const [r, att] = await Promise.all([
          api.get(`/archive-class?class_id=${c.id}`),
          api.get(`/attendance-range?class_id=${c.id}&${ALL_TIME}`).catch(() => ({ data: null })),
        ]);
        const { students, columns, scores } = r.data;
        const attBy = {}; (att.data?.students || []).forEach((s) => { attBy[s.id] = s; });
        sheets.push({
          name: c.name,
          title: `Bảng điểm: ${c.name}`,
          subtitle: exportSubtitle({ parish, cls: { name: c.name, year: y } }),
          columns: [
            STT_COL,
            { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
            { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
            ...columns.map((col) => ({ label: `${col.name}${Number(col.weight) !== 1 ? ` (x${col.weight})` : ''}`, get: (s) => scores[s.id]?.[col.id] ?? '', width: 10 })),
            { label: 'TB', get: (s) => avgOf(columns, scores[s.id]) ?? '', width: 8 },
            { label: 'Có mặt', get: (s) => attBy[s.id]?.present ?? '', width: 8 },
            { label: 'Vắng', get: (s) => attBy[s.id]?.absent ?? '', width: 7 },
            { label: 'Chuyên cần', get: (s) => { const v = rateOf(attBy[s.id]); return v == null ? '' : `${v}%`; }, width: 11 },
          ],
          rows: students,
        });
        setDl({ year: y, done: i + 1, total: cls.length });
      }
      if (sheets.length) { exportXlsxMulti({ filename: `luu-tru-${fileSlug(y)}.xlsx`, sheets }); toast(`Đã tải bảng điểm ${sheets.length} lớp năm ${y}`); }
      else toast.err('Năm này không có lớp nào');
    } catch { toast.err(`Tải file năm ${y} thất bại, thử lại sau`); }
    finally { dlRef.current = false; setDl(null); }
  }

  // ---- học viên đã ra trường ----
  const gradYears = [...new Set((grads || []).map((g) => g.year).filter(Boolean))].sort().reverse();
  const gq = fold(gradSearch.trim());
  const gradList = (grads || []).filter((g) =>
    (!gradYear || g.year === gradYear)
    && (!gradKind || (g.kind || 'catechism') === gradKind)
    && (!gradResult || (gradResult === 'pass' ? g.passed : !g.passed))
    && (!gq || fold(nameOf(g)).includes(gq)));
  const GRAD_PER_PAGE = 15;
  const gradPages = Math.max(1, Math.ceil(gradList.length / GRAD_PER_PAGE));
  const gradPageItems = gradList.slice((gradPage - 1) * GRAD_PER_PAGE, gradPage * GRAD_PER_PAGE);
  function exportGrads() {
    exportXlsx({
      filename: `hoc-vien-ra-truong${gradYear ? '-' + fileSlug(gradYear) : ''}.xlsx`, sheetName: 'Ra trường',
      title: 'DANH SÁCH HỌC VIÊN ĐÃ RA TRƯỜNG', subtitle: [parish?.name ? `Giáo xứ ${parish.name}` : '', gradYear ? `Niên khóa ${gradYear}` : 'Tất cả niên khóa'].filter(Boolean),
      columns: [
        STT_COL,
        { label: 'Tên thánh', get: (g) => g.saint_name || '', width: 14 },
        { label: 'Họ và tên', get: (g) => g.full_name, width: 24 },
        { label: 'Ngày sinh', get: (g) => (g.birth_date ? viDate(g.birth_date) : ''), width: 12 },
        { label: 'Niên khóa', get: (g) => g.year || '', width: 12 },
        { label: 'Lớp', get: (g) => g.class_name || '', width: 16 },
        { label: 'Loại lớp', get: (g) => (g.kind === 'external' ? 'Ngoại thường' : 'Trong năm'), width: 13 },
        { label: 'Kết quả', get: (g) => (g.passed ? 'Tốt nghiệp' : 'Không đạt'), width: 12 },
      ],
      rows: gradList,
    });
  }

  return (
    <div>
      <PageHeader title="Lưu trữ theo năm học" subtitle="Dữ liệu các năm đã kết thúc được giữ nguyên tại đây. Mở năm rồi chọn lớp để xem điểm số, điểm danh và kết quả cuối năm." />

      {years === null ? (
        <div className="panel muted">Đang tải…</div>
      ) : years.length === 0 ? (
        <div className="panel muted">Chưa có năm học nào được lưu trữ. Sau khi "Kết thúc năm học & lên lớp" ở Cài đặt, năm cũ sẽ hiện ở đây.</div>
      ) : (
        <div className="arx-years">
          {years.map((y) => {
            const isOpen = open === y.year;
            const cls = byYear[y.year];
            const busyY = dl?.year === y.year;
            return (
              <div className={`panel arx-year${isOpen ? ' open' : ''}`} key={y.year}>
                <div className="arx-yhead">
                  <button className="arx-ytoggle" onClick={() => toggleYear(y.year)} aria-expanded={isOpen}>
                    <svg className="arx-chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <b>Năm học {y.year}</b>
                    <span className="arx-ystats">
                      <span>{y.classes} lớp</span><span>{y.students} học viên</span>
                      {gradByYear[y.year] > 0 && <span>{gradByYear[y.year]} ra trường</span>}
                    </span>
                  </button>
                  <div className="arx-yact">
                    <button className="btn ghost sm" onClick={() => navigate(`/?year=${encodeURIComponent(y.year)}`)}><IconHome className="bi" />Tổng quan năm này</button>
                    <button className="btn ghost sm" onClick={() => downloadYear(y.year)} disabled={!!dl}>
                      <IconDownload className="bi" />{busyY ? `Đang chuẩn bị ${dl.done}/${dl.total || '…'} lớp` : 'Tải Excel cả năm'}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="arx-classes">
                    {cls === undefined && <div className="muted">Đang tải…</div>}
                    {cls === 'error' && <div className="muted">Không tải được. <button className="arx-link" onClick={() => { setByYear((m) => { const n = { ...m }; delete n[y.year]; return n; }); setOpen(null); setTimeout(() => toggleYear(y.year), 0); }}>Thử lại</button></div>}
                    {Array.isArray(cls) && cls.length === 0 && <div className="muted">Không có lớp.</div>}
                    {Array.isArray(cls) && cls.map((c) => (
                      <button className="arx-class" key={c.id} onClick={() => openClass(c)} disabled={!!opening}>
                        <span className="arx-cname">{c.name}{c.kind === 'external' && <small>Ngoại thường</small>}</span>
                        <span className="muted">{opening === c.id ? 'Đang mở…' : `${c.student_count} học viên`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="panel arx-grads">
        <div className="card-head arx-ghead">
          <h2 style={{ margin: 0 }}><IconGradCap className="h-ic" />Học viên đã ra trường {grads && `(${grads.length})`}</h2>
          <button className="btn ghost sm" onClick={exportGrads} disabled={!gradList.length}><IconDownload className="bi" />Excel</button>
        </div>
        {grads && grads.length > 0 && (
          <div className="arx-gfilters">
            <input type="search" placeholder="Tìm tên, không cần dấu" value={gradSearch} onChange={(e) => setGradSearch(e.target.value)} aria-label="Tìm học viên đã ra trường" />
            <select value={gradYear} onChange={(e) => setGradYear(e.target.value)} aria-label="Niên khóa">
              <option value="">Tất cả niên khóa</option>
              {gradYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={gradKind} onChange={(e) => setGradKind(e.target.value)} aria-label="Loại lớp">
              <option value="">Tất cả loại lớp</option>
              <option value="catechism">Lớp trong năm</option>
              <option value="external">Lớp ngoại thường</option>
            </select>
            <select value={gradResult} onChange={(e) => setGradResult(e.target.value)} aria-label="Kết quả">
              <option value="">Mọi kết quả</option>
              <option value="pass">Tốt nghiệp</option>
              <option value="fail">Không đạt</option>
            </select>
          </div>
        )}
        {grads === null ? (
          <p className="muted">Đang tải…</p>
        ) : grads.length === 0 ? (
          <p className="muted">Chưa có học viên nào ra trường. Sau khi "Kết thúc năm học & lên lớp", các em ở lớp cao nhất sẽ ra trường và hiện tại đây.</p>
        ) : gradList.length === 0 ? (
          <p className="muted">Không có học viên nào khớp bộ lọc.</p>
        ) : (
          <>
            <table className="arx-gtable">
              <thead><tr><th>Họ tên</th><th>Niên khóa</th><th>Lớp</th><th>Loại</th><th>Kết quả</th></tr></thead>
              <tbody>
                {gradPageItems.map((g) => (
                  <tr key={g.id}>
                    <td className="arx-c-name"><a className="link-name" href={`/students/${g.id}`} onClick={(e) => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); navigate(`/students/${g.id}`); } }}>{nameOf(g)}</a></td>
                    <td data-label="Niên khóa">{g.year || NA}</td>
                    <td data-label="Lớp">{g.class_name || NA}</td>
                    <td data-label="Loại" className="muted">{g.kind === 'external' ? 'Ngoại thường' : 'Trong năm'}</td>
                    <td className="arx-c-res">{g.passed ? <span className="arx-tag ok">Tốt nghiệp</span> : <span className="arx-tag bad">Không đạt</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gradPages > 1 && (
              <div className="pager">
                <button className="btn ghost sm" disabled={gradPage <= 1} onClick={() => setGradPage((p) => p - 1)}>← Trước</button>
                <span className="muted" style={{ fontSize: 13 }}>Trang {gradPage}/{gradPages} · {gradList.length} em</span>
                <button className="btn ghost sm" disabled={gradPage >= gradPages} onClick={() => setGradPage((p) => p + 1)}>Sau →</button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && <ClassArchive detail={detail} parish={parish} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ---------------- Hộp lớp năm cũ: Điểm số / Điểm danh / Kết quả cuối năm ---------------- */
function ClassArchive({ detail, parish, onClose }) {
  const [tab, setTab] = useState('grades');
  const [q, setQ] = useState('');
  const cols = detail.columns || [];
  const students = detail.students || [];
  const fq = fold(q.trim());
  const shown = students.filter((s) => !fq || fold(nameOf(s)).includes(fq));
  const avgs = students.map((s) => avgOf(cols, detail.scores[s.id])).filter((v) => v != null);
  const classAvg = avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null;
  let p = 0, t = 0; students.forEach((s) => { const a = detail.att[s.id]; if (a) { p += a.present; t += a.present + a.late + a.absent; } });
  const classRate = t ? Math.round((100 * p) / t) : null;
  const decisions = detail.review?.decisions || {};
  const reasons = detail.review?.details || {};
  const decVals = Object.values(decisions);
  const okCount = decVals.filter((d) => d === 'advance' || d === 'pass').length;
  const external = detail.class?.kind === 'external';
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const profileLink = (s) => <a className="link-name" href={`/students/${s.id}`} target="_blank" rel="noopener noreferrer" title="Mở hồ sơ ở tab mới">{s.full_name}</a>;

  const gradeExport = {
    title: `Bảng điểm: ${detail.class?.name || ''}`,
    subtitle: exportSubtitle({ parish, cls: detail.class }),
    columns: [
      STT_COL,
      { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
      { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
      ...cols.map((c) => ({ label: c.name, get: (s) => detail.scores[s.id]?.[c.id] ?? '', width: 10 })),
      { label: 'TB', get: (s) => avgOf(cols, detail.scores[s.id]) ?? '', width: 8 },
      { label: 'Chuyên cần', get: (s) => { const v = rateOf(detail.att[s.id]); return v == null ? '' : `${v}%`; }, width: 11 },
    ],
    rows: students,
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide arx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="arxT">
        <div className="arx-mhead">
          <h2 id="arxT">{detail.class?.name} <span className="muted">· năm {detail.class?.year || NA}</span></h2>
          <button className="arx-x" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="arx-sum">
          <div><span>Sĩ số</span><b>{students.length}</b></div>
          <div><span>Điểm TB lớp</span><b>{classAvg ?? NA}</b></div>
          <div><span>Chuyên cần</span><b>{classRate != null ? `${classRate}%` : NA}</b></div>
          <div><span>{external ? 'Đậu' : 'Lên lớp'}</span><b>{decVals.length ? `${okCount}/${decVals.length}` : NA}</b></div>
        </div>
        <div className="arx-mtools">
          <div className="seg">
            <button type="button" className={`seg-btn ${tab === 'grades' ? 'on' : ''}`} onClick={() => setTab('grades')}>Điểm số</button>
            <button type="button" className={`seg-btn ${tab === 'att' ? 'on' : ''}`} onClick={() => setTab('att')}>Điểm danh</button>
            <button type="button" className={`seg-btn ${tab === 'result' ? 'on' : ''}`} onClick={() => setTab('result')}>Kết quả cuối năm</button>
          </div>
          <input type="search" className="arx-msearch" placeholder="Tìm tên, không cần dấu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm học viên" />
          {tab === 'grades' && (
            <span className="arx-exp">
              <button className="btn ghost sm" disabled={!students.length} onClick={() => exportXlsx({ filename: `bang-diem-${fileSlug(detail.class?.name)}.xlsx`, sheetName: 'Bảng điểm', ...gradeExport })}><IconDownload className="bi" />Excel</button>
              <button className="btn ghost sm" disabled={!students.length} onClick={() => exportPdf({ ...gradeExport, align: 'center' })}><IconPrinter className="bi" />PDF</button>
            </span>
          )}
        </div>
        <div className="arx-mbody">
          {tab === 'grades' && (
            <table className="arx-table">
              <thead><tr><th>Họ tên</th>{cols.map((c) => <th key={c.id} className="num">{c.name}{Number(c.weight) !== 1 && <small> x{c.weight}</small>}</th>)}<th className="num">TB</th></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td className="arx-c-name">{s.saint_name && <small>{s.saint_name}</small>}{profileLink(s)}</td>
                    {cols.map((c) => <td key={c.id} className="num">{detail.scores[s.id]?.[c.id] ?? NA}</td>)}
                    <td className="num"><b>{avgOf(cols, detail.scores[s.id]) ?? NA}</b></td>
                  </tr>
                ))}
                {cols.length === 0 && <tr><td colSpan={2} className="muted">Lớp này không có cột điểm nào.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'att' && (
            detail.sessions === 0 ? <p className="muted">Lớp này không có buổi điểm danh nào.</p> : (
              <table className="arx-table">
                <thead><tr><th>Họ tên</th><th className="num">Có mặt</th><th className="num">Trễ</th><th className="num">Vắng</th><th className="num">Có phép</th><th className="num">Chuyên cần</th></tr></thead>
                <tbody>
                  {shown.map((s) => { const a = detail.att[s.id] || { present: 0, late: 0, absent: 0, excused: 0 }; const r = rateOf(a); return (
                    <tr key={s.id}>
                      <td className="arx-c-name">{s.saint_name && <small>{s.saint_name}</small>}{profileLink(s)}</td>
                      <td className="num">{a.present}</td><td className="num">{a.late}</td><td className="num arx-bad">{a.absent || ''}</td><td className="num">{a.excused || ''}</td>
                      <td className="num"><b className={r != null && r < 70 ? 'arx-bad' : ''}>{r != null ? `${r}%` : NA}</b></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )
          )}
          {tab === 'result' && (
            !decVals.length ? <p className="muted">Lớp này không có kết quả cuối năm được gửi duyệt.</p> : (
              <table className="arx-table">
                <thead><tr><th>Họ tên</th><th>Kết quả</th><th>Lý do</th></tr></thead>
                <tbody>
                  {shown.map((s) => { const d = DEC[decisions[s.id]]; return (
                    <tr key={s.id}>
                      <td className="arx-c-name">{s.saint_name && <small>{s.saint_name}</small>}{profileLink(s)}</td>
                      <td>{d ? <span className={`arx-tag ${d[1]}`}>{d[0]}</span> : <span className="muted">{NA}</span>}</td>
                      <td className="muted">{reasons[s.id]?.reason || ''}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )
          )}
          {shown.length === 0 && students.length > 0 && <p className="muted">Không có học viên nào khớp tìm kiếm.</p>}
        </div>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
