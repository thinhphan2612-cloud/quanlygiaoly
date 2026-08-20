import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import {
  IconHome, IconStudents, IconClass, IconCheck, IconGrades,
  IconDice, IconGame, IconTeacher, IconLogout, IconBell,
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
          <div className="logo">✝</div>
          <span>Quản lý Giáo lý</span>
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
        <div className="side-card">
          <div className="emoji">📖</div>
          <div className="t">Đồng hành cùng các em thiếu nhi trong hành trình đức tin.</div>
          <button className="btn-w" onClick={() => navigate('/students')}>Quản lý học viên</button>
        </div>
      </aside>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="hamburger" aria-label="Menu" onClick={() => setNavOpen(true)}>☰</button>
          <div className="topbar-brand"><span className="logo">✝</span> Quản lý Giáo lý</div>
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
    </div>
  );
}
