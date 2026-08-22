import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { ACCENTS, applyTheme, loadTheme } from '../theme.js';
import { isPro } from '../lib/plans';
import { useEntitlements } from '../entitlements.jsx';
import { useParish } from '../parish.jsx';
import { fileToDataUrl } from '../lib/img';

// Trang cài đặt quản lý của admin: giáo xứ, năm học, lên lớp cuối năm,
// tùy chọn bật/tắt, danh sách học viên đã ra trường.
export default function Settings() {
  const { user } = useAuth();
  const { parish, saveParish: ctxSave, reload: reloadParish } = useParish();
  const [pInfo, setPInfo] = useState({ name: '', diocese: '' });
  const [years, setYears] = useState([]);
  const [graduated, setGraduated] = useState([]);
  const [gSearch, setGSearch] = useState('');
  const [newYear, setNewYear] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState(loadTheme());
  const [features, setFeatures] = useState([]);
  const ent = useEntitlements();

  const settings = parish?.settings || {};
  const flag = (k) => settings[k] !== false; // mặc định ON

  function loadAll() {
    api.get('/school-years').then((r) => setYears(r.data));
    api.get('/students?graduated=1').then((r) => setGraduated(r.data));
    api.get('/features').then((r) => setFeatures(r.data)).catch(() => {});
  }
  useEffect(() => { loadAll(); }, []);
  // Đồng bộ ô nhập tên/giáo phận khi tải xong thông tin giáo xứ
  useEffect(() => { if (parish) setPInfo({ name: parish.name || '', diocese: parish.diocese || '' }); }, [parish?.id]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được truy cập cài đặt.</div>;
  if (!parish) return <div className="muted">Đang tải...</div>;

  function flash(m) { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500); }
  function fail(e) { setErr(e); setMsg(''); }

  async function saveParish(patch) {
    try { await ctxSave(patch); flash('Đã lưu'); }
    catch (e) { fail(e.response?.data?.error || 'Lưu thất bại'); }
  }

  async function toggle(k) {
    await saveParish({ settings: { ...settings, [k]: !flag(k) } });
  }

  function setAccent(a) { const t = { ...theme, accent: a }; applyTheme(t); setTheme(t); }
  function setMode(m) { const t = { ...theme, mode: m }; applyTheme(t); setTheme(t); }
  async function uploadLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await fileToDataUrl(file); await saveParish({ logo_url: url }); }
    catch { fail('Không đọc được ảnh'); }
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
    reloadParish();
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
            <input value={pInfo.name} onChange={(e) => setPInfo({ ...pInfo, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Giáo phận</label>
            <input value={pInfo.diocese} onChange={(e) => setPInfo({ ...pInfo, diocese: e.target.value })} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 4 }}>
          <label>Logo giáo xứ</label>
          <div className="logo-upload">
            {parish.logo_url ? <img className="logo-preview" src={parish.logo_url} alt="logo" /> : <div className="logo-preview">✝</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
                Tải ảnh lên<input type="file" accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
              </label>
              {parish.logo_url && <button className="btn ghost sm" onClick={() => saveParish({ logo_url: null })}>Xóa logo</button>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => saveParish({ name: pInfo.name, diocese: pInfo.diocese })}>Lưu thông tin giáo xứ</button>
        </div>
      </div>

      {/* Giao diện */}
      <div className="panel">
        <div className="card-head"><h2>Giao diện</h2></div>
        <ToggleRow label="Chế độ tối (Night)" on={theme.mode === 'dark'} onClick={() => setMode(theme.mode === 'dark' ? 'light' : 'dark')} />
        <div className="fp-label" style={{ marginTop: 14 }}>Màu chủ đề (theo năm phụng vụ)</div>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={`swatch ${theme.accent === k ? 'on' : ''}`} title={a.label}
              style={{ background: a.p }} onClick={() => setAccent(k)} />
          ))}
        </div>
      </div>

      {/* Tùy chọn quản lý (on/off) */}
      <div className="panel">
        <div className="card-head"><h2>Tùy chọn quản lý</h2></div>
        <ToggleRow label="Quản lý theo năm học giáo lý" on={flag('manage_by_school_year')} onClick={() => toggle('manage_by_school_year')} />
        <ToggleRow label="Tự động lên lớp cuối mỗi năm học" on={flag('auto_promote')} onClick={() => toggle('auto_promote')} />
        <ToggleRow label="Hiển thị mục học viên đã ra trường" on={flag('show_graduated')} onClick={() => toggle('show_graduated')} />
      </div>

      {/* Gói dịch vụ */}
      <div className="panel">
        <div className="card-head"><h2>Gói dịch vụ</h2></div>
        <div className="field" style={{ maxWidth: 280 }}>
          <label>Gói hiện tại (thanh toán bổ sung sau)</label>
          <select value={isPro(parish.plan) ? 'pro' : 'free'} onChange={(e) => saveParish({ plan: e.target.value })}>
            <option value="free">Khởi động (miễn phí — 1 lớp)</option>
            <option value="pro">Pro (trọn gói, không giới hạn lớp)</option>
          </select>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Gói Khởi động chỉ quản lý 1 lớp. Gói Pro mở khóa không giới hạn lớp + toàn bộ tính năng.</p>
      </div>

      {/* Tiện ích mở rộng (kho tính năng) */}
      <div className="panel">
        <div className="card-head"><h2>Tiện ích mở rộng</h2></div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Các tính năng có thể mua thêm tại Ephata Store. Khi giáo xứ sở hữu, tính năng sẽ hiện cho giáo lý viên dùng.</p>
        <div className="ext-grid">
          {features.map((ft) => {
            const owned = ent.has(ft.key);
            return (
              <div key={ft.key} className={`ext-card ${owned ? 'owned' : ''}`}>
                <div className="ext-head">
                  <span className="ext-name">{ft.name}</span>
                  {owned ? <span className="ext-badge on">Đã có</span> : <span className="ext-badge">Chưa có</span>}
                </div>
                <div className="ext-desc">{ft.description}</div>
                <div className="ext-meta"><span className="muted">{ft.category}</span>{!owned && <a href="https://ephatastore.com" target="_blank" rel="noopener noreferrer">Mua tại Ephata Store →</a>}</div>
              </div>
            );
          })}
          {features.length === 0 && <div className="muted">Chưa có tiện ích nào trong kho.</div>}
        </div>
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
