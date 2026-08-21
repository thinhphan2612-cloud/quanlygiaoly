import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';

const emptyCreate = { email: '', password: '', full_name: '' };

export default function Teachers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // {mode:'create'} | {mode:'edit', ...profile}
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() { api.get('/auth/users').then((r) => setUsers(r.data)); }
  useEffect(() => { if (user?.role === 'admin') load(); }, [user]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được quản lý tài khoản.</div>;

  function openCreate() { setError(''); setModal({ mode: 'create', ...emptyCreate }); }
  function openEdit(u) { setError(''); setModal({ mode: 'edit', ...u }); }
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.value });

  async function save() {
    setError(''); setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api.post('/auth/users', { email: modal.email, password: modal.password, full_name: modal.full_name });
      } else {
        await api.put(`/auth/users/${modal.id}`, modal);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Lưu thất bại');
    } finally { setSaving(false); }
  }

  async function remove(u) {
    if (!confirm(`Xóa tài khoản "${u.full_name}"? Giáo lý viên sẽ mất quyền truy cập.`)) return;
    try { await api.delete(`/auth/users/${u.id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Xóa thất bại'); }
  }

  return (
    <div>
      <h1>Quản lý giáo lý viên</h1>
      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Thêm giáo lý viên</button>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Họ tên</th><th>Email</th><th>Cấp</th><th>Khu vực</th><th>SĐT</th><th>Lớp phụ trách</th><th>Vai trò</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.saint_name ? u.saint_name + ' ' : ''}{u.full_name}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.glv_level || '—'}</td>
                  <td>{u.area || '—'}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{u.classes?.length ? u.classes.join(', ') : <span className="muted">—</span>}</td>
                  <td>{u.role === 'admin' ? 'Quản trị' : 'Giáo lý viên'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => openEdit(u)}>Sửa hồ sơ</button>{' '}
                    {u.role !== 'admin' && <button className="btn danger sm" onClick={() => remove(u)}>Xóa</button>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={8} className="muted">Chưa có tài khoản</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.mode === 'create' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Thêm giáo lý viên</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Tạo tài khoản đăng nhập cho giáo lý viên. Họ dùng email + mật khẩu này để đăng nhập.</p>
            <div className="field"><label>Họ tên *</label><input value={modal.full_name} onChange={set('full_name')} autoFocus /></div>
            <div className="field"><label>Email đăng nhập *</label><input type="email" value={modal.email} onChange={set('email')} placeholder="glv@email.com" /></div>
            <div className="field"><label>Mật khẩu * (tối thiểu 6 ký tự)</label><input type="password" value={modal.password} onChange={set('password')} /></div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
            </div>
          </div>
        </div>
      )}

      {modal?.mode === 'edit' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Hồ sơ: {modal.full_name}</h2>
            <div className="row">
              <div className="field"><label>Tên thánh</label><input value={modal.saint_name || ''} onChange={set('saint_name')} /></div>
              <div className="field"><label>Họ tên</label><input value={modal.full_name || ''} onChange={set('full_name')} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Ngày sinh</label><input type="date" value={modal.birth_date || ''} onChange={set('birth_date')} /></div>
              <div className="field"><label>Cấp giáo lý viên</label><input value={modal.glv_level || ''} onChange={set('glv_level')} placeholder="VD: Cấp 1, Cấp 2 (để trống nếu chưa)" /></div>
            </div>
            <div className="row">
              <div className="field"><label>Khu vực</label><input value={modal.area || ''} onChange={set('area')} placeholder="VD: Khu 3" /></div>
              <div className="field"><label>Nghề nghiệp</label><input value={modal.occupation || ''} onChange={set('occupation')} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Số điện thoại</label><input value={modal.phone || ''} onChange={set('phone')} /></div>
              <div className="field"><label>Địa chỉ</label><input value={modal.address || ''} onChange={set('address')} /></div>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Lớp phụ trách được phân công ở trang "Lớp học".</p>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
