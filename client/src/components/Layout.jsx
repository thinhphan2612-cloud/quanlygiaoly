import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import api from '../api';
import { applyTheme, loadTheme } from '../theme.js';
import { planName } from '../lib/plans';
import PricingModal from './PricingModal.jsx';
import {
  IconHome, IconStudents, IconClass, IconCheck, IconGrades,
  IconDice, IconGame, IconTeacher, IconLogout, IconBell, IconMoney,
} from './Icons.jsx';

const nav = [
  { to: '/', label: 'Tổng quan', Icon: IconHome, end: true },
  { to: '/students', label: 'Học viên', Icon: IconStudents },
  { to: '/classes', label: 'Lớp học', Icon: IconClass },
  { to: '/attendance', label: 'Điểm danh', Icon: IconCheck },
  { to: '/grades', label: 'Điểm số', Icon: IconGrades },
  { to: '/random', label: 'Chọn trả bài', Icon: IconDice },
  { to: '/games', label: 'Game học', Icon: IconGame },
  { to: '/teachers', label: 'Giáo lý viên', Icon: IconTeacher, adminOnly: true },
  { to: '/audit', label: 'Kiểm toán', Icon: IconMoney, adminOnly: true },
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] || '?').toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [parish, setParish] = useState(null);
  const [dark, setDark] = useState(loadTheme().mode === 'dark');
  const [pricing, setPricing] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const plan = parish?.plan || 'free';

  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);

  function toggleDark() {
    const t = loadTheme();
    const mode = t.mode === 'dark' ? 'light' : 'dark';
    applyTheme({ ...t, mode });
    setDark(mode === 'dark');
  }

  const parishName = parish?.name || 'Quản lý Giáo lý';

  // Đóng menu mobile / dropdown khi chuyển trang
  useEffect(() => { setNavOpen(false); setMenuOpen(false); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
          {nav
            .filter((n) => !n.adminOnly || user?.role === 'admin')
            .map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        {plan === 'free' ? (
          <div className="upgrade-card" onClick={() => setPricing(true)}>
            <div className="emoji">🚀</div>
            <div className="t">Bạn đang dùng gói Basic. Nâng lên Pro để mở khóa toàn bộ.</div>
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
          <button className="icon-btn" title="Thông báo"><IconBell /></button>
          <div className="user-box" onClick={() => setMenuOpen((v) => !v)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="avatar">{initials(user?.full_name)}</div>
            <div className="user-meta">
              <div className="name">{user?.full_name}</div>
              <div className="role">{user?.role === 'admin' ? 'Quản trị viên' : 'Giáo lý viên'}</div>
            </div>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div className="user-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="user-menu-head">
                    <div className="name">{user?.full_name || 'Tài khoản'}</div>
                    <div className="email">{user?.email}</div>
                    <div className="role-tag">{user?.role === 'admin' ? 'Quản trị viên' : 'Giáo lý viên'}</div>
                  </div>
                  <button className="user-menu-item" onClick={toggleDark}>{dark ? '☀️ Chế độ sáng' : '🌙 Chế độ tối'}</button>
                  {user?.role === 'admin' && (
                    <button className="user-menu-item" onClick={() => navigate('/settings')}>⚙ Cài đặt quản lý</button>
                  )}
                  <button className="user-menu-item danger" onClick={handleLogout}>
                    <IconLogout /> Đăng xuất
                  </button>
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
              <a className="btn ghost" href="https://wecatholic.com" target="_blank" rel="noopener noreferrer">🌐 Khám phá WeCatholic</a>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setFeedback(false)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
