import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { supabase } from '../supabase';
import { useParish } from '../parish.jsx';
import { useRealtime } from '../realtime.jsx';
import api from '../api';
import { isPro, planName } from '../lib/plans';
import { isSuperAdmin } from '../lib/superadmin';
import { sendContactMessage } from '../lib/contact';
import { fileToDataUrl } from '../lib/img';
import { viError } from '../lib/viError';
import { isStandalone } from '../lib/pwa';
import { useAdminCounts } from '../lib/adminCounts';
import InstallGuide from './InstallGuide.jsx';
import PricingModal from './PricingModal.jsx';
import { toast } from '../lib/toast';
import TourRunner from './TourRunner.jsx';
import {
  IconHome, IconStudents, IconClass, IconCheck, IconGrades,
  IconDice, IconGame, IconTeacher, IconLogout, IconBell, IconMoney, IconEditImage, IconArchive, IconCert, IconStore, IconExam, IconExt, IconGuide,
  IconChat, IconSliders, IconKey, IconClock, IconLock, IconAlert,
} from './Icons.jsx';

// group: nhóm hiển thị trên sidebar ('' = không có tiêu đề nhóm). Thứ tự trong mảng = thứ tự hiện.
const nav = [
  { to: '/', label: 'Tổng quan', Icon: IconHome, end: true, group: '' },
  { to: '/attendance', label: 'Điểm danh', Icon: IconCheck, group: 'Hằng ngày' },
  { to: '/grades', label: 'Điểm số', Icon: IconGrades, group: 'Hằng ngày' },
  { to: '/random', label: 'Chọn trả bài', Icon: IconDice, group: 'Hằng ngày' },
  { to: '/students', label: 'Học viên', Icon: IconStudents, group: 'Quản lý' },
  { to: '/classes', label: 'Lớp học', Icon: IconClass, group: 'Quản lý' },
  { to: '/teachers', label: 'Giáo lý viên', Icon: IconTeacher, adminOnly: true, proOnly: true, group: 'Quản lý' },
  { to: '/exams', label: 'Đề thi', Icon: IconExam, proOnly: true, group: 'Thi & chứng chỉ' },
  { to: '/certificates', label: 'Chứng chỉ', Icon: IconCert, adminOnly: true, proOnly: true, group: 'Thi & chứng chỉ' },
  { to: '/archive', label: 'Lưu trữ', Icon: IconArchive, adminOnly: true, proOnly: true, group: 'Thi & chứng chỉ' },
  { to: '/audit', label: 'Thu chi', Icon: IconMoney, proOnly: true, group: 'Giáo xứ' },
  { to: '/notify', label: 'Gửi thông báo', Icon: IconBell, adminOnly: true, proOnly: true, group: 'Giáo xứ' },
  { to: '/games', label: 'Game học', Icon: IconGame, group: 'Khác' },
  { to: '/store', label: 'Ephata Store', Icon: IconStore, group: 'Khác' },
  { to: '/guide', label: 'Hướng dẫn sử dụng', Icon: IconGuide, group: 'Khác' },
  { to: '/admin', label: 'Quản trị hệ thống', Icon: IconMoney, superOnly: true, group: '' },
];

// Lối tắt cuộn tới từng mục trong trang /admin (chỉ super-admin), chia nhóm theo đúng thứ tự trên trang.
// count: khóa số việc cần xử lý (lib/adminCounts) để hiện badge.
const ADMIN_GROUPS = [
  { title: 'Tổng quan', items: [
    { id: 'sec-load', label: 'Giám sát thi online' },
    { id: 'sec-tanthu', label: 'Chương trình Tân thủ' },
    { id: 'sec-todo', label: 'Việc cần xử lý' },
  ] },
  { title: 'Vận hành', items: [
    { id: 'sec-orders', label: 'Đơn chờ thanh toán', count: 'orders' },
    { id: 'sec-expiring', label: 'Pro sắp hết hạn', count: 'expiring' },
    { id: 'sec-leads', label: 'Đơn liên hệ', count: 'leads' },
    { id: 'sec-parishes', label: 'Giáo xứ' },
  ] },
  { title: 'Doanh thu', items: [
    { id: 'sec-payments', label: 'Sổ thanh toán' },
    { id: 'sec-codes', label: 'Mã giảm giá' },
    { id: 'sec-tiers', label: 'Bảng giá' },
  ] },
  { title: 'Hệ thống', items: [
    { id: 'sec-growth', label: 'Thống kê đăng ký' },
    { id: 'sec-default-games', label: 'Game mặc định' },
    { id: 'sec-purge', label: 'Dọn dữ liệu quá hạn', count: 'purge' },
  ] },
];
const ADMIN_IDS = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.id));

function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}

export default function Layout({ children }) {
  const { user, logout, updateProfile } = useAuth();
  const { parish } = useParish();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installBarHidden, setInstallBarHidden] = useState(() => { try { return localStorage.getItem('hideInstallBar') === '1'; } catch { return false; } });
  const showInstallBar = !installBarHidden && !isStandalone();
  const [pricing, setPricing] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const plan = parish?.plan || 'free';
  const pro = isPro(plan);
  const sa = isSuperAdmin(user);
  const unread = notifs.filter((n) => !n.read).length;
  const parishName = parish?.name || 'Quản lý Giáo lý';
  const [renewBarClosed, setRenewBarClosed] = useState(false);

  // Trạng thái hạn gói Pro
  const planExp = parish?.plan_expires_at ? new Date(parish.plan_expires_at) : null;
  const daysLeft = planExp ? Math.ceil((planExp.getTime() - Date.now()) / 86400000) : null;
  const expired = pro && planExp && daysLeft <= 0;          // đã hết hạn -> khóa
  const expSoon = pro && planExp && daysLeft > 0 && daysLeft <= 30; // sắp hết hạn -> nhắc
  const fmtD = (d) => new Date(d).toLocaleDateString('vi-VN');
  const purgeDate = planExp ? fmtD(planExp.getTime() + 30 * 86400000) : '';
  const canRenew = user?.role === 'admin';

  function loadNotifs() { api.get('/notifications').then((r) => setNotifs(r.data)).catch(() => {}); }
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 60000); return () => clearInterval(t); }, []);
  const notifRev = useRealtime(['notifications']);
  useEffect(() => { if (notifRev) loadNotifs(); }, [notifRev]);
  useEffect(() => { setNavOpen(false); setMenuOpen(false); setBellOpen(false); }, [location.pathname]);

  async function openBell() {
    setBellOpen((v) => !v);
    if (!bellOpen && unread) {
      await api.post('/notifications/read', {}).catch(() => {});
      setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
    }
  }
  const timeVi = (s) => new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  async function onPickAvatar(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await fileToDataUrl(file, 200); await updateProfile({ avatar_url: url }); }
    catch { /* noop */ } finally { setUploading(false); }
  }

  function handleLogout() { logout(); navigate('/login'); }

  const adminCounts = useAdminCounts();
  const onAdmin = sa && location.pathname === '/admin';
  const [activeSec, setActiveSec] = useState('');
  // Tô sáng mục đang xem khi cuộn trang /admin.
  useEffect(() => {
    if (!onAdmin) { setActiveSec(''); return undefined; }
    let timer = 0;
    const update = () => {
      timer = 0;
      let cur = ADMIN_IDS[0]; let lastTop = -Infinity; let lastEl = null;
      for (const id of ADMIN_IDS) {
        const el = document.getElementById(id); if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // 2 thẻ cùng hàng (Giám sát, Tân thủ) có cùng top: giữ thẻ đứng trước
        if (top <= 140 && top > lastTop + 1) { cur = id; lastTop = top; }
        lastEl = el;
      }
      // Cuộn chạm đáy trang: mục cuối có thể không lên tới đầu màn hình
      if (lastEl && lastEl.getBoundingClientRect().bottom <= window.innerHeight + 2) cur = lastEl.id;
      setActiveSec(cur);
    };
    const onScroll = () => { if (!timer) timer = setTimeout(update, 60); };
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const t = setTimeout(update, 400);
    return () => { document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); clearTimeout(t); clearTimeout(timer); };
  }, [onAdmin]);

  function goSection(id) {
    const off = location.pathname !== '/admin';
    if (off) navigate('/admin');
    setNavOpen(false);
    setActiveSec(id);
    setTimeout(() => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, off ? 140 : 0);
  }

  const AvatarImg = ({ size }) => (
    user?.avatar_url
      ? <img className="ava-img" src={user.avatar_url} alt="avatar" style={{ width: size, height: size }} />
      : <div className="ava-init" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(user?.full_name)}</div>
  );

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          {!sa && parish?.logo_url ? <img className="logo-img" src={parish.logo_url} alt="logo" /> : <div className="logo">✝</div>}
          {sa ? (
            <div>
              <div>Giáo Lý Số</div>
              <div className="brand-sub">Quản trị hệ thống</div>
            </div>
          ) : (
            <div>
              <div>{parishName}</div>
              {parish?.diocese && <div className="brand-sub">{parish.diocese}</div>}
            </div>
          )}
        </div>
        <nav>
          {nav.filter((n) => (sa ? n.superOnly : !n.superOnly && (!n.adminOnly || user?.role === 'admin') && !(n.proOnly && !pro))).map(({ to, label, Icon, end, group }, i, arr) => (
            <div key={to} style={{ display: 'contents' }}>
              {group && group !== arr[i - 1]?.group && <div className="nav-group-title">{group}</div>}
              <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon /><span>{label}</span>
              </NavLink>
            </div>
          ))}
          {sa && (
            <div className="admin-subnav">
              {ADMIN_GROUPS.map((g) => (
                <div key={g.title} className="asn-group">
                  <div className="asn-title">{g.title}</div>
                  {g.items.map((s) => (
                    <button key={s.id} className={activeSec === s.id ? 'active' : ''} onClick={() => goSection(s.id)}>
                      <span>{s.label}</span>
                      {s.count && adminCounts[s.count] > 0 && <span className="nav-badge">{adminCounts[s.count]}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </nav>
        <div className="side-foot">
        {(sa || user?.role === 'teacher') ? null : !pro ? (
          <div className="upgrade-card" onClick={() => setPricing(true)}>
            <div className="t">Bạn đang dùng gói Khởi động. Nâng lên Pro để mở khóa toàn bộ.</div>
            <button className="btn-w">Nâng cấp Pro</button>
          </div>
        ) : (
          <button className="plan-mini" onClick={() => setPricing(true)} title="Xem gói và nâng cấp">
            <span className="pm-badge">{planName(plan).toUpperCase()}</span>
            <span className="pm-text">{parish?.plan_max_classes ? `Tối đa ${parish.plan_max_classes} lớp` : 'Không giới hạn lớp'}</span>
            <span className="pm-link">Xem gói</span>
          </button>
        )}
        <button className="feedback-link" onClick={() => setFeedback(true)}><IconChat /> Góp ý / liên hệ tác giả</button>
        <a className="zalo-link" href="https://zalo.me/0964013126" target="_blank" rel="noopener noreferrer">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#0068FF" /><text x="24" y="32" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontWeight="700" fontStyle="italic" fontSize="18" fill="#fff">Zalo</text></svg>
          <span>Zalo hỗ trợ</span>
        </a>
        </div>
      </aside>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="hamburger" aria-label="Menu" onClick={() => setNavOpen(true)}>☰</button>
          <div className="topbar-brand">
            {parish?.logo_url ? <img className="logo-img" src={parish.logo_url} alt="logo" /> : <span className="logo">✝</span>} {parishName}
          </div>
          <div className="greeting">
            <div className="hi">Xin chào, {user?.full_name}</div>
            <div className="sub">Chúc bạn một buổi dạy giáo lý tốt lành</div>
          </div>
          <div className="spacer" />

          <div style={{ position: 'relative' }}>
            <button className="icon-btn" title="Thông báo" onClick={openBell}>
              <IconBell />
              {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {bellOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setBellOpen(false)} />
                <div className="user-menu notif-menu">
                  <div className="user-menu-head"><div className="name">Thông báo</div></div>
                  {notifs.length === 0 && <div className="notif-empty">Chưa có thông báo</div>}
                  {notifs.map((n) => (
                    <div key={n.id} className={`notif-item ${n.type === 'absence' ? 'absence' : ''}`}>
                      <div className="nt">{n.type === 'absence' && <IconAlert className="bi" />}{n.title}</div>
                      <div className="nc">{n.content}</div>
                      <div className="nd">{timeVi(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Avatar + thẻ tài khoản */}
          <div className="user-box" onClick={() => setMenuOpen((v) => !v)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className={`ava-wrap sm ${pro ? 'pro' : ''}`}>
              <AvatarImg size={40} />
              {pro && <span className="pro-badge">PRO</span>}
            </div>
            <div className="user-meta">
              <div className="name">{user?.full_name}</div>
              <div className="role">{user?.role === 'admin' ? 'Quản trị viên' : 'Giáo lý viên'}</div>
              {pro && planExp && (
                <div className={`plan-exp ${expired ? 'exp' : expSoon ? 'soon' : ''}`}>
                  {expired ? `Hết hạn ${fmtD(planExp)}` : `Hạn: ${fmtD(planExp)}`}
                </div>
              )}
            </div>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div className="account-card" onClick={(e) => e.stopPropagation()}>
                  <div className={`ava-wrap lg ${pro ? 'pro' : ''}`}>
                    <AvatarImg size={92} />
                    {pro && <span className="pro-badge lg">PRO</span>}
                    <button className="ava-edit" title="Đổi ảnh đại diện" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? '…' : <IconEditImage width="15" height="15" />}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
                  </div>
                  <div className="ac-name">{user?.full_name || 'Tài khoản'}</div>
                  <div className="ac-role">{user?.role === 'admin' ? 'Quản trị viên' : 'Giáo lý viên'}</div>
                  <div className="ac-email">{user?.email}</div>
                  {pro && planExp && (
                    <div className={`ac-plan ${expired ? 'exp' : expSoon ? 'soon' : ''}`}>
                      Gói {planName(plan)} · {expired ? `Hết hạn ${fmtD(planExp)}` : `Hạn đến ${fmtD(planExp)}`}
                    </div>
                  )}

                  <div className="ac-actions">
                    {user?.role === 'admin' && (
                      <button className="user-menu-item" onClick={() => navigate('/settings')}><IconSliders /> Cài đặt quản lý</button>
                    )}
                    <button className="user-menu-item" onClick={() => { setMenuOpen(false); window.open('https://ephatastore.com', '_blank', 'noopener'); }}><IconStore /> <span style={{ flex: 1 }}>Đăng nhập Ephata Store</span><IconExt style={{ width: 15, height: 15, opacity: .6 }} /></button>
                    <button className="user-menu-item" onClick={() => { setMenuOpen(false); setInstallOpen(true); }}>Cài đặt ứng dụng</button>
                    <button className="user-menu-item" onClick={() => { setMenuOpen(false); setPwModal(true); }}><IconKey /> Đổi mật khẩu</button>
                    <button className="user-menu-item danger" onClick={handleLogout}><IconLogout /> Đăng xuất</button>
                  </div>
                  <div className="ac-foot">https://www.giaoly.com.vn</div>
                </div>
              </>
            )}
          </div>
        </header>
        {pro && planExp && !sa && (
          <div className={`topbar-exp ${expired ? 'exp' : expSoon ? 'soon' : ''}`}>
            Gói {planName(plan)} · {expired ? `đã hết hạn ${fmtD(planExp)}` : `hạn đến ${fmtD(planExp)}`}
          </div>
        )}
        <main className="content">
          {showInstallBar && location.pathname === '/' && (
            <div className="renew-bar info">
              <div className="rb-text">Cài <b>Giáo Lý Số</b> thành ứng dụng trên máy để mở nhanh như app riêng, không cần gõ lại đường link.</div>
              <button className="btn sm" onClick={() => setInstallOpen(true)}>Xem cách cài</button>
              <button className="rb-x" aria-label="Đóng" onClick={() => { setInstallBarHidden(true); try { localStorage.setItem('hideInstallBar', '1'); } catch { /* noop */ } }}>✕</button>
            </div>
          )}
          {expSoon && !renewBarClosed && !sa && (
            <div className="renew-bar">
              <span className="rb-ic"><IconClock /></span>
              <div className="rb-text">
                Gói Pro của giáo xứ sẽ <b>hết hạn sau {daysLeft} ngày</b> (đến {fmtD(planExp)}).
                Vui lòng gia hạn để không gián đoạn và <b>tránh mất dữ liệu</b>. Nên tải sao lưu dữ liệu để an toàn.
              </div>
              {canRenew && <button className="btn sm" onClick={() => setPricing(true)}>Gia hạn ngay</button>}
              <button className="rb-x" aria-label="Đóng" onClick={() => setRenewBarClosed(true)}>✕</button>
            </div>
          )}
          {children}
        </main>
        <TourRunner />
      </div>

      {pricing && <PricingModal current={plan} onClose={() => setPricing(false)} />}
      {installOpen && <InstallGuide onClose={() => setInstallOpen(false)} />}

      {/* Khóa khi gói Pro đã hết hạn: chặn toàn ứng dụng cho tới khi gia hạn */}
      {expired && !sa && (
        <div className="lock-overlay">
          <div className="lock-card">
            <div className="lock-ic"><IconLock width="40" height="40" /></div>
            <h2>Gói Pro đã hết hạn</h2>
            <p>Gói Pro của giáo xứ đã hết hạn vào <b>{fmtD(planExp)}</b>. Ứng dụng tạm khóa cho tới khi gia hạn.</p>
            <div className="lock-warn">
              Để bảo đảm an toàn, dữ liệu của giáo xứ sẽ được <b>xóa sau 30 ngày</b> kể từ ngày hết hạn
              (dự kiến từ <b>{purgeDate}</b>) nếu không gia hạn. Vui lòng gia hạn hoặc liên hệ hỗ trợ để sao lưu dữ liệu.
            </div>
            {canRenew
              ? <button className="btn" onClick={() => setPricing(true)}>Gia hạn ngay</button>
              : <p className="muted" style={{ margin: 0 }}>Vui lòng liên hệ Cha sở / quản trị viên của giáo xứ để gia hạn.</p>}
            <button className="lock-help" onClick={() => setFeedback(true)}>Liên hệ hỗ trợ / sao lưu dữ liệu</button>
          </div>
        </div>
      )}

      {feedback && <FeedbackModal user={user} parish={parish} onClose={() => setFeedback(false)} />}
      {pwModal && <ChangePasswordModal email={user?.email} onClose={() => setPwModal(false)} />}
    </div>
  );
}

function FeedbackModal({ user, parish, onClose }) {
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!msg.trim()) { toast.err('Vui lòng nhập nội dung'); return; }
    setBusy(true);
    try {
      await sendContactMessage({ user, parish, message: msg, context: 'Góp ý' });
      setSent(true);
    } catch (e) { toast.err(viError(e.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Góp ý / liên hệ tác giả</h2>
        <p className="muted" style={{ marginTop: 0 }}>Để giúp ứng dụng tốt hơn, chúng con kính mong nhận được sự góp ý của Quý Cha, Quý Soeur và anh chị Giáo lý viên.</p>
        {sent ? (
          <div className="info-box">Đã gửi! Cảm ơn phản hồi của bạn.</div>
        ) : (
          <>
            <div className="field"><label>Nội dung</label>
              <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Nhập góp ý hoặc câu hỏi của bạn…" autoFocus /></div>
          </>
        )}
        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <a className="btn ghost btn-ext" href="https://ephatastore.com" target="_blank" rel="noopener noreferrer">Ephata Store <IconExt /></a>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Đóng</button>
            {!sent && <button className="btn" disabled={busy} onClick={send}>{busy ? 'Đang gửi…' : 'Gửi'}</button>}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ email, onClose }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (pw.length < 6) { setErr('Mật khẩu mới tối thiểu 6 ký tự'); return; }
    if (pw !== pw2) { setErr('Mật khẩu nhập lại không khớp'); return; }
    setLoading(true);
    try {
      // Xác minh mật khẩu hiện tại
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (e1) { setErr('Mật khẩu hiện tại không đúng'); setLoading(false); return; }
      const { error: e2 } = await supabase.auth.updateUser({ password: pw });
      if (e2) throw e2;
      setMsg('Đã đổi mật khẩu thành công.');
      setCur(''); setPw(''); setPw2('');
    } catch (e3) {
      setErr(viError(e3.response?.data?.error || e3.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Đổi mật khẩu</h2>
        <div className="field"><label>Mật khẩu hiện tại</label>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoFocus /></div>
        <div className="field"><label>Mật khẩu mới</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <div className="field"><label>Nhập lại mật khẩu mới</label>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
        {err && <div className="error">{err}</div>}
        {msg && <div className="info-box">{msg}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Đóng</button>
          <button className="btn" disabled={loading}>{loading ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
        </div>
      </form>
    </div>
  );
}
