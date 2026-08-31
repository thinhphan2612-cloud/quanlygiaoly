import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentProfile from './pages/StudentProfile.jsx';
import Classes from './pages/Classes.jsx';
import Teachers from './pages/Teachers.jsx';
import Attendance from './pages/Attendance.jsx';
import Grades from './pages/Grades.jsx';
import RandomPicker from './pages/RandomPicker.jsx';
import Games from './pages/Games.jsx';
import Settings from './pages/Settings.jsx';
import Archive from './pages/Archive.jsx';
import Audit from './pages/Audit.jsx';
import Notify from './pages/Notify.jsx';
import Admin from './pages/Admin.jsx';
import SetPassword from './pages/SetPassword.jsx';
import Certificates from './pages/Certificates.jsx';
import EphataStore from './pages/EphataStore.jsx';
import { isSuperAdmin } from './lib/superadmin';
import { useParish } from './parish.jsx';
import { isPro } from './lib/plans';

// Bắt link mời / đặt lại mật khẩu (đọc hash trước khi Supabase xoá) — buộc đặt mật khẩu.
const INVITE_LINK = typeof window !== 'undefined' && /type=(invite|recovery)/i.test(window.location.hash);

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

// Chặn gói free vào các trang chỉ dành cho Pro (kể cả gõ URL trực tiếp).
function RequirePro({ children }) {
  const { parish } = useParish();
  if (parish && !isPro(parish.plan)) return <Navigate to="/" replace />;
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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login initialMode="register" />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/students" element={<Protected><Students /></Protected>} />
      <Route path="/students/:id" element={<Protected><StudentProfile /></Protected>} />
      <Route path="/classes" element={<Protected><Classes /></Protected>} />
      <Route path="/teachers" element={<Protected><RequirePro><Teachers /></RequirePro></Protected>} />
      <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
      <Route path="/grades" element={<Protected><Grades /></Protected>} />
      <Route path="/certificates" element={<Protected><RequirePro><Certificates /></RequirePro></Protected>} />
      <Route path="/random" element={<Protected><RandomPicker /></Protected>} />
      <Route path="/games" element={<Protected><Games /></Protected>} />
      <Route path="/store" element={<Protected><EphataStore /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/archive" element={<Protected><RequirePro><Archive /></RequirePro></Protected>} />
      <Route path="/audit" element={<Protected><RequirePro><Audit /></RequirePro></Protected>} />
      <Route path="/notify" element={<Protected><RequirePro><Notify /></RequirePro></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
