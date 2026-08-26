import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useParish } from '../parish.jsx';
import { useRealtime } from '../realtime.jsx';
import api from '../api';
import { isPro, planName } from '../lib/plans';
import { fileToDataUrl } from '../lib/img';
import PricingModal from './PricingModal.jsx';
import {
  IconHome, IconStudents, IconClass, IconCheck, IconGrades,
  IconDice, IconGame, IconTeacher, IconLogout, IconBell, IconMoney, IconEditImage, IconArchive,
} from './Icons.jsx';

const nav = [
  { to: '/', label: 'Tổng quan', Icon: IconHome, end: true },
  { to: '/students', label: 'Học viên', Icon: IconStudents },
  { to: '/classes', label: 'Lớp học', Icon: IconClass },
  { to: '/attendance', label: 'Điểm danh', Icon: IconCheck },
  { to: '/grades', label: 'Điểm số', Icon: IconGrades },
  { to: '/random', label: 'Chọn trả bài', Icon: IconDice },
  { to: '/games', label: 'Game học', Icon: IconGame },
  { to: '/audit', label: 'Thu chi', Icon: IconMoney },
  { to: '/teachers', label: 'Giáo lý viên', Icon: IconTeacher, adminOnly: true },
  { to: '/archive', label: 'Lưu trữ', Icon: IconArchive, adminOnly: true },
  { to: '/notify', label: 'Thông báo', Icon: IconBell, adminOnly: true },
];

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
  const [pricing, setPricing] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const plan = parish?.plan || 'free';
  const pro = isPro(plan);
  const unread = notifs.filter((n) => !n.read).length;
  const parishName = parish?.name || 'Quản lý Giáo lý';

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

  const AvatarImg = ({ size }) => (
    user?.avatar_url
      ? <img className="ava-img" src={user.avatar_url} alt="avatar" style={{ width: size, height: size }} />
      : <div className="ava-init" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(user?.full_name)}</div>
  );

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          {parish?.logo_url ? <img className="logo-img" src={parish.logo_url} alt="logo" /> : <div className="logo">✝</div>}
          <div>
            <div>{parishName}</div>
            {parish?.diocese && <div className="brand-sub">{parish.diocese}</div>}
          </div>
        </div>
        <nav>
          {nav.filter((n) => !n.adminOnly || user?.role === 'admin').map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {!pro ? (
          <div className="upgrade-card" onClick={() => setPricing(true)}>
            <div className="emoji">🚀</div>
            <div className="t">Bạn đang dùng gói Khởi động. Nâng lên Pro để mở khóa toàn bộ.</div>
            <button className="btn-w">Nâng cấp Pro</button>
          </div>
        ) : (
          <div className="side-card">
            <div className="emoji">📖</div>
            <div className="t">Đồng hành cùng các em thiếu nhi trong hành trình đức tin.</div>
            <button className="btn-w" onClick={() => setPricing(true)}>Gói {planName(plan)}</button>
          </div>
        )}
        <button className="feedback-link" onClick={() => setFeedback(true)}>💬 Góp ý / liên hệ tác giả</button>
      </aside>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="hamburger" aria-label="Menu" onClick={() => setNavOpen(true)}>☰</button>
          <div className="topbar-brand">
            {parish?.logo_url ? <img className="logo-img" src={parish.logo_url} alt="logo" /> : <span className="logo">✝</span>} {parishName}
          </div>
          <div className="greeting">
            <div className="hi">Xin chào, {user?.full_name} 👋</div>
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
                      <div className="nt">{n.type === 'absence' ? '⚠ ' : ''}{n.title}</div>
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

                  <div className="ac-actions">
                    {user?.role === 'admin' && (
                      <button className="user-menu-item" onClick={() => navigate('/settings')}>⚙ Cài đặt quản lý</button>
                    )}
                    <button className="user-menu-item danger" onClick={handleLogout}><IconLogout /> Đăng xuất</button>
                  </div>
                  <div className="ac-foot">https://www.giaoly.com.vn</div>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {pricing && <PricingModal current={plan} onClose={() => setPricing(false)} />}
      {feedback && (
        <div className="modal-backdrop" onClick={() => setFeedback(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Góp ý / liên hệ tác giả</h2>
            <p className="muted" style={{ marginTop: 0 }}>Mọi góp ý giúp ứng dụng tốt hơn. Rất mong nhận phản hồi từ quý cha và anh chị giáo lý viên.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a className="btn" href="mailto:phanngocthinh2612@gmail.com?subject=Góp ý Quản lý Giáo lý">✉ Gửi email góp ý</a>
              <a className="btn ghost" href="https://ephatastore.com" target="_blank" rel="noopener noreferrer">🌐 Khám phá Ephata Store</a>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setFeedback(false)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
