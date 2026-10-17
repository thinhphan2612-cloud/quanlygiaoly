import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { isPro } from '../lib/plans';
import { useEntitlements } from '../entitlements.jsx';
import { useParish } from '../parish.jsx';
import { fileToDataUrl, fileToDataUrlWide } from '../lib/img';
import { viDate } from '../lib/date';
import { toast } from '../lib/toast';
import { IconArchive, IconUpload } from '../components/Icons.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import ToggleRow from '../components/ToggleRow.jsx';
import PricingModal from '../components/PricingModal.jsx';
import { DEFAULT_RANKING, RANKING_PARTS, rankingWeights, rankingPoints } from '../lib/ranking';

// Tab của trang + mã trên địa chỉ (#...) để mở thẳng từ nơi khác
const TABS = [
  { key: 'giaoxu', label: 'Giáo xứ', hash: '#giao-xu' },
  { key: 'namhoc', label: 'Năm học', hash: '#nam-hoc' },
  { key: 'thidua', label: 'Thi đua', hash: '#thi-dua' },
  { key: 'goi', label: 'Gói, quản trị viên', hash: '#goi' },
];
const tabFromHash = () => (TABS.find((t) => t.hash === window.location.hash) || TABS[0]).key;
// Tính năng đi kèm gói Pro (không cần mua thêm)
const PRO_INCLUDED = ['exam', 'certificate'];
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);

// Trang cài đặt quản lý của admin: giáo xứ, năm học, thi đua, gói và quản trị viên.
export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { parish, saveParish: ctxSave, reload: reloadParish } = useParish();
  const [tab, setTab] = useState(tabFromHash);
  const [pInfo, setPInfo] = useState({ name: '', diocese: '', priest: '' });
  const [years, setYears] = useState([]);
  const [newYear, setNewYear] = useState('');
  const [features, setFeatures] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', full_name: '' });
  const [showPw, setShowPw] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [pricing, setPricing] = useState(false);
  const ent = useEntitlements();

  const settings = parish?.settings || {};
  const flag = (k) => settings[k] !== false; // mặc định ON
  const isFree = !isPro(parish?.plan || 'free');

  function loadAdmins() {
    api.get('/auth/users').then((r) => setAdmins((r.data || []).filter((u) => u.role === 'admin'))).catch(() => {});
  }
  function loadYears() { api.get('/school-years').then((r) => setYears(r.data)).catch(() => {}); }
  useEffect(() => {
    loadYears();
    api.get('/features').then((r) => setFeatures(r.data)).catch(() => {});
    loadAdmins();
  }, []);
  // Đồng bộ ô nhập tên/giáo phận khi tải xong thông tin giáo xứ
  useEffect(() => { if (parish) setPInfo({ name: parish.name || '', diocese: parish.diocese || '', priest: parish.settings?.priest_name || '' }); }, [parish?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mở bằng #thi-dua, #goi...: chọn đúng tab
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Trên điện thoại thanh tab cuộn ngang: đưa tab đang chọn vào khung nhìn
  useEffect(() => { document.querySelector('.stx-tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [tab, parish?.id]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được truy cập cài đặt.</div>;
  if (!parish) return <div className="muted">Đang tải...</div>;

  function openTab(k) {
    setTab(k);
    const h = TABS.find((t) => t.key === k)?.hash || '';
    window.history.replaceState(null, '', window.location.pathname + h);
  }
  async function saveParish(patch, okMsg = 'Đã lưu') {
    try { await ctxSave(patch); toast(okMsg); return true; }
    catch (e) { toast.err(e.response?.data?.error || 'Lưu thất bại'); return false; }
  }
  const toggle = (k) => saveParish({ settings: { ...settings, [k]: !flag(k) } });

  const infoDirty = pInfo.name !== (parish.name || '') || pInfo.diocese !== (parish.diocese || '') || pInfo.priest !== (settings.priest_name || '');
  async function saveInfo() {
    if (!pInfo.name.trim()) { toast.err('Tên giáo xứ không được để trống'); return; }
    setSavingInfo(true);
    await saveParish({ name: pInfo.name.trim(), diocese: pInfo.diocese.trim(), settings: { ...settings, priest_name: pInfo.priest.trim() } }, 'Đã lưu thông tin giáo xứ');
    setSavingInfo(false);
  }
  async function uploadLogo(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try { const url = await fileToDataUrl(file); await saveParish({ logo_url: url }, 'Đã cập nhật logo'); }
    catch { toast.err('Không đọc được ảnh'); }
  }
  async function uploadSig(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try { const url = await fileToDataUrlWide(file, 640); await saveParish({ settings: { ...settings, priest_signature: url } }, 'Đã cập nhật chữ ký'); }
    catch { toast.err('Không đọc được ảnh'); }
  }
  async function removeLogo() { if (await confirmDialog('Gỡ logo giáo xứ? Có thể tải lại sau.')) saveParish({ logo_url: null }, 'Đã gỡ logo'); }
  async function removeSig() { if (await confirmDialog('Gỡ ảnh chữ ký? Chứng chỉ sẽ chỉ in tên người ký.')) saveParish({ settings: { ...settings, priest_signature: null } }, 'Đã gỡ chữ ký'); }

  async function addYear(e) {
    e.preventDefault();
    const name = newYear.trim();
    if (!name) return;
    if (!/^\d{4}\s*-\s*\d{4}$/.test(name)) { toast.err('Năm học ghi dạng 2026-2027'); return; }
    if (years.some((y) => y.name.replace(/\s/g, '') === name.replace(/\s/g, ''))) { toast.err('Năm học này đã có'); return; }
    try { await api.post('/school-years', { name: name.replace(/\s/g, '') }); setNewYear(''); loadYears(); toast('Đã thêm năm học'); }
    catch (err) { toast.err(err.response?.data?.error || 'Thêm thất bại'); }
  }
  async function setCurrent(y) {
    if (!(await confirmDialog(`Đặt ${y.name} làm năm học hiện tại?\n\nTrang Điểm số và Lưu trữ sẽ lấy năm này làm năm đang học.`))) return;
    try { await api.post(`/school-years/${y.id}/current`, {}); loadYears(); reloadParish(); toast(`Năm học hiện tại: ${y.name}`); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa đổi được'); }
  }
  async function delYear(y) {
    if (!(await confirmDialog(`Xóa năm học ${y.name} khỏi danh sách?\n\nChỉ xóa tên năm học trong danh sách này. Lớp, học viên và điểm của năm đó không bị xóa.`))) return;
    try { await api.delete(`/school-years/${y.id}`); loadYears(); toast(`Đã xóa ${y.name}`); }
    catch (err) { toast.err(err.response?.data?.error || 'Xóa thất bại'); }
  }
  async function promote() {
    if (!await confirmDialog(
      'KẾT THÚC NĂM HỌC & LÊN LỚP\n\n' +
      'Chỉ chạy được khi TẤT CẢ các lớp đã được duyệt (GLV chốt lớp → Admin duyệt ở Tổng quan).\n\n' +
      'Hệ thống áp quyết định từng em: "lên lớp" chuyển lên bậc kế (điểm bắt đầu lại), "ở lại" giữ nguyên lớp năm sau. ' +
      'Học viên "lớp tốt nghiệp" được cho lên lớp sẽ ra trường.\n\n' +
      'Dữ liệu năm hiện tại được ĐÓNG BĂNG và tra cứu ở tab "Lưu trữ" (không mất).\n\n' +
      'Bạn chắc chắn?'
    )) return;
    try {
      const r = await api.post('/promote', {});
      toast(`Đã lên lớp ${r.data.promoted} học viên` + (r.data.stayed ? `, ${r.data.stayed} em ở lại` : '') + `, ${r.data.graduated} em ra trường.` + (r.data.new_year ? ` Năm học mới: ${r.data.new_year}.` : ''));
      loadYears(); reloadParish();
    } catch (e) { toast.err(e.response?.data?.error || 'Lên lớp thất bại'); }
  }

  async function addAdmin(e) {
    e.preventDefault();
    const f = adminForm;
    if (!f.full_name.trim()) { toast.err('Nhập họ tên quản trị viên'); return; }
    if (!f.email.trim() || f.password.length < 6) { toast.err('Cần email và mật khẩu tạm tối thiểu 6 ký tự'); return; }
    setAddingAdmin(true);
    try {
      await api.post('/auth/users', { email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), role: 'admin' });
      setAdminForm({ email: '', password: '', full_name: '' }); setShowPw(false);
      loadAdmins();
      toast(`Đã thêm quản trị viên ${f.full_name.trim()}. Gửi email và mật khẩu tạm cho người này để đăng nhập.`);
    } catch (err) { toast.err(err.response?.data?.error || 'Thêm quản trị viên thất bại'); }
    finally { setAddingAdmin(false); }
  }
  async function demote(a) {
    if (!(await confirmDialog(`Gỡ quyền quản trị của ${a.full_name || a.email}?\n\nNgười này vẫn đăng nhập được nhưng chỉ còn quyền giáo lý viên (thấy các lớp được phân công).`))) return;
    try { await api.put(`/auth/users/${a.id}/role`, { role: 'teacher' }); loadAdmins(); toast(`Đã gỡ quyền quản trị của ${a.full_name || a.email}`); }
    catch (err) { toast.err(err.response?.data?.error || 'Chưa gỡ được quyền'); }
  }
  function genPw() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setAdminForm((f) => ({ ...f, password: pw })); setShowPw(true);
  }

  const planExp = parish.plan_expires_at ? new Date(parish.plan_expires_at) : null;
  const daysLeft = planExp ? Math.ceil((planExp.getTime() - Date.now()) / 86400000) : null;

  return (
    <div>
      <PageHeader title="Cài đặt quản lý" subtitle="Thông tin giáo xứ, năm học, cách tính thi đua, gói dịch vụ và quản trị viên." />
      <div className="stx-tabs" role="tablist" aria-label="Nhóm cài đặt">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`stx-tab${tab === t.key ? ' on' : ''}`} onClick={() => openTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'giaoxu' && (
        <div className="panel">
          <div className="card-head"><h2>Thông tin giáo xứ</h2></div>
          <div className="settings-grid">
            <div className="field">
              <label>Tên giáo xứ</label>
              <input data-tour="parish-name" value={pInfo.name} onChange={(e) => setPInfo({ ...pInfo, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Giáo phận</label>
              <input value={pInfo.diocese} onChange={(e) => setPInfo({ ...pInfo, diocese: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Tên người ký trên chứng chỉ (Linh mục quản xứ)</label>
            <input value={pInfo.priest} onChange={(e) => setPInfo({ ...pInfo, priest: e.target.value })} placeholder="VD: Phêrô Nguyễn Văn An" />
          </div>
          <div className="stx-savebar">
            <button data-tour="parish-save" className="btn" onClick={saveInfo} disabled={!infoDirty || savingInfo}>{savingInfo ? 'Đang lưu…' : 'Lưu thông tin giáo xứ'}</button>
            {infoDirty && <span className="stx-dirty">Có thay đổi chưa lưu</span>}
          </div>

          <div className="stx-media">
            <div className="stx-media-item">
              <div className="stx-media-h">Logo giáo xứ</div>
              <div className="stx-media-row">
                {parish.logo_url ? <img className="logo-preview" src={parish.logo_url} alt="Logo giáo xứ" /> : <div className="logo-preview">✝</div>}
                <div className="stx-media-actions">
                  <label data-tour="parish-logo" className="btn ghost sm" style={{ cursor: 'pointer' }}>
                    {parish.logo_url ? 'Đổi ảnh' : 'Tải ảnh lên'}<input type="file" accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
                  </label>
                  {parish.logo_url && <button className="btn ghost sm" onClick={removeLogo}>Gỡ logo</button>}
                </div>
              </div>
              <p className="stx-hint">Ảnh vuông, nền trong là đẹp nhất. Hiện ở góc trái ứng dụng và trên chứng chỉ. Lưu ngay khi tải lên.</p>
            </div>
            <div className="stx-media-item">
              <div className="stx-media-h">Ảnh chữ ký trên chứng chỉ</div>
              <div className="stx-media-row">
                {settings.priest_signature ? <img className="stx-sig" src={settings.priest_signature} alt="Chữ ký" /> : <div className="stx-sig empty">Chưa có chữ ký</div>}
                <div className="stx-media-actions">
                  <label className="btn ghost sm" style={{ cursor: 'pointer' }}>{settings.priest_signature ? 'Đổi ảnh' : 'Tải chữ ký'}<input type="file" accept="image/*" onChange={uploadSig} style={{ display: 'none' }} /></label>
                  {settings.priest_signature && <button className="btn ghost sm" onClick={removeSig}>Gỡ chữ ký</button>}
                </div>
              </div>
              <p className="stx-hint">Ảnh chữ ký nền trong (PNG), in phía trên tên người ký. Lưu ngay khi tải lên.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'namhoc' && (
        <>
          <div className="panel">
            <div className="card-head"><h2>Năm học giáo lý</h2></div>
            <ToggleRow label="Quản lý theo năm học" desc="Bật để có danh sách năm học bên dưới và chọn năm học hiện tại. Trang Điểm số, Lưu trữ dùng năm hiện tại này."
              on={flag('manage_by_school_year')} onClick={() => toggle('manage_by_school_year')} />
            {flag('manage_by_school_year') && (
              <>
                <div className="stx-years">
                  {years.map((y) => (
                    <div className={`stx-year${y.is_current ? ' cur' : ''}`} key={y.id}>
                      <span className="stx-year-name">{y.name}</span>
                      {y.is_current ? <span className="tag-chip tone-green">Năm hiện tại</span> : (
                        <span className="stx-year-actions">
                          <button className="btn ghost sm" onClick={() => setCurrent(y)}>Đặt làm hiện tại</button>
                          <button type="button" className="stx-del" onClick={() => delYear(y)} title={`Xóa ${y.name} khỏi danh sách`} aria-label={`Xóa năm học ${y.name}`}><TrashIcon /></button>
                        </span>
                      )}
                    </div>
                  ))}
                  {years.length === 0 && <p className="muted" style={{ margin: 0 }}>Chưa có năm học nào.</p>}
                </div>
                <form className="stx-addyear" onSubmit={addYear}>
                  <input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="VD: 2027-2028" aria-label="Năm học mới" />
                  <button className="btn ghost" type="submit" disabled={!newYear.trim()}>Thêm năm học</button>
                </form>
              </>
            )}
          </div>

          {!isFree && (
            <div className="panel">
              <div className="card-head"><h2>Kết thúc năm học và lên lớp</h2></div>
              <ToggleRow label="Cho phép kết thúc năm học" desc='Tắt để ẩn thao tác này ở đây và ở menu ⋯ trang Điểm số (tránh bấm nhầm giữa năm).'
                on={flag('auto_promote')} onClick={() => toggle('auto_promote')} />
              {flag('auto_promote') && (
                <>
                  <p className="muted stx-p">
                    Tạo bộ lớp mới cho năm sau (sao chép các lớp bật <b>Tự động lên lớp</b>), chuyển học viên lên bậc kế tiếp
                    theo <b>thứ tự lớp</b> ở trang Lớp học, điểm bắt đầu lại. Học viên lớp cao nhất ra trường.
                    Dữ liệu năm hiện tại được giữ nguyên ở <span className="link" onClick={() => navigate('/archive')}>Lưu trữ</span>.
                  </p>
                  <button className="btn" onClick={promote}><IconUpload className="bi" />Lên lớp cho cả giáo xứ</button>
                </>
              )}
            </div>
          )}

          <div className="panel">
            <div className="card-head"><h2>Dữ liệu năm cũ</h2></div>
            <p className="muted stx-p">Học viên đã ra trường và dữ liệu các năm đã kết thúc nằm ở trang Lưu trữ (xem theo năm, tải về, xóa).</p>
            <button className="btn ghost" onClick={() => navigate('/archive')}><IconArchive className="bi" />Mở Lưu trữ</button>
          </div>
        </>
      )}

      {tab === 'thidua' && (
        <RankingWeights settings={settings} onSave={(w) => saveParish({ settings: { ...settings, ranking_weights: w } }, 'Đã lưu cách tính điểm thi đua')} />
      )}

      {tab === 'goi' && (
        <>
          <div className="panel">
            <div className="card-head"><h2>Gói dịch vụ</h2></div>
            <div className="stx-plan">
              <div>
                <div className="stx-plan-name">{isFree ? 'Khởi động (miễn phí, 1 lớp)' : `Pro · ${parish.plan_max_classes ? `tối đa ${parish.plan_max_classes} lớp` : 'không giới hạn lớp'}`}</div>
                <div className="stx-plan-sub">
                  {isFree ? 'Nâng lên Pro để quản lý nhiều lớp, thêm giáo lý viên và mở mọi tính năng.'
                    : planExp ? (daysLeft > 0 ? <>Hạn đến <b>{viDate(parish.plan_expires_at)}</b>, còn {daysLeft} ngày</> : <span className="stx-warn">Đã hết hạn ngày {viDate(parish.plan_expires_at)}</span>)
                      : 'Không giới hạn thời gian'}
                </div>
              </div>
              <button className="btn" onClick={() => setPricing(true)}>{isFree ? 'Xem các gói' : 'Gia hạn hoặc đổi mức'}</button>
            </div>
          </div>

          <div className="panel">
            <div className="card-head"><h2>Quản trị viên giáo xứ</h2></div>
            {isFree ? (
              <p className="muted stx-p">Thêm quản trị viên khác cùng quản lý giáo xứ là tính năng của gói Pro.</p>
            ) : (
              <>
                <p className="muted stx-p">Các quản trị viên có <b>quyền ngang nhau</b> trên giáo xứ. Muốn thêm giáo lý viên thì vào trang Giáo lý viên.</p>
                <div className="stx-admins">
                  {admins.map((a) => (
                    <div className="stx-admin" key={a.id}>
                      <div className="stx-admin-who"><b>{a.full_name || 'Chưa đặt tên'}</b>{a.id === user.id && <span className="muted"> (bạn)</span>}<span className="muted stx-admin-mail">{a.email}</span></div>
                      {a.id !== user.id && <button className="btn ghost sm" onClick={() => demote(a)}>Gỡ quyền quản trị</button>}
                    </div>
                  ))}
                  {admins.length === 0 && <p className="muted" style={{ margin: 0 }}>Đang tải…</p>}
                </div>
                <form onSubmit={addAdmin}>
                  <div className="form-section" style={{ marginTop: 16 }}>Thêm quản trị viên</div>
                  <div className="settings-grid">
                    <div className="field"><label>Họ tên</label>
                      <input value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} placeholder="VD: Giuse Nguyễn Văn A" autoComplete="off" /></div>
                    <div className="field"><label>Email đăng nhập</label>
                      <input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} autoComplete="off" /></div>
                    <div className="field"><label>Mật khẩu tạm (tối thiểu 6 ký tự)</label>
                      <div className="stx-pw">
                        <input type={showPw ? 'text' : 'password'} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} autoComplete="new-password" placeholder="Người này nên đổi sau khi đăng nhập" />
                        <button type="button" className="btn ghost sm" onClick={() => setShowPw(!showPw)}>{showPw ? 'Ẩn' : 'Hiện'}</button>
                        <button type="button" className="btn ghost sm" onClick={genPw}>Tạo ngẫu nhiên</button>
                      </div>
                    </div>
                  </div>
                  <button className="btn" type="submit" disabled={addingAdmin}>{addingAdmin ? 'Đang thêm…' : 'Thêm quản trị viên'}</button>
                </form>
              </>
            )}
          </div>

          <div className="panel">
            <div className="card-head"><h2>Tiện ích mở rộng</h2></div>
            <p className="muted stx-p">Tính năng thêm tại Ephata Store. Khi giáo xứ có, tính năng hiện cho cả giáo lý viên dùng.</p>
            <div className="ext-grid">
              {features.map((ft) => {
                const inPro = !isFree && PRO_INCLUDED.includes(ft.key);
                const owned = ent.has(ft.key);
                return (
                  <div key={ft.key} className={`ext-card ${owned ? 'owned' : ''}`}>
                    <div className="ext-head">
                      <span className="ext-name">{ft.name}</span>
                      {inPro ? <span className="ext-badge on">Có trong gói Pro</span> : owned ? <span className="ext-badge on">Đã có</span> : <span className="ext-badge">Chưa có</span>}
                    </div>
                    <div className="ext-desc">{ft.description}</div>
                    <div className="ext-meta"><span className="muted">{ft.category}</span>{!owned && <a href="https://ephatastore.com" target="_blank" rel="noopener noreferrer">Xem tại Ephata Store</a>}</div>
                  </div>
                );
              })}
              {features.length === 0 && <div className="muted">Chưa có tiện ích nào.</div>}
            </div>
          </div>
        </>
      )}

      {pricing && <PricingModal current={parish.plan} onClose={() => { setPricing(false); reloadParish(); }} />}
    </div>
  );
}

// Tỷ lệ điểm thi đua của giáo xứ: 3 phần, tổng 100%. Lưu ở settings.ranking_weights.
function RankingWeights({ settings, onSave }) {
  const cur = rankingWeights(settings);
  const [w, setW] = useState(cur);
  const [saving, setSaving] = useState(false);
  const curKey = JSON.stringify(cur);
  useEffect(() => { setW(cur); }, [curKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  const sum = RANKING_PARTS.reduce((a, p) => a + num(w[p.key]), 0);
  const clean = Object.fromEntries(RANKING_PARTS.map((p) => [p.key, num(w[p.key])]));
  const changed = JSON.stringify(clean) !== curKey;
  const isDefault = RANKING_PARTS.every((p) => clean[p.key] === DEFAULT_RANKING[p.key]);
  const sample = { tb: 8, rate: 90, tl: 70 };

  async function save() {
    setSaving(true);
    try { await onSave(clean); } finally { setSaving(false); }
  }

  return (
    <div className="panel" id="thi-dua">
      <div className="card-head"><h2>Cách tính điểm thi đua</h2></div>
      <p className="muted rw-sub">Điểm thi đua (thang 100) dùng để xếp hạng ở bảng thi đua. Mỗi giáo xứ tự đặt tỷ lệ cho 3 phần, tổng phải đúng 100%. Đặt 0% nếu không muốn tính phần đó.</p>
      <div className="rw-grid">
        {RANKING_PARTS.map((p) => (
          <label className="rw-item" key={p.key}>
            <span className="rw-label">{p.label}</span>
            <span className="rw-input"><input type="number" inputMode="numeric" min="0" max="100" step="5" value={w[p.key]}
              onChange={(e) => setW({ ...w, [p.key]: e.target.value })} aria-label={`Tỷ lệ ${p.label}`} /><span>%</span></span>
            <span className="rw-hint">{p.hint}</span>
          </label>
        ))}
      </div>
      <div className="rw-foot">
        <div className={`rw-sum${sum === 100 ? ' ok' : ' bad'}`}>
          Tổng: <b>{sum}%</b>{sum !== 100 && <span> · cần đúng 100% (đang {sum < 100 ? `thiếu ${100 - sum}` : `thừa ${sum - 100}`}%)</span>}
        </div>
        {sum === 100 && <div className="rw-example muted">Ví dụ: em có điểm TB 8, chuyên cần 90%, việc thiêng liêng 70% được <b>{rankingPoints(sample, clean)}</b> điểm thi đua.</div>}
      </div>
      <div className="rw-actions">
        <button className="btn" onClick={save} disabled={sum !== 100 || !changed || saving}>{saving ? 'Đang lưu…' : 'Lưu cách tính'}</button>
        {!isDefault && <button className="btn ghost" onClick={() => setW(DEFAULT_RANKING)}>Về mặc định 50 / 30 / 20</button>}
      </div>
    </div>
  );
}
