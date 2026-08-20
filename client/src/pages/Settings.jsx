import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';

// Trang cài đặt quản lý của admin: giáo xứ, năm học, lên lớp cuối năm,
// tùy chọn bật/tắt, danh sách học viên đã ra trường.
export default function Settings() {
  const { user } = useAuth();
  const [parish, setParish] = useState(null);
  const [years, setYears] = useState([]);
  const [graduated, setGraduated] = useState([]);
  const [gSearch, setGSearch] = useState('');
  const [newYear, setNewYear] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const settings = parish?.settings || {};
  const flag = (k) => settings[k] !== false; // mặc định ON

  function loadAll() {
    api.get('/parish').then((r) => setParish(r.data));
    api.get('/school-years').then((r) => setYears(r.data));
    api.get('/students?graduated=1').then((r) => setGraduated(r.data));
  }
  useEffect(() => { loadAll(); }, []);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được truy cập cài đặt.</div>;
  if (!parish) return <div className="muted">Đang tải...</div>;

  function flash(m) { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500); }
  function fail(e) { setErr(e); setMsg(''); }

  async function saveParish(patch) {
    try {
      const r = await api.put('/parish', patch);
      setParish(r.data);
      flash('Đã lưu');
    } catch (e) { fail(e.response?.data?.error || 'Lưu thất bại'); }
  }

  async function toggle(k) {
    await saveParish({ settings: { ...settings, [k]: !flag(k) } });
  }

  async function addYear() {
    if (!newYear.trim()) return;
    try {
      await api.post('/school-years', { name: newYear.trim() });
      setNewYear('');
      api.get('/school-years').then((r) => setYears(r.data));
      flash('Đã thêm năm học');
    } catch (e) { fail(e.response?.data?.error || 'Thêm thất bại'); }
  }
  async function setCurrent(id) {
    await api.post(`/school-years/${id}/current`, {});
    api.get('/school-years').then((r) => setYears(r.data));
    api.get('/parish').then((r) => setParish(r.data));
    flash('Đã đặt năm học hiện tại');
  }
  async function delYear(id) {
    if (!confirm('Xóa năm học này?')) return;
    await api.delete(`/school-years/${id}`);
    api.get('/school-years').then((r) => setYears(r.data));
  }

  async function promote() {
    if (!confirm(
      'KẾT THÚC NĂM HỌC & LÊN LỚP\n\n' +
      'Toàn bộ học viên sẽ được chuyển lên lớp kế tiếp (theo thứ tự lớp). ' +
      'Học viên ở lớp cao nhất sẽ chuyển vào mục "Đã ra trường".\n\n' +
      'Thao tác này ảnh hưởng hàng loạt. Bạn chắc chắn?'
    )) return;
    try {
      const r = await api.post('/promote', {});
      flash(`Đã lên lớp ${r.data.promoted} học viên, ${r.data.graduated} em ra trường.`);
      loadAll();
    } catch (e) { fail(e.response?.data?.error || 'Lên lớp thất bại'); }
  }

  const gFiltered = graduated.filter((s) =>
    (s.full_name + ' ' + (s.saint_name || '')).toLowerCase().includes(gSearch.toLowerCase()));

  return (
    <div>
      <h1>Cài đặt quản lý</h1>
      {msg && <div className="info-box">{msg}</div>}
      {err && <div className="error">{err}</div>}

      {/* Giáo xứ */}
      <div className="panel">
        <div className="card-head"><h2>Thông tin giáo xứ</h2></div>
        <div className="settings-grid">
          <div className="field">
            <label>Tên giáo xứ</label>
            <input defaultValue={parish.name || ''} onBlur={(e) => e.target.value !== parish.name && saveParish({ name: e.target.value })} />
          </div>
          <div className="field">
            <label>Giáo phận</label>
            <input defaultValue={parish.diocese || ''} onBlur={(e) => e.target.value !== parish.diocese && saveParish({ diocese: e.target.value })} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Logo & giao diện theo năm phụng vụ sẽ bổ sung sau. Thông tin tự lưu khi rời khỏi ô.</p>
      </div>

      {/* Tùy chọn quản lý (on/off) */}
      <div className="panel">
        <div className="card-head"><h2>Tùy chọn quản lý</h2></div>
        <ToggleRow label="Quản lý theo năm học giáo lý" on={flag('manage_by_school_year')} onClick={() => toggle('manage_by_school_year')} />
        <ToggleRow label="Tự động lên lớp cuối mỗi năm học" on={flag('auto_promote')} onClick={() => toggle('auto_promote')} />
        <ToggleRow label="Hiển thị mục học viên đã ra trường" on={flag('show_graduated')} onClick={() => toggle('show_graduated')} />
      </div>

      {/* Năm học */}
      {flag('manage_by_school_year') && (
        <div className="panel">
          <div className="card-head"><h2>Năm học giáo lý</h2></div>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="VD: 2026-2027" style={{ maxWidth: 200 }} />
            <button className="btn" onClick={addYear}>+ Thêm năm học</button>
          </div>
          <table>
            <thead><tr><th>Năm học</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td>{y.name}</td>
                  <td>{y.is_current ? <span className="pct">Hiện tại</span> : <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!y.is_current && <button className="btn ghost sm" onClick={() => setCurrent(y.id)}>Đặt hiện tại</button>}{' '}
                    <button className="btn danger sm" onClick={() => delYear(y.id)}>Xóa</button>
                  </td>
                </tr>
              ))}
              {years.length === 0 && <tr><td colSpan={3} className="muted">Chưa có năm học nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Lên lớp cuối năm */}
      {flag('auto_promote') && (
        <div className="panel">
          <div className="card-head"><h2>Kết thúc năm học & lên lớp</h2></div>
          <p className="muted" style={{ marginTop: 0 }}>
            Chuyển toàn bộ học viên lên lớp kế tiếp theo <b>thứ tự lớp</b> đã đặt ở trang Lớp học.
            Học viên ở lớp cao nhất sẽ vào mục "Đã ra trường".
          </p>
          <button className="btn" onClick={promote}>⬆ Lên lớp cho cả giáo xứ</button>
        </div>
      )}

      {/* Đã ra trường */}
      {flag('show_graduated') && (
        <div className="panel">
          <div className="card-head"><h2>Học viên đã ra trường ({graduated.length})</h2></div>
          <input value={gSearch} onChange={(e) => setGSearch(e.target.value)} placeholder="Tìm theo tên..." style={{ marginBottom: 12, maxWidth: 280 }} />
          <table>
            <thead><tr><th>Tên thánh</th><th>Họ tên</th><th>Lớp cuối</th></tr></thead>
            <tbody>
              {gFiltered.map((s) => (
                <tr key={s.id}><td>{s.saint_name || '—'}</td><td>{s.full_name}</td><td>{s.class_name || '—'}</td></tr>
              ))}
              {gFiltered.length === 0 && <tr><td colSpan={3} className="muted">Chưa có học viên ra trường</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, on, onClick }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button className={`switch ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on}>
        <span className="knob" />
      </button>
    </div>
  );
}
