import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import BulkImport from '../components/BulkImport.jsx';
import SacramentBadge, { SACRAMENTS, SACRAMENT_OPTIONS } from '../components/SacramentBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import { exportXlsx, exportPdf, STT_COL, fileSlug, exportSubtitle } from '../lib/exportUtils';

const empty = {
  full_name: '', saint_name: '', birth_date: '', gender: '',
  parent_name: '', parent_phone: '', student_phone: '', address: '', class_id: '', notes: '',
  sacrament: 'none', position: '',
};

const studentColumns = [
  STT_COL,
  { label: 'Tên thánh', get: (s) => s.saint_name || '', width: 14 },
  { label: 'Họ và tên', get: (s) => s.full_name, width: 22 },
  { label: 'Chức vụ', get: (s) => s.position || '', width: 12 },
  { label: 'Ngày sinh', get: (s) => s.birth_date || '', width: 12 },
  { label: 'Giới tính', get: (s) => s.gender || '', width: 9 },
  { label: 'Lớp', get: (s) => s.class_name || '', width: 14 },
  { label: 'Phụ huynh', get: (s) => s.parent_name || '', width: 22 },
  { label: 'SĐT phụ huynh', get: (s) => s.parent_phone || '', width: 14 },
  { label: 'SĐT học sinh', get: (s) => s.student_phone || '', width: 14 },
  { label: 'Địa chỉ', get: (s) => s.address || '', width: 30 },
  { label: 'Ghi chú', get: (s) => s.notes || '', width: 20 },
];

const defaultFilter = { classes: [], sacrament: '', sortBy: 'name' };

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [error, setError] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [f, setF] = useState(defaultFilter);
  const [parish, setParish] = useState(null);

  function load() {
    api.get('/students').then((r) => setStudents(r.data));
    api.get('/student-stats').then((r) => setStats(r.data)).catch(() => {});
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);

  function openCreate() { setError(''); setModal({ ...empty }); }
  function openEdit(s) { setError(''); setModal({ ...s, class_id: s.class_id || '' }); }

  async function save() {
    setError('');
    try {
      if (modal.id) await api.put(`/students/${modal.id}`, modal);
      else await api.post('/students', modal);
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Lưu thất bại');
    }
  }

  async function remove(s) {
    if (!confirm(`Xóa học viên "${s.full_name}"?`)) return;
    await api.delete(`/students/${s.id}`);
    load();
  }

  // ----- áp dụng bộ lọc -----
  const st = (id) => stats[id] || {};
  let filtered = students.filter((s) => {
    if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (f.classes.length && !f.classes.includes(s.class_id)) return false;
    if (f.sacrament && (s.sacrament || 'none') !== f.sacrament) return false;
    return true;
  });
  const rate = (id) => { const s = st(id); const tot = (s.present || 0) + (s.absent || 0) + (s.late || 0); return tot ? (s.present || 0) / tot : -1; };
  filtered = [...filtered].sort((a, b) => {
    if (f.sortBy === 'absent') return (st(b.id).absent || 0) - (st(a.id).absent || 0);
    if (f.sortBy === 'diligent') return rate(b.id) - rate(a.id);
    return a.full_name.localeCompare(b.full_name, 'vi');
  });

  const activeCount = (f.classes.length ? 1 : 0) + (f.sacrament ? 1 : 0) + (f.sortBy !== 'name' ? 1 : 0);

  const singleCls = f.classes.length === 1 ? classes.find((c) => c.id === f.classes[0]) : null;
  const exportMeta = {
    title: 'Danh sách học viên',
    subtitle: exportSubtitle({ parish, cls: singleCls, extra: singleCls ? [] : ['Tất cả các lớp'] }),
    columns: studentColumns,
    rows: filtered,
  };
  const exportName = 'danh-sach-hoc-vien';

  const toggleClass = (id) => setF((p) => ({ ...p, classes: p.classes.includes(id) ? p.classes.filter((x) => x !== id) : [...p.classes, id] }));

  return (
    <div>
      <h1>Quản lý học viên</h1>
      <div className="toolbar">
        <input className="grow" placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={`btn ghost ${activeCount ? 'has-badge' : ''}`} onClick={() => setShowFilter((v) => !v)}>
          🔽 Lọc / Sắp xếp{activeCount ? ` (${activeCount})` : ''}
        </button>
        <button className="btn ghost" onClick={() => setBulkOpen(true)}>⬆ Nhập hàng loạt</button>
        <button className="btn ghost" disabled={filtered.length === 0}
          onClick={() => exportXlsx({ filename: `${exportName}.xlsx`, sheetName: 'Học viên', ...exportMeta })}>⬇ Excel</button>
        <button className="btn ghost" disabled={filtered.length === 0} onClick={() => exportPdf(exportMeta)}>🖨 PDF</button>
        <button className="btn" onClick={openCreate}>+ Thêm học viên</button>
      </div>

      {showFilter && (
        <div className="filter-panel">
          <div className="fp-grid">
            <div className="fp-col">
              <div className="fp-label">Lọc theo lớp (tích nhiều lớp)</div>
              <div className="fp-classes">
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
                <option value="ruoc_le">Đã Rước lễ</option>
                <option value="them_suc">Đã Thêm sức</option>
                <option value="none">Chưa có bí tích</option>
              </select>
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Lọc theo điểm đã chuyển sang tab <b>Điểm số</b>.</p>
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

      <div className="panel">
        <div className="sac-legend">
          <span>Bí tích:</span>
          <span className="it"><SacramentBadge value="ruoc_le" /> Rước lễ</span>
          <span className="it"><SacramentBadge value="them_suc" /> Thêm Sức</span>
          <span className="it">(không icon = chưa nhận)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tên thánh</th><th>Họ tên</th><th>Chức vụ</th><th>Ngày sinh</th><th>Lớp</th><th>SĐT phụ huynh</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.saint_name || '—'}</td>
                <td><div className="stu-cell"><Avatar url={s.avatar_url} name={s.full_name} size={30} /><span className="link-name" onClick={() => navigate(`/students/${s.id}`)}>{s.full_name}</span><SacramentBadge value={s.sacrament} /></div></td>
                <td>{s.position ? <span className="role-chip">{s.position}</span> : <span className="muted">—</span>}</td>
                <td>{s.birth_date || '—'}</td>
                <td>{s.class_name || <span className="muted">Chưa xếp lớp</span>}</td>
                <td>{s.parent_phone || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => openEdit(s)}>Sửa</button>{' '}
                  <button className="btn danger sm" onClick={() => remove(s)}>Xóa</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="muted">Không có học viên</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Sửa học viên' : 'Thêm học viên'}</h2>
            <div className="row">
              <div className="field">
                <label>Tên thánh</label>
                <input value={modal.saint_name || ''} onChange={(e) => setModal({ ...modal, saint_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Họ tên *</label>
                <input value={modal.full_name} onChange={(e) => setModal({ ...modal, full_name: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Ngày sinh</label>
                <input type="date" value={modal.birth_date || ''} onChange={(e) => setModal({ ...modal, birth_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Giới tính</label>
                <select value={modal.gender || ''} onChange={(e) => setModal({ ...modal, gender: e.target.value })}>
                  <option value="">—</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
              <div className="field">
                <label>Bí tích đã nhận</label>
                <select value={modal.sacrament || 'none'} onChange={(e) => setModal({ ...modal, sacrament: e.target.value })}>
                  {SACRAMENT_OPTIONS.map((k) => <option key={k} value={k}>{SACRAMENTS[k].label}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Lớp</label>
                <select value={modal.class_id || ''} onChange={(e) => setModal({ ...modal, class_id: e.target.value })}>
                  <option value="">Chưa xếp lớp</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Chức vụ</label>
                <input value={modal.position || ''} onChange={(e) => setModal({ ...modal, position: e.target.value })} placeholder="VD: Lớp trưởng, Lớp phó" />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Tên phụ huynh</label>
                <input value={modal.parent_name || ''} onChange={(e) => setModal({ ...modal, parent_name: e.target.value })} placeholder="VD: Nguyễn Văn Bố / Trần Thị Mẹ" />
              </div>
              <div className="field">
                <label>SĐT phụ huynh</label>
                <input value={modal.parent_phone || ''} onChange={(e) => setModal({ ...modal, parent_phone: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>SĐT học sinh</label>
                <input value={modal.student_phone || ''} onChange={(e) => setModal({ ...modal, student_phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Địa chỉ</label>
                <input value={modal.address || ''} onChange={(e) => setModal({ ...modal, address: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <textarea rows={2} value={modal.notes || ''} onChange={(e) => setModal({ ...modal, notes: e.target.value })} />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <BulkImport
          classes={classes}
          onClose={() => setBulkOpen(false)}
          onDone={(res) => {
            setBulkOpen(false);
            load();
            alert(`Đã nhập ${res.count} học viên` + (res.skipped ? `, bỏ qua ${res.skipped} dòng thiếu họ tên` : ''));
          }}
        />
      )}
    </div>
  );
}
