import { useState } from 'react';
import { supabase } from '../supabase';

// Trang đặt mật khẩu khi người dùng bấm link mời / đặt lại mật khẩu trong email.
// Link mời tạo sẵn phiên đăng nhập -> ở đây bắt buộc đặt mật khẩu rồi đăng nhập lại.
export default function SetPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pw.length < 6) { setErr('Mật khẩu tối thiểu 6 ký tự'); return; }
    if (pw !== pw2) { setErr('Mật khẩu nhập lại không khớp'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => window.location.replace('/login'), 1600);
    } catch (e2) {
      setErr(e2.message || 'Không đặt được mật khẩu. Link có thể đã hết hạn, vui lòng yêu cầu gửi lại.');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">✝</div>
          <h1>Đã đặt mật khẩu</h1>
          <p className="tagline">Đang chuyển tới trang đăng nhập…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">✝</div>
        <h1>Tạo mật khẩu</h1>
        <p className="tagline">Đặt mật khẩu cho tài khoản của bạn, sau đó đăng nhập để bắt đầu.</p>
        <div className="field">
          <label>Mật khẩu mới</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Nhập lại mật khẩu</label>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Đang lưu...' : 'Đặt mật khẩu'}
        </button>
      </form>
    </div>
  );
}
