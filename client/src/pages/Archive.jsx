import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { exportXlsx, exportXlsxMulti, exportPdf, STT_COL, exportSubtitle, fileSlug } from '../lib/exportUtils';

// Tính điểm TB có trọng số cho 1 học viên từ cột điểm + điểm số
function avgOf(columns, rowScores) {
  let s = 0, w = 0;
  columns.forEach((c) => { const v = rowScores?.[c.id]; if (v !== undefined && v !== null) { const wt = Number(c.weight) || 1; s += Number(v) * wt; w += wt; } });
  return w ? Math.round((s / w) * 10) / 10 : null;
}

export default function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [years, setYears] = useState([]);
  const [open, setOpen] = useState(null);       // năm đang mở
  const [byYear, setByYear] = useState({});      // { year: [classes] }
  const [detail, setDetail] = useState(null);    // { class, students, columns, scores }
  const [search, setSearch] = useState('');
  const [parish, setParish] = useState(null);
  const [msg, setMsg] = useState('');

  function loadYears() { api.get('/archive-years').then((r) => setYears(r.data)).catch(() => {}); }
  useEffect(() => { loadYears(); api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được truy cập lưu trữ.</div>;

  async function toggleYear(y) {
    if (open === y) { setOpen(null); return; }
    setOpen(y);
    if (!byYear[y]) {
      const r = await api.get(`/archive-classes?year=${encodeURIComponent(y)}`);
      setByYear((m) => ({ ...m, [y]: r.data }));
    }
  }

  async function openClass(c) {
    setSearch('');
    const r = await api.get(`/archive-class?class_id=${c.id}`);
    setDetail(r.data);
  }

  // Tải về cả năm: Excel — mỗi lớp một sheet (bảng điểm lớp đó)
  async function downloadYear(y) {
    setMsg('Đang chuẩn bị file...');
    let cls = byYear[y];
    if (!cls) { const r = await api.get(`/archive-classes?year=${encodeURIComponent(y)}`); cls = r.data; setByYear((m) => ({ ...m, [y]: cls })); }
    const sheets = [];
    for (const c of cls) {
      const r = await api.get(`/archive-class?class_id=${c.id}`);
      const { students, columns, scores } = r.data;
      sheets.push({
        name: c.name,
        title: `Bảng điểm — ${c.name}`,
        subtitle: exportSubtitle({ parish, cls: { name: c.name, year: y } }),
        columns: [
          STT_COL,
          { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
          { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
          ...columns.map((col) => ({ label: col.name, get: (s) => scores[s.id]?.[col.id] ?? '', width: 10 })),
          { label: 'TB', get: (s) => avgOf(columns, scores[s.id]) ?? '', width: 8 },
        ],
        rows: students,
      });
    }
    if (sheets.length) exportXlsxMulti({ filename: `luu-tru-${fileSlug(y)}.xlsx`, sheets });
    setMsg('');
  }

  // ---- bảng điểm lớp trong modal ----
  const dCols = detail?.columns || [];
  const dStudents = (detail?.students || []).filter((s) =>
    (s.full_name + ' ' + (s.saint_name || '')).toLowerCase().includes(search.toLowerCase()));
  const detailExport = detail && {
    title: `Bảng điểm — ${detail.class?.name || ''}`,
    subtitle: exportSubtitle({ parish, cls: detail.class }),
    columns: [
      STT_COL,
      { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
      { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
      ...dCols.map((c) => ({ label: c.name, get: (s) => detail.scores[s.id]?.[c.id] ?? '', width: 10 })),
      { label: 'TB', get: (s) => avgOf(dCols, detail.scores[s.id]) ?? '', width: 8 },
    ],
    rows: detail.students,
  };

  return (
    <div>
      <h1>Lưu trữ theo năm học</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Dữ liệu các năm đã kết thúc được đóng băng tại đây. Mở năm → chọn lớp để xem học viên và điểm của năm đó.
      </p>
      {msg && <div className="info-box">{msg}</div>}

      {years.length === 0 && <div className="panel muted">Chưa có năm học nào được lưu trữ. Sau khi "Kết thúc năm học & lên lớp", năm cũ sẽ hiện ở đây.</div>}

      <div className="year-list">
        {years.map((y) => (
          <div className="panel year-panel" key={y.year}>
            <div className="year-head">
              <button className="year-toggle" onClick={() => toggleYear(y.year)}>
                <span className={`chev ${open === y.year ? 'up' : ''}`}>▾</span>
                <b>Năm học {y.year}</b>
                <span className="muted" style={{ fontSize: 13 }}>· {y.classes} lớp · {y.students} học viên</span>
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost sm" onClick={() => downloadYear(y.year)}>⬇ Tải về (Excel)</button>
              </div>
            </div>
            {open === y.year && (
              <div className="year-classes">
                {(byYear[y.year] || []).map((c) => (
                  <button className="arch-class" key={c.id} onClick={() => openClass(c)}>
                    <span>{c.name}</span>
                    <span className="muted">{c.student_count} học viên →</span>
                  </button>
                ))}
                {byYear[y.year] && byYear[y.year].length === 0 && <div className="muted" style={{ padding: 8 }}>Không có lớp.</div>}
                {!byYear[y.year] && <div className="muted" style={{ padding: 8 }}>Đang tải...</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal bảng điểm lớp năm cũ */}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{detail.class?.name} <span className="muted" style={{ fontSize: 14 }}>· năm {detail.class?.year || '—'}</span></h2>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <input className="grow" placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn ghost" disabled={!detail.students.length} onClick={() => exportXlsx({ filename: `bang-diem-${fileSlug(detail.class?.name)}.xlsx`, sheetName: 'Bảng điểm', ...detailExport })}>⬇ Excel</button>
              <button className="btn ghost" disabled={!detail.students.length} onClick={() => exportPdf({ ...detailExport, align: 'center' })}>🖨 PDF</button>
            </div>
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Tên thánh</th><th>Họ tên</th>{dCols.map((c) => <th key={c.id} style={{ textAlign: 'center' }}>{c.name}</th>)}<th style={{ textAlign: 'center' }}>TB</th></tr>
                </thead>
                <tbody>
                  {dStudents.map((s) => (
                    <tr key={s.id}>
                      <td>{s.saint_name || '—'}</td>
                      <td><span className="link-name" onClick={() => navigate(`/students/${s.id}`)}>{s.full_name}</span></td>
                      {dCols.map((c) => <td key={c.id} style={{ textAlign: 'center' }}>{detail.scores[s.id]?.[c.id] ?? '—'}</td>)}
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{avgOf(dCols, detail.scores[s.id]) ?? '—'}</td>
                    </tr>
                  ))}
                  {dStudents.length === 0 && <tr><td colSpan={dCols.length + 3} className="muted">Không có học viên</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setDetail(null)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
