import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';

const empty = { name: '', year: '', order_index: '', room: '', schedule: '', teachers: [] };
const SCHEDULES = ['Sáng', 'Chiều', 'Tối'];

export default function Classes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/classes').then((r) => setClasses(r.data)); }
  useEffect(() => {
    load();
    if (isAdmin) api.get('/auth/users').then((r) => setTeachers(r.data)).catch(() => {});
  }, [isAdmin]);

  function openCreate() { setError(''); setModal({ ...empty, teachers: [] }); }
  function openEdit(c) {
    setError('');
    setModal({
      ...c, year: c.year || '', order_index: c.order_index ?? '', room: c.room || '', schedule: c.schedule || '',
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

  async function save() {
    setError('');
    try {
      const payload = {
        name: modal.name, year: modal.year, order_index: modal.order_index,
        room: modal.room, schedule: modal.schedule, teachers: modal.teachers,
      };
      if (modal.id) await api.put(`/classes/${modal.id}`, payload);
      else await api.post('/classes', payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Lưu thất bại');
    }
  }

  async function remove(c) {
    if (!confirm(`Xóa lớp "${c.name}"? Học viên trong lớp sẽ trở về "chưa xếp lớp".`)) return;
    await api.delete(`/classes/${c.id}`);
    load();
  }

  return (
    <div>
      <h1>Quản lý lớp học</h1>
      {isAdmin && (
        <div className="toolbar">
          <button className="btn" onClick={openCreate}>+ Thêm lớp</button>
        </div>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Tên lớp</th><th>Niên khóa</th><th>Phòng</th><th>Thời gian</th>
              <th>Giáo lý viên</th><th>Sĩ số</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.year || '—'}</td>
                <td>{c.room || '—'}</td>
                <td>{c.schedule || '—'}</td>
                <td>{c.teacher_name || <span className="muted">Chưa phân công</span>}</td>
                <td>{c.student_count}</td>
                {isAdmin && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => openEdit(c)}>Sửa</button>{' '}
                    <button className="btn danger sm" onClick={() => remove(c)}>Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {classes.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="muted">Chưa có lớp nào</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Sửa lớp' : 'Thêm lớp'}</h2>
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
                <label>Thứ tự lớp (để tự lên lớp)</label>
                <input type="number" min="0" value={modal.order_index} onChange={(e) => setModal({ ...modal, order_index: e.target.value })} placeholder="1, 2, 3..." />
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
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
