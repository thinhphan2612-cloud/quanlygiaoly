import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useRealtime } from '../realtime.jsx';
import { useAuth } from '../auth.jsx';
import BulkImport from '../components/BulkImport.jsx';
import SacramentBadge from '../components/SacramentBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import StudentModal from '../components/StudentModal.jsx';
import RowMenu from '../components/RowMenu.jsx';
import { byViName } from '../lib/viName';
import { exportXlsx, exportPdf, STT_COL, fileSlug, exportSubtitle } from '../lib/exportUtils';
import { getPref, setPref } from '../lib/prefs';
import { IconColumns, IconDownload, IconFilter, IconUpload } from '../components/Icons.jsx';
import { viDate } from '../lib/date';
import { toast } from '../lib/toast';
import { SkeletonRows } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';

const empty = {
  full_name: '', saint_name: '', birth_date: '', gender: '',
  parent_name: '', parent_phone: '', student_phone: '', address: '', class_id: '', notes: '',
  sacrament: 'none', position: '', certificates: [],
};

const studentColumns = [
  STT_COL,
  { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
  { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
  { label: 'Chức vụ', get: (s) => s.position || '', width: 12 },
  { label: 'Ngày sinh', get: (s) => s.birth_date || '', width: 12 },
  { label: 'Giới tính', get: (s) => s.gender || '', width: 9 },
  { label: 'Lớp', get: (s) => s.class_name || '', width: 14 },
  { label: 'Họ tên cha', get: (s) => [s.father_saint, s.father_name].filter(Boolean).join(' ') || s.parent_name || '', width: 20 },
  { label: 'SĐT cha', get: (s) => s.father_phone || s.parent_phone || '', width: 13 },
  { label: 'Họ tên mẹ', get: (s) => [s.mother_saint, s.mother_name].filter(Boolean).join(' '), width: 20 },
  { label: 'SĐT mẹ', get: (s) => s.mother_phone || '', width: 13 },
  { label: 'Người đỡ đầu', get: (s) => s.godparent_name || '', width: 18 },
  { label: 'SĐT học sinh', get: (s) => s.student_phone || '', width: 13 },
  { label: 'Rửa tội', get: (s) => s.baptism_date || '', width: 12 },
  { label: 'Rước lễ', get: (s) => s.first_communion_date || '', width: 12 },
  { label: 'Thêm sức', get: (s) => s.confirmation_date || '', width: 12 },
  { label: 'Chứng chỉ/khóa', get: (s) => (Array.isArray(s.certificates) ? s.certificates : []).map((c) => c.name + (c.date ? ` (${c.date})` : '')).join('; '), width: 30 },
  { label: 'Địa chỉ', get: (s) => s.address || '', width: 26 },
  { label: 'Ghi chú', get: (s) => s.notes || '', width: 18 },
];

const defaultFilter = { classes: [], sacrament: '', sortBy: 'name' };

const joinName = (saint, name) => [saint, name].filter(Boolean).join(' ');
// Phụ huynh: ưu tiên cha / mẹ; dữ liệu cũ chỉ có parent_name / parent_phone.
function parentLines(s) {
  const lines = [];
  const father = joinName(s.father_saint, s.father_name);
  const mother = joinName(s.mother_saint, s.mother_name);
  if (father || s.father_phone) lines.push({ who: 'Cha', name: father, phone: s.father_phone });
  if (mother || s.mother_phone) lines.push({ who: 'Mẹ', name: mother, phone: s.mother_phone });
  if (!lines.length && (s.parent_name || s.parent_phone)) lines.push({ who: '', name: s.parent_name, phone: s.parent_phone });
  return lines;
}
const dash = <span className="muted">–</span>;
// Bỏ dấu tiếng Việt để tìm kiếm (gõ "nguyen" vẫn ra "Nguyễn")
const fold = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const NO_CLASS = '__none';

// Các cột có thể hiện trong bảng. Họ tên luôn hiện; người dùng tự chọn các cột còn lại.
const DISPLAY_COLS = [
  { key: 'saint', exp: ['Tên thánh'], label: 'Tên thánh', render: (s) => s.saint_name || dash },
  { key: 'position', exp: ['Chức vụ'], label: 'Chức vụ', render: (s) => (s.position ? <span className="role-chip">{s.position}</span> : dash) },
  { key: 'birth', exp: ['Ngày sinh'], label: 'Ngày sinh', render: (s) => viDate(s.birth_date) || dash },
  { key: 'gender', exp: ['Giới tính'], label: 'Giới tính', render: (s) => s.gender || dash },
  { key: 'class', exp: ['Lớp'], label: 'Lớp', render: (s) => s.class_name || <span className="muted">Chưa xếp lớp</span> },
  { key: 'parents', exp: ['Họ tên cha', 'SĐT cha', 'Họ tên mẹ', 'SĐT mẹ'], label: 'Phụ huynh', render: (s) => {
    const lines = parentLines(s);
    if (!lines.length) return dash;
    return lines.map((l, i) => (
      <div key={i} className="parent-line">
        {l.who && <span className="muted">{l.who}: </span>}{l.name || ''}{l.name && l.phone ? ' · ' : ''}{l.phone || ''}
      </div>
    ));
  } },
  { key: 'godparent', exp: ['Người đỡ đầu'], label: 'Người đỡ đầu', render: (s) => s.godparent_name || dash },
  { key: 'student_phone', exp: ['SĐT học sinh'], label: 'SĐT học viên', render: (s) => s.student_phone || dash },
  { key: 'baptism', exp: ['Rửa tội'], label: 'Ngày Rửa tội', render: (s) => viDate(s.baptism_date) || dash },
  { key: 'communion', exp: ['Rước lễ'], label: 'Ngày Rước lễ', render: (s) => viDate(s.first_communion_date) || dash },
  { key: 'confirmation', exp: ['Thêm sức'], label: 'Ngày Thêm sức', render: (s) => viDate(s.confirmation_date) || dash },
  { key: 'address', exp: ['Địa chỉ'], label: 'Địa chỉ', render: (s) => s.address || dash },
  { key: 'notes', exp: ['Ghi chú'], label: 'Ghi chú', render: (s) => s.notes || dash },
];
const DEFAULT_COLS = ['saint', 'birth', 'class', 'parents'];
const EXP_COL = Object.fromEntries(studentColumns.map((c) => [c.label, c]));
// Lựa chọn cột lưu ở tài khoản (đồng bộ giữa các máy, lib/prefs) và bản sao localStorage để mở trang hiện ngay.
// Dạng lưu: { cols: [...key], exportAll: bool }.
const colsKey = (uid) => `students_cols:${uid || 'anon'}`;
function normCols(v) {
  if (Array.isArray(v)) return { cols: v, exportAll: false }; // dạng cũ: chỉ mảng cột
  if (v && Array.isArray(v.cols)) return { cols: v.cols, exportAll: !!v.exportAll };
  return null;
}
function cleanCols(p) { return { ...p, cols: p.cols.filter((k) => DISPLAY_COLS.some((c) => c.key === k)) }; }
function loadCols(uid) {
  try { const v = normCols(JSON.parse(localStorage.getItem(colsKey(uid)))); if (v) return cleanCols(v); } catch { /* dùng mặc định */ }
  return { cols: DEFAULT_COLS, exportAll: false };
}

export default function Students() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false); // lần tải đầu xong chưa (để hiện khung xương thay vì "Không có học viên")
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [f, setF] = useState(defaultFilter);
  const [parish, setParish] = useState(null);
  const [showCols, setShowCols] = useState(false);
  const [view, setView] = useState(() => loadCols(user?.id));
  const cols = view.cols;
  const saveTimer = useRef();
  // Lấy lựa chọn đã lưu ở tài khoản (có thể đặt từ máy khác).
  useEffect(() => {
    getPref('students_cols').then((v) => {
      const p = normCols(v); if (!p) return;
      const next = cleanCols(p);
      setView(next);
      try { localStorage.setItem(colsKey(user?.id), JSON.stringify(next)); } catch { /* bỏ qua */ }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function saveView(next) {
    setView(next);
    try { localStorage.setItem(colsKey(user?.id), JSON.stringify(next)); } catch { /* bỏ qua */ }
    // Gom nhiều lần tick liên tiếp thành 1 lần ghi lên tài khoản.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { setPref('students_cols', next).catch(() => {}); }, 800);
  }
  const toggleCol = (key) => saveView({ ...view, cols: cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key] });
  const resetCols = () => saveView({ cols: DEFAULT_COLS, exportAll: view.exportAll });
  // Giữ đúng thứ tự cột theo DISPLAY_COLS; Họ tên đứng sau Tên thánh (hoặc đầu bảng nếu ẩn Tên thánh).
  const shownCols = DISPLAY_COLS.filter((c) => cols.includes(c.key));
  const beforeName = shownCols.filter((c) => c.key === 'saint');
  const afterName = shownCols.filter((c) => c.key !== 'saint');

  function load() {
    api.get('/students').then((r) => { setStudents(r.data); setLoaded(true); });
    api.get('/student-stats').then((r) => setStats(r.data)).catch(() => {});
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);
  const rev = useRealtime(['students', 'classes', 'grades', 'attendance']);
  useEffect(() => { if (rev) { load(); api.get('/classes').then((r) => setClasses(r.data)); } }, [rev]);

  // GLV chỉ thêm được vào lớp mình -> mặc định chọn sẵn lớp đầu tiên của họ.
  function openCreate() { setModal({ ...empty, class_id: isTeacher && classes.length ? classes[0].id : '' }); }
  function openEdit(s) { setModal({ ...s, class_id: s.class_id || '' }); }

  async function remove(s) {
    const who = [s.saint_name, s.full_name].filter(Boolean).join(' ');
    if (!await confirmDialog(`Xóa hồ sơ học viên ${who}?\n\nSẽ mất luôn điểm số, điểm danh và việc thiêng liêng của em này, không khôi phục được.\n\nNếu em chỉ chuyển lớp hoặc nghỉ học, hãy sửa lớp thay vì xóa.`)) return;
    try { await api.delete(`/students/${s.id}`); toast(`Đã xóa hồ sơ ${who}`); load(); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa xóa được học viên'); }
  }

  // ----- áp dụng bộ lọc -----
  const st = (id) => stats[id] || {};
  const q = fold(search.trim());
  const haystack = (s) => fold([s.saint_name, s.full_name, s.father_saint, s.father_name, s.mother_saint, s.mother_name, s.parent_name,
    s.godparent_name, s.father_phone, s.mother_phone, s.parent_phone, s.student_phone].filter(Boolean).join(' '));
  let filtered = students.filter((s) => {
    if (q && !haystack(s).includes(q)) return false;
    if (f.classes.length && !f.classes.includes(s.class_id || NO_CLASS)) return false;
    if (f.sacrament && (s.sacrament || 'none') !== f.sacrament) return false;
    return true;
  });
  const rate = (id) => { const s = st(id); const tot = (s.present || 0) + (s.absent || 0) + (s.late || 0); return tot ? (s.present || 0) / tot : -1; };
  filtered = [...filtered].sort((a, b) => {
    if (f.sortBy === 'absent') return (st(b.id).absent || 0) - (st(a.id).absent || 0);
    if (f.sortBy === 'diligent') return rate(b.id) - rate(a.id);
    return byViName(a, b);
  });

  const activeCount = (f.classes.length ? 1 : 0) + (f.sacrament ? 1 : 0) + (f.sortBy !== 'name' ? 1 : 0);

  const singleCls = f.classes.length === 1 ? classes.find((c) => c.id === f.classes[0]) : null;
  // Xuất theo đúng các cột đang hiện (Họ tên luôn có), hoặc toàn bộ cột nếu người dùng chọn.
  const exportCols = view.exportAll ? studentColumns : [
    STT_COL,
    ...beforeName.flatMap((c) => c.exp.map((l) => EXP_COL[l])),
    EXP_COL['Họ và tên'],
    ...afterName.flatMap((c) => c.exp.map((l) => EXP_COL[l])),
  ];
  const exportMeta = {
    title: 'Danh sách học viên',
    subtitle: exportSubtitle({ parish, cls: singleCls, extra: singleCls ? [] : ['Tất cả các lớp'] }),
    columns: exportCols,
    rows: filtered,
  };
  const exportName = 'danh-sach-hoc-vien';

  const SAC_LABEL = { baptism: 'Đã Rửa tội', ruoc_le: 'Đã Rước lễ', them_suc: 'Đã Thêm sức', none: 'Chưa có bí tích' };
  const SORT_LABEL = { absent: 'Vắng nhiều nhất', diligent: 'Chuyên cần nhất' };
  const chips = [
    ...f.classes.map((id) => ({ key: 'c' + id, label: id === NO_CLASS ? 'Chưa xếp lớp' : (classes.find((c) => c.id === id)?.name || 'Lớp'), clear: () => toggleClass(id) })),
    f.sacrament && { key: 'sac', label: SAC_LABEL[f.sacrament], clear: () => setF((p) => ({ ...p, sacrament: '' })) },
    f.sortBy !== 'name' && { key: 'sort', label: `Xếp: ${SORT_LABEL[f.sortBy]}`, clear: () => setF((p) => ({ ...p, sortBy: 'name' })) },
  ].filter(Boolean);
  const noClassCount = students.filter((s) => !s.class_id).length;
  const doExport = (kind) => (kind === 'excel' ? exportXlsx({ filename: `${exportName}.xlsx`, sheetName: 'Học viên', ...exportMeta }) : exportPdf(exportMeta));

  const toggleClass = (id) => setF((p) => ({ ...p, classes: p.classes.includes(id) ? p.classes.filter((x) => x !== id) : [...p.classes, id] }));

  return (
    <div>
      <PageHeader title="Quản lý học viên" subtitle="Hồ sơ học viên của giáo xứ: tìm, lọc, nhập từ Excel và xuất danh sách." />
      <div className="toolbar">
        <input data-tour="stu-search" className="grow stu-search" type="search" placeholder="Tìm tên, tên thánh, phụ huynh, SĐT…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button data-tour="stu-filter" className={`btn ghost ${activeCount ? 'has-badge' : ''}`} onClick={() => setShowFilter((v) => !v)}>
          <IconFilter className="bi" />Lọc / Sắp xếp{activeCount ? ` (${activeCount})` : ''}
        </button>
        <button data-tour="stu-cols" className="btn ghost" onClick={() => setShowCols((v) => !v)}><IconColumns className="bi" />Cột hiển thị</button>
        <button data-tour="stu-import" className="btn ghost" onClick={() => setBulkOpen(true)}><IconUpload className="bi" />Nhập hàng loạt</button>
        {filtered.length > 0 && (
          <RowMenu label="Xuất danh sách đang hiện" triggerClass="btn ghost" trigger={<><IconDownload className="bi" />Xuất</>}
            items={[{ label: 'Excel (.xlsx)', onClick: () => doExport('excel') }, { label: 'PDF (in)', onClick: () => doExport('pdf') }]} />
        )}
        <button className="btn" onClick={openCreate}>+ Thêm học viên</button>
      </div>

      {showFilter && (
        <div className="filter-panel">
          <div className="fp-grid">
            <div className="fp-col">
              <div className="fp-label">Lọc theo lớp (tích nhiều lớp)</div>
              <div className="fp-classes">
                {noClassCount > 0 && (
                  <label className="fp-chk">
                    <input type="checkbox" checked={f.classes.includes(NO_CLASS)} onChange={() => toggleClass(NO_CLASS)} />
                    <span>Chưa xếp lớp ({noClassCount})</span>
                  </label>
                )}
                {classes.map((c) => (
                  <label key={c.id} className="fp-chk">
                    <input type="checkbox" checked={f.classes.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    <span>{c.name}</span>
                  </label>
                ))}
                {classes.length === 0 && <span className="muted">Chưa có lớp</span>}
              </div>
            </div>
            <div className="fp-col">
              <div className="fp-label">Bí tích</div>
              <select value={f.sacrament} onChange={(e) => setF({ ...f, sacrament: e.target.value })}>
                <option value="">Tất cả</option>
                <option value="baptism">Đã Rửa tội</option>
                <option value="ruoc_le">Đã Rước lễ</option>
                <option value="them_suc">Đã Thêm sức</option>
                <option value="none">Chưa có bí tích</option>
              </select>
            </div>
            <div className="fp-col">
              <div className="fp-label">Sắp xếp</div>
              <select value={f.sortBy} onChange={(e) => setF({ ...f, sortBy: e.target.value })}>
                <option value="name">Tên A-Z</option>
                <option value="absent">Vắng nhiều nhất</option>
                <option value="diligent">Chuyên cần nhất</option>
              </select>
              <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => setF(defaultFilter)}>Xóa bộ lọc</button>
            </div>
          </div>
        </div>
      )}

      {showCols && (
        <div className="filter-panel">
          <div className="fp-label">Chọn cột hiển thị trong bảng (Họ tên luôn hiện)</div>
          <div className="fp-classes" style={{ maxHeight: 'none' }}>
            {DISPLAY_COLS.map((c) => (
              <label key={c.key} className="fp-chk">
                <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <div className="fp-label" style={{ marginTop: 14 }}>Khi xuất Excel / PDF</div>
          <div className="fp-classes" style={{ maxHeight: 'none' }}>
            <label className="fp-chk">
              <input type="radio" name="stu-export" checked={!view.exportAll} onChange={() => saveView({ ...view, exportAll: false })} />
              <span>Chỉ các cột đang hiện</span>
            </label>
            <label className="fp-chk">
              <input type="radio" name="stu-export" checked={view.exportAll} onChange={() => saveView({ ...view, exportAll: true })} />
              <span>Tất cả thông tin (kể cả chứng chỉ / khóa học)</span>
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Lựa chọn được lưu vào tài khoản, đăng nhập máy khác vẫn giữ.</p>
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={resetCols}>Về mặc định</button>
        </div>
      )}

      <div className="hvx-count">
        <span>{loaded ? (filtered.length === students.length ? `${students.length} học viên` : `Đang hiện ${filtered.length} / ${students.length} học viên`) : ''}</span>
        {chips.map((c) => <button type="button" key={c.key} className="hvx-chip" onClick={c.clear} title="Bỏ điều kiện này">{c.label}<span aria-hidden="true">×</span></button>)}
        {(chips.length > 0 || search) && <button type="button" className="hvx-clear" onClick={() => { setF(defaultFilter); setSearch(''); }}>Bỏ lọc</button>}
      </div>

      <div className="panel hvx-panel">
        <div className="sac-legend">
          <span>Bí tích:</span>
          <span className="it"><SacramentBadge value="baptism" /> Rửa tội</span>
          <span className="it"><SacramentBadge value="ruoc_le" /> Rước lễ</span>
          <span className="it"><SacramentBadge value="them_suc" /> Thêm Sức</span>
          <span className="it">(không icon = chưa nhận)</span>
        </div>
        <table className="hvx-table">
          <thead>
            <tr>
              {beforeName.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>Họ tên</th>
              {afterName.map((c) => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRows rows={6} cols={shownCols.length + 2} />}
            {filtered.map((s) => (
              <tr key={s.id}>
                {beforeName.map((c) => <td key={c.key} data-label={c.label} className={`hvx-c-${c.key}`}>{c.render(s)}</td>)}
                <td className="hvx-c-name"><div className="stu-cell"><Avatar url={s.avatar_url} name={s.full_name} size={30} /><span data-tour="stu-name" className="link-name" onClick={() => navigate(`/students/${s.id}`)}>{s.full_name}</span><SacramentBadge value={s.sacrament} /></div></td>
                {afterName.map((c) => <td key={c.key} data-label={c.label} className={`hvx-c-${c.key}`}>{c.render(s)}</td>)}
                <td className="hvx-c-act">
                  <button className="btn ghost sm" onClick={() => openEdit(s)}>Sửa</button>
                  <RowMenu items={[
                    { label: 'Xem hồ sơ', onClick: () => navigate(`/students/${s.id}`) },
                    { label: 'Xóa học viên…', danger: true, onClick: () => remove(s) },
                  ]} />
                </td>
              </tr>
            ))}
            {loaded && filtered.length === 0 && <tr className="hvx-empty"><td colSpan={shownCols.length + 2} className="muted">{students.length ? 'Không có học viên nào khớp tìm kiếm hoặc bộ lọc.' : 'Chưa có học viên. Bấm "Thêm học viên" hoặc "Nhập hàng loạt" từ Excel.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <StudentModal initial={modal} classes={classes} requireClass={isTeacher}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}

      {bulkOpen && (
        <BulkImport
          classes={classes}
          onClose={() => setBulkOpen(false)}
          onDone={(res) => {
            setBulkOpen(false);
            load();
            toast(`Đã nhập ${res.count} học viên` + (res.skipped ? `, bỏ qua ${res.skipped} dòng thiếu họ tên` : ''));
          }}
        />
      )}
    </div>
  );
}
