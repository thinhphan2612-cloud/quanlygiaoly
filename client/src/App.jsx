import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import Classes from './pages/Classes.jsx';
import Teachers from './pages/Teachers.jsx';
import Attendance from './pages/Attendance.jsx';
import Grades from './pages/Grades.jsx';
import RandomPicker from './pages/RandomPicker.jsx';
import Games from './pages/Games.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/students" element={<Protected><Students /></Protected>} />
      <Route path="/classes" element={<Protected><Classes /></Protected>} />
      <Route path="/teachers" element={<Protected><Teachers /></Protected>} />
      <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
      <Route path="/grades" element={<Protected><Grades /></Protected>} />
      <Route path="/random" element={<Protected><RandomPicker /></Protected>} />
      <Route path="/games" element={<Protected><Games /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
