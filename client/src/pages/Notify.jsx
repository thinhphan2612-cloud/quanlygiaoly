import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import { timeAgo, fullDateTime } from '../lib/date';
import { byViName } from '../lib/viName';
import PageHeader from '../components/PageHeader.jsx';

const MAX_TITLE = 120;
const MAX_CONTENT = 1000;
// Bỏ dấu để tìm kiếm (gõ "nguyen" vẫn ra "Nguyễn")
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const nameOf = (u) => [u.saint_name, u.full_name].filter(Boolean).join(' ');
const classNames = (u) => (u.classes || []).map((c) => c.replace(/ \(chính\)$/, ''));

// Mỗi người nhận là một dòng; các dòng cùng một lần gửi có cùng created_at (một lệnh insert).
function groupSent(rows) {
  const map = new Map();
  rows.forEach((n) => {
    const key = [n.created_at, n.sender_id, n.title, n.content].join('|');
    if (!map.has(key)) map.set(key, { key, title: n.title, content: n.content, created_at: n.created_at, sender_id: n.sender_id, sender_name: n.sender_name, items: [] });
    map.get(key).items.push(n);
  });
  return [...map.values()];
}

export default function Notify() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const [sent, setSent] = useState([]);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [open, setOpen] = useState(null); // lần gửi đang mở danh sách người nhận

  function loadSent() { api.get('/notifications/sent').then((r) => setSent(r.data)).catch(() => {}).finally(() => setSentLoaded(true)); }
  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/auth/users')
      .then((r) => setPeople(r.data.filter((u) => u.id !== user.id).sort(byViName)))
      .catch(() => toast.err('Không tải được danh sách giáo lý viên'))
      .finally(() => setLoaded(true));
    loadSent();
  }, [user]);
  // Cập nhật số "đã xem" khi giáo lý viên mở chuông
  const rev = useRealtime(['notifications']);
  useEffect(() => { if (rev && user?.role === 'admin') loadSent(); }, [rev]);

  const groups = useMemo(() => groupSent(sent), [sent]);
  // Nhóm chọn nhanh: tất cả, chưa phân lớp, từng lớp đang dạy
  const quick = useMemo(() => {
    const byClass = {};
    people.forEach((u) => classNames(u).forEach((c) => { (byClass[c] = byClass[c] || []).push(u.id); }));
    const free = people.filter((u) => u.role !== 'admin' && !(u.classes || []).length).map((u) => u.id);
    return [
      { label: 'Tất cả', ids: people.map((u) => u.id) },
      ...(free.length ? [{ label: 'Chưa phân lớp', ids: free }] : []),
      ...Object.keys(byClass).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })).map((c) => ({ label: c, ids: byClass[c] })),
    ];
  }, [people]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên gửi thông báo.</div>;

  const pickedSet = new Set(picked);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allIn = (ids) => ids.length > 0 && ids.every((id) => pickedSet.has(id));
  function toggleGroup(ids) {
    if (allIn(ids)) setPicked((p) => p.filter((id) => !ids.includes(id)));
    else setPicked((p) => [...new Set([...p, ...ids])]);
  }
  const fq = fold(q.trim());
  const shown = fq ? people.filter((u) => fold([nameOf(u), u.email, ...classNames(u)].join(' ')).includes(fq)) : people;

  async function send() {
    if (busy.current) return;
    if (!content.trim()) { toast.err('Nhập nội dung thông báo'); return; }
    if (!picked.length) { toast.err('Chọn ít nhất 1 người nhận'); return; }
    busy.current = true; setSending(true);
    try {
      const r = await api.post('/notifications', { recipient_ids: picked, title: title.trim(), content: content.trim() });
      toast(`Đã gửi đến ${r.data.count} người`);
      setTitle(''); setContent(''); setPicked([]); setQ('');
      loadSent();
    } catch (e) { toast.err(e.response?.data?.error || 'Gửi thất bại'); }
    finally { busy.current = false; setSending(false); }
  }

  async function recall(g) {
    const seen = g.items.filter((n) => n.read).length;
    const msg = `Thu hồi thông báo "${g.title || 'Thông báo'}"?\n\nTin sẽ biến mất khỏi chuông của ${g.items.length} người nhận.`
      + (seen ? ` ${seen} người đã xem nên có thể đã đọc nội dung.` : '');
    if (!await confirmDialog({ message: msg, okText: 'Thu hồi', danger: true })) return;
    try { await api.post('/notifications/recall', { ids: g.items.map((n) => n.id) }); toast('Đã thu hồi thông báo'); setOpen(null); loadSent(); }
    catch (e) { toast.err(e.response?.data?.error || 'Thu hồi thất bại'); }
  }

  return (
    <div>
      <PageHeader title="Thông báo đến giáo lý viên" subtitle="Tin gửi đi hiện ở chuông thông báo trong ứng dụng của người nhận." />

      <div className="notify-layout">
        <div className="panel">
          <h2>Soạn thông báo</h2>
          <div className="field"><label>Tiêu đề</label>
            <input value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch học tuần này" />
          </div>
          <div className="field">
            <label className="ntx-label">Nội dung * <span className={`ntx-count${content.length > MAX_CONTENT * 0.9 ? ' warn' : ''}`}>{content.length}/{MAX_CONTENT}</span></label>
            <textarea rows={5} maxLength={MAX_CONTENT} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ghi nội dung thông báo. Xuống dòng được giữ nguyên." />
          </div>

          <div className="field">
            <label className="ntx-label">
              <span>Người nhận * <span className="muted">({picked.length} đã chọn)</span></span>
              {picked.length > 0 && <button type="button" className="ntx-clear" onClick={() => setPicked([])}>Bỏ chọn</button>}
            </label>
            {!loaded ? <div className="muted ntx-empty">Đang tải danh sách…</div>
              : people.length === 0 ? (
                <div className="muted ntx-empty">Chưa có giáo lý viên. <span className="link" onClick={() => navigate('/teachers')}>Thêm ở trang Giáo lý viên</span>.</div>
              ) : (
                <>
                  <div className="ntx-quick">
                    {quick.map((g) => (
                      <button key={g.label} type="button" className={`ntx-chip${allIn(g.ids) ? ' on' : ''}`} onClick={() => toggleGroup(g.ids)}>
                        {g.label} <b>{g.ids.length}</b>
                      </button>
                    ))}
                  </div>
                  {people.length > 6 && (
                    <input className="ntx-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, lớp…" aria-label="Tìm người nhận" />
                  )}
                  <div className="teacher-picker ntx-picker">
                    {shown.map((u) => (
                      <label className="tp-row" key={u.id}>
                        <span className="tp-check">
                          <input type="checkbox" checked={pickedSet.has(u.id)} onChange={() => toggle(u.id)} />
                          <span className="ntx-person">
                            <span>{nameOf(u) || u.email}{u.role === 'admin' && <span className="tag-chip tone-indigo">Quản trị</span>}</span>
                            <small>{classNames(u).join(', ') || (u.role === 'admin' ? '' : 'Chưa phân lớp')}</small>
                          </span>
                        </span>
                      </label>
                    ))}
                    {shown.length === 0 && <div className="muted ntx-empty">Không có ai khớp tìm kiếm.</div>}
                  </div>
                </>
              )}
          </div>
          <button className="btn" onClick={send} disabled={sending}>{sending ? 'Đang gửi…' : picked.length ? `Gửi đến ${picked.length} người` : 'Gửi thông báo'}</button>
        </div>

        <div className="panel">
          <h2>Đã gửi</h2>
          {!sentLoaded && <div className="muted ntx-empty">Đang tải…</div>}
          {sentLoaded && groups.length === 0 && <div className="muted ntx-empty">Chưa gửi thông báo nào.</div>}
          <div className="ntx-list">
            {groups.map((g) => {
              const seen = g.items.filter((n) => n.read);
              const unseen = g.items.filter((n) => !n.read);
              const isOpen = open === g.key;
              return (
                <div key={g.key} className="ntx-item">
                  <div className="ntx-head">
                    <b>{g.title || 'Thông báo'}</b>
                    <span className="muted" title={fullDateTime(g.created_at)}>{timeAgo(g.created_at)}</span>
                  </div>
                  <div className="ntx-body">{g.content}</div>
                  <div className="ntx-meta">
                    <span className="ntx-bar" aria-hidden="true"><span style={{ width: `${(seen.length / g.items.length) * 100}%` }} /></span>
                    <span>Gửi {g.items.length} người · {seen.length} đã xem</span>
                    {g.sender_id !== user.id && g.sender_name && <span className="muted">Người gửi: {g.sender_name}</span>}
                  </div>
                  <div className="ntx-actions">
                    <button type="button" className="btn ghost sm" onClick={() => setOpen(isOpen ? null : g.key)} aria-expanded={isOpen}>{isOpen ? 'Ẩn người nhận' : 'Xem người nhận'}</button>
                    <button type="button" className="btn ghost sm ntx-recall" onClick={() => recall(g)}>Thu hồi…</button>
                  </div>
                  {isOpen && (
                    <div className="ntx-who">
                      <div><div className="ntx-who-h">Đã xem ({seen.length})</div>{seen.map((n) => <div key={n.id}>{n.recipient_name || 'Tài khoản đã xóa'}</div>)}{!seen.length && <div className="muted">Chưa ai</div>}</div>
                      <div><div className="ntx-who-h">Chưa xem ({unseen.length})</div>{unseen.map((n) => <div key={n.id}>{n.recipient_name || 'Tài khoản đã xóa'}</div>)}{!unseen.length && <div className="muted">Không còn ai</div>}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {groups.length > 0 && <p className="muted ntx-note">"Đã xem" nghĩa là người nhận đã mở chuông thông báo sau khi tin đến.</p>}
        </div>
      </div>
    </div>
  );
}
