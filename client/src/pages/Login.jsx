import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login({ initialMode = 'login' }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  // đã đăng nhập mà vào /login hoặc /register -> đưa thẳng vào ứng dụng
  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user]);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', parish_name: '', diocese: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/');
      } else {
        const res = await register(form);
        if (res.needConfirm) {
          setInfo('Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư rồi đăng nhập.');
          setMode('login');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  const isReg = mode === 'register';

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">✝</div>
        <h1>Quản lý Giáo lý</h1>
        <p className="tagline">{isReg ? 'Đăng ký giáo xứ mới' : 'Đăng nhập để tiếp tục'}</p>

        {isReg && (
          <>
            <div className="field">
              <label>Họ tên quản trị viên</label>
              <input value={form.full_name} onChange={set('full_name')} required autoFocus />
            </div>
            <div className="field">
              <label>Tên giáo xứ</label>
              <input value={form.parish_name} onChange={set('parish_name')} placeholder="VD: Giáo xứ Tân Định" required />
            </div>
            <div className="field">
              <label>Giáo phận</label>
              <input value={form.diocese} onChange={set('diocese')} placeholder="VD: TGP Sài Gòn" />
            </div>
          </>
        )}

        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required autoFocus={!isReg} />
        </div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={form.password} onChange={set('password')} required />
        </div>

        {error && <div className="error">{error}</div>}
        {info && <div className="info-box">{info}</div>}

        <button className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Đang xử lý...' : isReg ? 'Tạo giáo xứ' : 'Đăng nhập'}
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          {isReg ? 'Đã có tài khoản? ' : 'Chưa có giáo xứ? '}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setError(''); setInfo(''); setMode(isReg ? 'login' : 'register'); }}
            style={{ color: 'var(--primary)', fontWeight: 600 }}
          >
            {isReg ? 'Đăng nhập' : 'Đăng ký giáo xứ mới'}
          </a>
        </p>
      </form>
    </div>
  );
}
