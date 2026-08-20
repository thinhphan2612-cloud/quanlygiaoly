import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

// Đọc profile (parish_id, role, họ tên...) của user đang đăng nhập.
// Trigger tạo profile khi signup có thể chậm 1 nhịp → thử lại vài lần.
async function loadProfile(authUser, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('id, parish_id, role, full_name')
      .eq('id', authUser.id)
      .maybeSingle();
    if (data) {
      return {
        id: data.id,
        email: authUser.email,
        full_name: data.full_name,
        role: data.role,
        parish_id: data.parish_id,
      };
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { id: authUser.id, email: authUser.email, full_name: '', role: 'teacher', parish_id: null };
}

function persist(user) {
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Khôi phục phiên khi tải lại trang
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const u = await loadProfile(session.user);
        persist(u);
        setUser(u);
      } else {
        persist(null);
        setUser(null);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        persist(null);
        setUser(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(mapAuthError(error.message));
    const u = await loadProfile(data.user);
    persist(u);
    setUser(u);
    return u;
  }

  // Đăng ký = tạo giáo xứ mới + tài khoản admin (trigger handle_new_user lo phần này)
  async function register({ email, password, full_name, parish_name, diocese }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, parish_name, diocese } },
    });
    if (error) throw new Error(mapAuthError(error.message));
    // Nếu email confirmation đang bật, chưa có session → báo người dùng xác nhận email.
    if (!data.session) return { needConfirm: true };
    const u = await loadProfile(data.user);
    persist(u);
    setUser(u);
    return { needConfirm: false, user: u };
  }

  async function logout() {
    await supabase.auth.signOut();
    persist(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function mapAuthError(msg = '') {
  if (/invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu';
  if (/already registered|already exists/i.test(msg)) return 'Email này đã được đăng ký';
  if (/password should be at least/i.test(msg)) return 'Mật khẩu tối thiểu 6 ký tự';
  return msg || 'Có lỗi xảy ra';
}

export function useAuth() {
  return useContext(AuthContext);
}
