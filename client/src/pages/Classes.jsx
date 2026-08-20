import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';

const empty = { name: '', year: '', teacher_id: '', order_index: '' };

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

  function openCreate() { setError(''); setModal({ ...empty }); }
  function openEdit(c) { setError(''); setModal({ ...c, year: c.year || '', teacher_id: c.teacher_id || '', order_index: c.order_index ?? '' }); }

  async function save() {
    setError('');
    try {
      const payload = { ...modal, teacher_id: modal.teacher_id || null };
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
            <tr><th>Tên lớp</th><th>Niên khóa</th><th>Giáo lý viên</th><th>Sĩ số</th>{isAdmin && <th></th>}</tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.year || '—'}</td>
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
            {classes.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="muted">Chưa có lớp nào</td></tr>}
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
            <div className="field">
              <label>Niên khóa</label>
              <input value={modal.year || ''} onChange={(e) => setModal({ ...modal, year: e.target.value })} placeholder="VD: 2025-2026" />
            </div>
            <div className="field">
              <label>Thứ tự lớp (để tự lên lớp cuối năm)</label>
              <input type="number" min="0" value={modal.order_index ?? ''} onChange={(e) => setModal({ ...modal, order_index: e.target.value })} placeholder="VD: 1 = lớp nhỏ nhất, tăng dần" />
            </div>
            <div className="field">
              <label>Giáo lý viên phụ trách</label>
              <select value={modal.teacher_id || ''} onChange={(e) => setModal({ ...modal, teacher_id: e.target.value })}>
                <option value="">Chưa phân công</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
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
