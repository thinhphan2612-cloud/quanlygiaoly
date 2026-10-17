import { Component, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { isSuperAdmin } from './lib/superadmin';
import { useParish } from './parish.jsx';
import { isPro } from './lib/plans';
import Toaster from './components/Toaster.jsx';
import ConfirmHost from './components/ConfirmHost.jsx';

// Chia nhỏ theo trang: Đăng nhập + Tổng quan tải ngay, các trang khác chỉ tải khi mở.
// Sau mỗi lần deploy, tên file mã trang đổi; người đang mở app bản cũ sẽ không tải được file cũ
// (Vercel trả index.html) -> tải lại trang MỘT lần để lấy bản mới, tránh màn hình trắng.
const RELOAD_KEY = 'page_chunk_reload';
function lazyPage(load) {
  return lazy(() => load().then((m) => {
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* noop */ }
    return m;
  }).catch((err) => {
    let tried = false;
    try { tried = sessionStorage.getItem(RELOAD_KEY) === '1'; sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* noop */ }
    if (!tried) { window.location.reload(); return new Promise(() => {}); }
    throw err;
  }));
}
const Students = lazyPage(() => import('./pages/Students.jsx'));
const StudentProfile = lazyPage(() => import('./pages/StudentProfile.jsx'));
const Classes = lazyPage(() => import('./pages/Classes.jsx'));
const Teachers = lazyPage(() => import('./pages/Teachers.jsx'));
const Attendance = lazyPage(() => import('./pages/Attendance.jsx'));
const Grades = lazyPage(() => import('./pages/Grades.jsx'));
const RandomPicker = lazyPage(() => import('./pages/RandomPicker.jsx'));
const Games = lazyPage(() => import('./pages/Games.jsx'));
const Settings = lazyPage(() => import('./pages/Settings.jsx'));
const Archive = lazyPage(() => import('./pages/Archive.jsx'));
const Audit = lazyPage(() => import('./pages/Audit.jsx'));
const Notify = lazyPage(() => import('./pages/Notify.jsx'));
const Admin = lazyPage(() => import('./pages/Admin.jsx'));
const SetPassword = lazyPage(() => import('./pages/SetPassword.jsx'));
const Certificates = lazyPage(() => import('./pages/Certificates.jsx'));
const EphataStore = lazyPage(() => import('./pages/EphataStore.jsx'));
const Exams = lazyPage(() => import('./pages/Exams.jsx'));
const ExamTake = lazyPage(() => import('./pages/ExamTake.jsx'));
const Guide = lazyPage(() => import('./pages/Guide.jsx'));
// Trang dùng hằng ngày: tải sẵn khi trình duyệt rảnh để bấm sang là mở ngay
const PREFETCH = [() => import('./pages/Attendance.jsx'), () => import('./pages/Grades.jsx'), () => import('./pages/Students.jsx'), () => import('./pages/Classes.jsx')];
const pageFallback = <div className="page-loading" aria-busy="true"><span className="page-loading-bar" /></div>;
// Không tải được mã trang dù đã tải lại (mất mạng...): báo lỗi + nút tải lại thay vì màn hình trắng
class PageBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="panel page-error">
        <h2>Không tải được trang</h2>
        <p className="muted">Có thể mạng đang chập chờn hoặc ứng dụng vừa được cập nhật. Kiểm tra kết nối rồi tải lại trang.</p>
        <button className="btn" onClick={() => window.location.reload()}>Tải lại trang</button>
      </div>
    );
  }
}

// Bắt link mời / đặt lại mật khẩu (đọc hash trước khi Supabase xoá) — buộc đặt mật khẩu.
const INVITE_LINK = typeof window !== 'undefined' && /type=(invite|recovery)/i.test(window.location.hash);

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><PageBoundary><Suspense fallback={pageFallback}>{children}</Suspense></PageBoundary></Layout>;
}

// Chặn gói free vào các trang chỉ dành cho Pro (kể cả gõ URL trực tiếp).
function RequirePro({ children }) {
  const { parish } = useParish();
  if (parish && !isPro(parish.plan)) return <Navigate to="/" replace />;
  return children;
}

// Chặn giáo lý viên vào trang chỉ dành cho admin quản lý (kể cả gõ URL trực tiếp).
function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin' && !isSuperAdmin(user)) return <Navigate to="/" replace />;
  return children;
}

// Trang chủ: super-admin vào thẳng bảng quản trị hệ thống (không có giáo xứ)
function Home() {
  const { user } = useAuth();
  if (INVITE_LINK) return <Navigate to="/set-password" replace />;
  if (isSuperAdmin(user)) return <Navigate to="/admin" replace />;
  return <Dashboard />;
}

export default function App() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return undefined;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => PREFETCH.forEach((f) => f().catch(() => {})));
    return () => cancel(id);
  }, [user]);
  return (
    <>
    <Toaster />
    <ConfirmHost />
    <PageBoundary>
    <Suspense fallback={pageFallback}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login initialMode="register" />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/exam/:code" element={<ExamTake />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/students" element={<Protected><Students /></Protected>} />
      <Route path="/students/:id" element={<Protected><StudentProfile /></Protected>} />
      <Route path="/classes" element={<Protected><Classes /></Protected>} />
      <Route path="/teachers" element={<Protected><RequirePro><Teachers /></RequirePro></Protected>} />
      <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
      <Route path="/grades" element={<Protected><Grades /></Protected>} />
      <Route path="/certificates" element={<Protected><RequirePro><RequireAdmin><Certificates /></RequireAdmin></RequirePro></Protected>} />
      <Route path="/exams" element={<Protected><RequirePro><Exams /></RequirePro></Protected>} />
      <Route path="/random" element={<Protected><RandomPicker /></Protected>} />
      <Route path="/games" element={<Protected><Games /></Protected>} />
      <Route path="/store" element={<Protected><EphataStore /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/archive" element={<Protected><RequirePro><Archive /></RequirePro></Protected>} />
      <Route path="/guide" element={<Protected><Guide /></Protected>} />
      <Route path="/audit" element={<Protected><RequirePro><Audit /></RequirePro></Protected>} />
      <Route path="/notify" element={<Protected><RequirePro><Notify /></RequirePro></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </PageBoundary>
    </>
  );
}
