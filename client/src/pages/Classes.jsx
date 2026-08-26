import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { SACRAMENTS, CERT_SUGGESTIONS } from '../components/SacramentBadge.jsx';
import StudentForm from '../components/StudentForm.jsx';
import Avatar from '../components/Avatar.jsx';
import { byViName } from '../lib/viName';

const empty = {
  mode: 'new', name: '', year: '', room: '', schedule: '', promotes: true, teachers: [],
  srcClasses: [], picked: [],
};
const SCHEDULES = ['Sáng', 'Chiều', 'Tối'];
const SAC_RANK = { none: 0, ruoc_le: 1, them_suc: 2 }; // thứ tự bí tích: Rước lễ trước, Thêm Sức sau

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [modal, setModal] = useState(null);
  const [orderList, setOrderList] = useState(null); // modal sắp xếp thứ tự
  const [sac, setSac] = useState(null); // modal ghi bí tích/chứng chỉ cả lớp
  const [detail, setDetail] = useState(null); // { cls, students, picked }
  const [stEdit, setStEdit] = useState(null); // sửa 1 học viên
  const [mv, setMv] = useState(null); // chuyển lớp: { ids, dest }
  const [hist, setHist] = useState(null); // lịch sử lớp: { cls, rows }
  const [error, setError] = useState('');

  function load() { api.get('/classes').then((r) => setClasses(r.data)); }
  useEffect(() => {
    load();
    if (isAdmin) {
      api.get('/auth/users').then((r) => setTeachers(r.data)).catch(() => {});
      api.get('/students').then((r) => setAllStudents(r.data)).catch(() => {});
    }
  }, [isAdmin]);
  const rev = useRealtime(['classes', 'students', 'class_teachers']);
  useEffect(() => {
    if (!rev) return;
    load();
    if (isAdmin) api.get('/students').then((r) => setAllStudents(r.data)).catch(() => {});
    setDetail((d) => { if (d) api.get(`/students?class_id=${d.cls.id}`).then((r) => setDetail((x) => (x && x.cls.id === d.cls.id ? { ...x, students: r.data } : x))); return d; });
  }, [rev]);

  function openCreate() { setError(''); setModal({ ...empty, teachers: [] }); }
  function openEdit(c) {
    setError('');
    setModal({
      ...c, mode: 'edit', year: c.year || '', room: c.room || '', schedule: c.schedule || '',
      promotes: c.promotes !== false,
      teachers: (c.teachers || []).map((t) => ({ teacher_id: t.id, is_primary: t.is_primary })),
    });
  }

  // --- chọn giáo lý viên (nhiều, có chính) ---
  const isAssigned = (id) => modal?.teachers.some((t) => t.teacher_id === id);
  function toggleTeacher(id) {
    const has = isAssigned(id);
    let list = has ? modal.teachers.filter((t) => t.teacher_id !== id) : [...modal.teachers, { teacher_id: id, is_primary: false }];
    if (!list.some((t) => t.is_primary) && list.length) list[0].is_primary = true;
    setModal({ ...modal, teachers: list });
  }
  function setPrimary(id) {
    setModal({ ...modal, teachers: modal.teachers.map((t) => ({ ...t, is_primary: t.teacher_id === id })) });
  }

  // --- tạo từ học viên có sẵn ---
  const fromStudents = allStudents.filter((s) => (modal?.srcClasses || []).includes(s.class_id));
  function toggleSrc(id) {
    const has = modal.srcClasses.includes(id);
    const srcClasses = has ? modal.srcClasses.filter((x) => x !== id) : [...modal.srcClasses, id];
    // giữ lại lựa chọn học viên vẫn còn hiển thị
    const visible = new Set(allStudents.filter((s) => srcClasses.includes(s.class_id)).map((s) => s.id));
    setModal({ ...modal, srcClasses, picked: modal.picked.filter((x) => visible.has(x)) });
  }
  function togglePick(id) {
    const has = modal.picked.includes(id);
    setModal({ ...modal, picked: has ? modal.picked.filter((x) => x !== id) : [...modal.picked, id] });
  }
  const allPicked = fromStudents.length > 0 && fromStudents.every((s) => modal.picked.includes(s.id));
  function toggleAllPick() {
    setModal({ ...modal, picked: allPicked ? [] : fromStudents.map((s) => s.id) });
  }

  // vị trí lên lớp (senior -> junior)
  const seniorToJunior = [...classes].sort((a, b) => b.order_index - a.order_index);

  async function save() {
    setError('');
    if (!modal.name.trim()) { setError('Thiếu tên lớp'); return; }
    try {
      if (modal.mode === 'edit') {
        await api.put(`/classes/${modal.id}`, {
          name: modal.name, year: modal.year, room: modal.room, schedule: modal.schedule,
          promotes: modal.promotes, teachers: modal.teachers,
        });
        setModal(null); load();
        return;
      }
      // lớp bật "tự động lên lớp" -> đưa lên trên cùng bảng thứ tự (order lớn nhất)
      const maxOrder = classes.filter((c) => c.promotes).reduce((m, c) => Math.max(m, c.order_index || 0), 0);
      // tạo lớp mới (chế độ 'from' = lớp gộp)
      const r = await api.post('/classes', {
        name: modal.name, year: modal.year, room: modal.room, schedule: modal.schedule,
        promotes: modal.promotes, teachers: modal.teachers, merged: modal.mode === 'from',
        order_index: modal.promotes ? maxOrder + 1 : 0,
      });
      const newId = r.data.id;
      // chuyển học viên (chế độ tạo từ có sẵn) — ghi nhớ lớp cũ để trả về sau
      if (modal.mode === 'from') {
        const visible = new Set(fromStudents.map((s) => s.id));
        const ids = modal.picked.filter((x) => visible.has(x));
        if (ids.length) await api.post('/students/move', { ids, class_id: newId, remember: true });
      }
      setModal(null); load();
      if (isAdmin) api.get('/students').then((res) => setAllStudents(res.data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Lưu thất bại');
    }
  }

  async function remove(c) {
    if (!confirm(`Xóa lớp "${c.name}"? Học viên trong lớp sẽ trở về "chưa xếp lớp".`)) return;
    await api.delete(`/classes/${c.id}`);
    load();
  }

  // --- sắp xếp thứ tự lớp ---
  function openOrder() { setOrderList(seniorToJunior.filter((c) => c.promotes).map((c) => ({ id: c.id, name: c.name }))); }
  function moveOrder(i, dir) {
    const j = i + dir; if (j < 0 || j >= orderList.length) return;
    const list = [...orderList]; [list[i], list[j]] = [list[j], list[i]]; setOrderList(list);
  }
  async function saveOrder() {
    await api.post('/classes/reorder', { ids: orderList.map((c) => c.id) });
    setOrderList(null); load();
  }

  // --- ghi bí tích / chứng chỉ cả lớp ---
  async function openSac(c) {
    setSac({ cls: c, students: null, picked: [], kind: 'sacrament', sacrament: 'them_suc', certName: '', date: '', msg: '', err: '' });
    const r = await api.get(`/students?class_id=${c.id}`);
    setSac((s) => (s && s.cls.id === c.id ? { ...s, students: r.data, picked: r.data.map((x) => x.id) } : s));
  }
  const sacAll = sac?.students && sac.students.length > 0 && sac.students.every((s) => sac.picked.includes(s.id));
  function sacToggleAll() { setSac({ ...sac, picked: sacAll ? [] : sac.students.map((s) => s.id) }); }
  function sacTogglePick(id) { setSac({ ...sac, picked: sac.picked.includes(id) ? sac.picked.filter((x) => x !== id) : [...sac.picked, id] }); }
  async function saveSac() {
    if (!sac.picked.length) { setSac({ ...sac, err: 'Chưa chọn học viên' }); return; }
    if (!sac.date) { setSac({ ...sac, err: 'Vui lòng chọn ngày lãnh nhận.' }); return; }
    if (sac.kind === 'cert' && !sac.certName.trim()) { setSac({ ...sac, err: 'Nhập tên chứng chỉ.' }); return; }
    if (sac.kind === 'sacrament') {
      const newR = SAC_RANK[sac.sacrament] ?? 0;
      const bad = (sac.students || []).filter((s) => sac.picked.includes(s.id) && (SAC_RANK[s.sacrament] || 0) > newR);
      if (bad.length) {
        setSac({ ...sac, err: `Sai thứ tự bí tích (Rước lễ trước, Thêm Sức sau). Các em đã ở bậc cao hơn: ${bad.map((s) => s.full_name).join(', ')}. Hãy bỏ chọn các em này.` });
        return;
      }
    }
    try {
      if (sac.kind === 'sacrament') {
        const r = await api.post('/students/sacrament', { ids: sac.picked, sacrament: sac.sacrament, date: sac.date });
        setSac({ ...sac, msg: `Đã ghi bí tích cho ${r.data.count} em`, err: '' });
      } else {
        const r = await api.post('/students/certificate', { ids: sac.picked, name: sac.certName.trim(), date: sac.date });
        setSac({ ...sac, msg: `Đã ghi chứng chỉ cho ${r.data.count} em`, err: '' });
      }
      load();
    } catch (e) { setSac({ ...sac, err: e.response?.data?.error || 'Lưu thất bại' }); }
  }

  // ---- xem & chỉnh danh sách học viên của 1 lớp ----
  async function openDetail(c) {
    setDetail({ cls: c, students: null, picked: [] });
    const r = await api.get(`/students?class_id=${c.id}`);
    setDetail((d) => (d && d.cls.id === c.id ? { ...d, students: r.data } : d));
  }
  async function reloadDetail() {
    load();
    if (!detail) return;
    const r = await api.get(`/students?class_id=${detail.cls.id}`);
    setDetail((d) => (d ? { ...d, students: r.data, picked: d.picked.filter((id) => r.data.some((s) => s.id === id)) } : d));
  }
  const dAll = detail?.students && detail.students.length > 0 && detail.students.every((s) => detail.picked.includes(s.id));
  const dToggleAll = () => setDetail({ ...detail, picked: dAll ? [] : detail.students.map((s) => s.id) });
  const dTogglePick = (id) => setDetail({ ...detail, picked: detail.picked.includes(id) ? detail.picked.filter((x) => x !== id) : [...detail.picked, id] });
  async function removeStudent(s) { if (!confirm(`Xóa học viên "${s.full_name}"?`)) return; await api.delete(`/students/${s.id}`); reloadDetail(); }
  async function saveStudent() {
    try { await api.put(`/students/${stEdit.id}`, stEdit); setStEdit(null); reloadDetail(); }
    catch (e) { alert(e.response?.data?.error || 'Lưu thất bại'); }
  }
  async function doMove() {
    await api.post('/students/move', { ids: mv.ids, class_id: mv.dest });
    setMv(null); setDetail((d) => (d ? { ...d, picked: [] } : d)); reloadDetail();
  }
  async function returnStudents(ids) {
    if (!ids.length || !confirm('Trả các em đã chọn về lớp cũ (trước khi gộp)?')) return;
    const r = await api.post('/students/return', { ids });
    setDetail((d) => (d ? { ...d, picked: [] } : d)); reloadDetail();
    if (!r.data.returned) alert('Các em này không có lớp cũ để trả về.');
  }
  async function openHist(c) {
    setHist({ cls: c, rows: null });
    const r = await api.get(`/class-history?class_id=${c.id}`);
    setHist((h) => (h && h.cls.id === c.id ? { ...h, rows: r.data } : h));
  }
  const histYears = hist?.rows ? [...new Set(hist.rows.map((r) => r.year).filter(Boolean))].sort().reverse() : [];
  const histStudents = (() => {
    if (!hist?.rows) return [];
    const m = {};
    hist.rows.forEach((r) => { const o = m[r.now_id] || (m[r.now_id] = { id: r.now_id, saint_name: r.saint_name, full_name: r.full_name, y: {} }); if (r.year) o.y[r.year] = r.avg; });
    return Object.values(m).sort((a, b) => byViName(a, b));
  })();

  const showActions = isAdmin || isTeacher;
  const colCount = 6 + (showActions ? 1 : 0);

  return (
    <div>
      <h1>Quản lý lớp học</h1>
      {isAdmin && (
        <div className="toolbar">
          <button className="btn" onClick={openCreate}>+ Thêm lớp</button>
          <button className="btn ghost" onClick={openOrder} disabled={classes.length < 2}>⚙ Cài đặt lớp học</button>
        </div>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Tên lớp</th><th>Niên khóa</th><th>Phòng</th><th>Thời gian</th>
              <th>Giáo lý viên</th><th>Sĩ số</th>{showActions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="link-name" onClick={() => openDetail(c)}>{c.name}</span>
                  {c.merged && <span className="tag-chip merged" style={{ marginLeft: 6 }}>● lớp gộp</span>}
                  {c.promotes === false && <span className="tag-chip muted" style={{ marginLeft: 6 }}>không lên lớp</span>}
                </td>
                <td>{c.year || '—'}</td>
                <td>{c.room || '—'}</td>
                <td>{c.schedule || '—'}</td>
                <td>{c.teacher_name || <span className="muted">Chưa phân công</span>}</td>
                <td>{c.student_count}</td>
                {showActions && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => openSac(c)}>✝ Ghi bí tích</button>{' '}
                    {isAdmin && <><button className="btn ghost sm" onClick={() => openEdit(c)}>Sửa</button>{' '}
                      <button className="btn danger sm" onClick={() => remove(c)}>Xóa</button></>}
                  </td>
                )}
              </tr>
            ))}
            {classes.length === 0 && <tr><td colSpan={colCount} className="muted">Chưa có lớp nào</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Danh sách học viên của lớp được chọn */}
      {detail && (
        <div className="panel">
          <div className="card-head">
            <h2>Danh sách lớp {detail.cls.name} {detail.cls.merged && <span className="tag-chip merged">● lớp gộp</span>}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn ghost sm" onClick={() => openHist(detail.cls)}>📈 Lịch sử lớp</button>
              <span className="link" onClick={() => setDetail(null)}>Đóng ✕</span>
            </div>
          </div>
          {detail.cls.merged && <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>Lớp gộp: chỉ dùng cho lớp giáo lý hè / ngoại khóa. Sau khi kết thúc, có thể trả từng em về lớp cũ.</p>}
          {detail.students === null ? <div className="muted">Đang tải...</div> : (
            <>
              {detail.picked.length > 0 && (
                <div className="toolbar" style={{ marginBottom: 10 }}>
                  <span className="muted">Đã chọn {detail.picked.length}</span>
                  <button className="btn ghost sm" onClick={() => setMv({ ids: [...detail.picked], dest: '' })}>Chuyển lớp đã chọn</button>
                  {detail.cls.merged && <button className="btn ghost sm" onClick={() => returnStudents([...detail.picked])}>Trả về lớp cũ</button>}
                </div>
              )}
              <table>
                <thead><tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={dAll} onChange={dToggleAll} /></th>
                  <th>Tên thánh</th><th>Họ tên</th><th>Chức vụ</th><th>Ngày sinh</th><th>SĐT phụ huynh</th><th></th>
                </tr></thead>
                <tbody>
                  {detail.students.map((s) => (
                    <tr key={s.id}>
                      <td><input type="checkbox" checked={detail.picked.includes(s.id)} onChange={() => dTogglePick(s.id)} /></td>
                      <td>{s.saint_name || '—'}</td>
                      <td><div className="stu-cell"><Avatar url={s.avatar_url} name={s.full_name} size={28} /><span className="link-name" onClick={() => navigate(`/students/${s.id}`)}>{s.full_name}</span></div></td>
                      <td>{s.position ? <span className="role-chip">{s.position}</span> : <span className="muted">—</span>}</td>
                      <td>{s.birth_date || '—'}</td>
                      <td>{s.father_phone || s.mother_phone || s.parent_phone || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn ghost sm" onClick={() => setStEdit({ ...s, class_id: s.class_id || '' })}>Sửa</button>{' '}
                        <button className="btn ghost sm" onClick={() => setMv({ ids: [s.id], dest: '' })}>Chuyển lớp</button>{' '}
                        {detail.cls.merged && s.prev_class_id && <button className="btn ghost sm" onClick={() => returnStudents([s.id])}>Trở về lớp cũ</button>}{' '}
                        <button className="btn danger sm" onClick={() => removeStudent(s)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                  {detail.students.length === 0 && <tr><td colSpan={7} className="muted">Lớp chưa có học viên.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Modal chuyển lớp */}
      {mv && (
        <div className="modal-backdrop" onClick={() => setMv(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Chuyển {mv.ids.length} học viên sang lớp khác</h2>
            <div className="field"><label>Lớp đích</label>
              <select value={mv.dest} onChange={(e) => setMv({ ...mv, dest: e.target.value })}>
                <option value="">-- Chọn lớp --</option>
                {classes.filter((c) => c.id !== detail?.cls.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setMv(null)}>Hủy</button>
              <button className="btn" onClick={doMove} disabled={!mv.dest}>Chuyển</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa học viên */}
      {stEdit && (
        <div className="modal-backdrop" onClick={() => setStEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sửa học viên</h2>
            <StudentForm form={stEdit} setForm={setStEdit} classes={classes} />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setStEdit(null)}>Hủy</button>
              <button className="btn" onClick={saveStudent}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lịch sử lớp */}
      {hist && (
        <div className="modal-backdrop" onClick={() => setHist(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>Lịch sử lớp {hist.cls.name}</h2>
            <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>Điểm TB của từng em qua các năm (theo hồ sơ đã lên lớp).</p>
            {hist.rows === null ? <div className="muted">Đang tải...</div> : histStudents.length === 0 ? (
              <div className="muted">Chưa có dữ liệu lịch sử cho lớp này.</div>
            ) : (
              <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                <table>
                  <thead><tr><th>Học viên</th>{histYears.map((y) => <th key={y} style={{ textAlign: 'center' }}>{y}</th>)}</tr></thead>
                  <tbody>
                    {histStudents.map((s) => (
                      <tr key={s.id}>
                        <td>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</td>
                        {histYears.map((y) => <td key={y} style={{ textAlign: 'center', fontWeight: s.y[y] != null ? 700 : 400 }}>{s.y[y] != null ? s.y[y] : '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions"><button className="btn ghost" onClick={() => setHist(null)}>Đóng</button></div>
          </div>
        </div>
      )}

      {/* Modal thêm/sửa lớp */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className={`modal ${modal.mode === 'from' ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h2>{modal.mode === 'edit' ? 'Sửa lớp' : 'Thêm lớp'}</h2>

            {modal.mode !== 'edit' && (
              <div className="seg" style={{ marginBottom: 16 }}>
                <button className={`seg-btn ${modal.mode === 'new' ? 'on' : ''}`} onClick={() => setModal({ ...modal, mode: 'new' })}>Tạo mới hoàn toàn</button>
                <button className={`seg-btn ${modal.mode === 'from' ? 'on' : ''}`} onClick={() => setModal({ ...modal, mode: 'from' })}>Tạo từ học viên có sẵn</button>
              </div>
            )}

            <div className={modal.mode === 'from' ? 'from-grid' : ''}>
              <div>
                <div className="field">
                  <label>Tên lớp *</label>
                  <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="VD: Khai tâm 1" />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Niên khóa</label>
                    <input value={modal.year} onChange={(e) => setModal({ ...modal, year: e.target.value })} placeholder="VD: 2025-2026" />
                  </div>
                  <div className="field">
                    <label>Phòng học</label>
                    <input value={modal.room} onChange={(e) => setModal({ ...modal, room: e.target.value })} placeholder="VD: A102" />
                  </div>
                  <div className="field">
                    <label>Thời gian học</label>
                    <select value={modal.schedule} onChange={(e) => setModal({ ...modal, schedule: e.target.value })}>
                      <option value="">—</option>
                      {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="toggle-row" style={{ padding: '10px 0' }}>
                  <span>Tự động lên lớp cho năm sau<br /><span className="muted" style={{ fontSize: 12 }}>Bật: lớp nằm trong bảng thứ tự lên lớp. Tắt: lớp hè/dự tòng/hôn nhân/GLV (học 1 lần, không lên lớp)</span></span>
                  <button className={`switch ${modal.promotes ? 'on' : ''}`} onClick={() => setModal({ ...modal, promotes: !modal.promotes })} role="switch" aria-checked={modal.promotes}><span className="knob" /></button>
                </div>

                <div className="field">
                  <label>Giáo lý viên phụ trách (chọn nhiều, đánh dấu 1 người chính)</label>
                  <div className="teacher-picker">
                    {teachers.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Chưa có giáo lý viên nào.</div>}
                    {teachers.map((t) => (
                      <div className="tp-row" key={t.id}>
                        <label className="tp-check">
                          <input type="checkbox" checked={isAssigned(t.id)} onChange={() => toggleTeacher(t.id)} />
                          <span>{t.full_name}</span>
                        </label>
                        {isAssigned(t.id) && (
                          <label className="tp-primary">
                            <input type="radio" name="primary" checked={modal.teachers.find((x) => x.teacher_id === t.id)?.is_primary || false} onChange={() => setPrimary(t.id)} />
                            <span>chính</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {modal.mode === 'from' && (
                <div>
                  <div className="fp-label">Lấy học viên từ lớp (tích nhiều lớp)</div>
                  <div className="fp-classes" style={{ marginBottom: 12 }}>
                    {classes.map((c) => (
                      <label key={c.id} className="fp-chk">
                        <input type="checkbox" checked={modal.srcClasses.includes(c.id)} onChange={() => toggleSrc(c.id)} />
                        <span>{c.name} ({c.student_count})</span>
                      </label>
                    ))}
                  </div>
                  <div className="fp-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Học viên ({modal.picked.length}/{fromStudents.length})</span>
                    {fromStudents.length > 0 && <span className="link" onClick={toggleAllPick}>{allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>}
                  </div>
                  <div className="pick-list">
                    {fromStudents.map((s) => (
                      <label key={s.id} className="fp-chk">
                        <input type="checkbox" checked={modal.picked.includes(s.id)} onChange={() => togglePick(s.id)} />
                        <span>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name} <span className="muted">· {s.class_name}</span></span>
                      </label>
                    ))}
                    {fromStudents.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Tích chọn lớp nguồn để hiện học viên.</div>}
                  </div>
                  <p className="muted" style={{ fontSize: 12 }}>Học viên được chọn sẽ <b>chuyển sang lớp mới</b> (rời lớp cũ).</p>
                </div>
              )}
            </div>

            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sắp xếp thứ tự lớp */}
      {orderList && (
        <div className="modal-backdrop" onClick={() => setOrderList(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cài đặt thứ tự lớp</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Sắp xếp để dùng tính năng <b>tự động lên lớp</b>. <b>Trên cùng là lớp lớn nhất</b> (ra trường khi lên lớp),
              dưới cùng là lớp nhỏ nhất. Bật "Tự động lên lớp" ở Cài đặt quản lý.
            </p>
            <div className="order-list">
              {orderList.map((c, i) => (
                <div className="order-row" key={c.id}>
                  <span>{c.name}</span>
                  <span className="order-arrows">
                    <button className="btn ghost sm" disabled={i === 0} onClick={() => moveOrder(i, -1)}>▲</button>
                    <button className="btn ghost sm" disabled={i === orderList.length - 1} onClick={() => moveOrder(i, 1)}>▼</button>
                  </span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setOrderList(null)}>Hủy</button>
              <button className="btn" onClick={saveOrder}>Lưu thứ tự</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ghi bí tích / chứng chỉ cả lớp */}
      {sac && (
        <div className="modal-backdrop" onClick={() => setSac(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Ghi bí tích / chứng chỉ — {sac.cls.name}</h2>
            <div className="seg" style={{ marginBottom: 14 }}>
              <button className={`seg-btn ${sac.kind === 'sacrament' ? 'on' : ''}`} onClick={() => setSac({ ...sac, kind: 'sacrament' })}>Bí tích</button>
              <button className={`seg-btn ${sac.kind === 'cert' ? 'on' : ''}`} onClick={() => setSac({ ...sac, kind: 'cert' })}>Chứng chỉ / khóa</button>
            </div>
            <div className="grid-2">
              {sac.kind === 'sacrament' ? (
                <div className="field"><label>Bí tích</label>
                  <select value={sac.sacrament} onChange={(e) => setSac({ ...sac, sacrament: e.target.value })}>
                    <option value="ruoc_le">{SACRAMENTS.ruoc_le.label}</option>
                    <option value="them_suc">{SACRAMENTS.them_suc.label}</option>
                  </select>
                </div>
              ) : (
                <div className="field"><label>Tên chứng chỉ</label>
                  <input list="cert-suggest-bulk" value={sac.certName} onChange={(e) => setSac({ ...sac, certName: e.target.value })} placeholder="VD: Hoàn thành giáo lý hôn nhân" />
                  <datalist id="cert-suggest-bulk">{CERT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
                </div>
              )}
              <div className="field"><label>Ngày lãnh nhận *</label><input type="date" value={sac.date} onChange={(e) => setSac({ ...sac, date: e.target.value })} /></div>
            </div>

            <div className="fp-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Học viên ({sac.picked.length}/{sac.students?.length || 0})</span>
              {sac.students?.length > 0 && <span className="link" onClick={sacToggleAll}>{sacAll ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>}
            </div>
            <div className="pick-list">
              {sac.students === null && <div className="muted" style={{ fontSize: 13 }}>Đang tải...</div>}
              {(sac.students || []).map((s) => (
                <label key={s.id} className="fp-chk sac-row">
                  <input type="checkbox" checked={sac.picked.includes(s.id)} onChange={() => sacTogglePick(s.id)} />
                  <span>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</span>
                  <span className="sac-cur">{SACRAMENTS[s.sacrament]?.label || SACRAMENTS.none.label}</span>
                </label>
              ))}
              {sac.students?.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Lớp chưa có học viên.</div>}
            </div>

            {sac.msg && <div className="info-box">{sac.msg}</div>}
            {sac.err && <div className="error">{sac.err}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setSac(null)}>Đóng</button>
              <button className="btn" onClick={saveSac} disabled={sac.students === null}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
