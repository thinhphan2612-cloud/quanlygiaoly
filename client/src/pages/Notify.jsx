import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';

export default function Notify() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [picked, setPicked] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sent, setSent] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function loadSent() { api.get('/notifications/sent').then((r) => setSent(r.data)).catch(() => {}); }
  useEffect(() => {
    api.get('/auth/users').then((r) => setTeachers(r.data.filter((u) => u.role === 'teacher')));
    loadSent();
  }, []);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên gửi thông báo.</div>;

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allIds = teachers.map((t) => t.id);
  const allChecked = picked.length === teachers.length && teachers.length > 0;

  async function send() {
    setErr(''); setMsg('');
    if (!picked.length) { setErr('Chọn ít nhất 1 giáo lý viên'); return; }
    if (!content.trim()) { setErr('Nhập nội dung thông báo'); return; }
    try {
      const r = await api.post('/notifications', { recipient_ids: picked, title: title.trim(), content: content.trim() });
      setMsg(`Đã gửi đến ${r.data.count} giáo lý viên.`);
      setTitle(''); setContent(''); setPicked([]);
      loadSent();
    } catch (e) { setErr(e.response?.data?.error || 'Gửi thất bại'); }
  }

  return (
    <div>
      <h1>Thông báo đến giáo lý viên</h1>
      {msg && <div className="info-box">{msg}</div>}
      {err && <div className="error">{err}</div>}

      <div className="notify-layout">
        <div className="panel">
          <h2>Soạn thông báo</h2>
          <div className="field"><label>Tiêu đề</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch học tuần này" /></div>
          <div className="field"><label>Nội dung *</label><textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ghi nội dung thông báo..." /></div>
          <div className="field">
            <label>Người nhận * <span className="muted">({picked.length} đã chọn)</span></label>
            <div className="teacher-picker">
              {teachers.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Chưa có giáo lý viên. Thêm ở trang "Giáo lý viên".</div>}
              {teachers.length > 0 && (
                <label className="tp-row" style={{ fontWeight: 600 }}>
                  <span className="tp-check"><input type="checkbox" checked={allChecked} onChange={() => setPicked(allChecked ? [] : allIds)} /><span>Tất cả</span></span>
                </label>
              )}
              {teachers.map((t) => (
                <label className="tp-row" key={t.id}>
                  <span className="tp-check"><input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} /><span>{t.full_name}</span></span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn" onClick={send}>Gửi thông báo</button>
        </div>

        <div className="panel">
          <h2>Lịch sử đã gửi</h2>
          <div className="table-scroll" style={{ maxHeight: 480 }}>
            <table>
              <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Người nhận</th></tr></thead>
              <tbody>
                {sent.map((n) => (
                  <tr key={n.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{n.title ? <b>{n.title}</b> : ''} {n.content}</td>
                    <td>{n.recipient_name}{n.read ? ' ✓' : ''}</td>
                  </tr>
                ))}
                {sent.length === 0 && <tr><td colSpan={3} className="muted">Chưa gửi thông báo nào</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
