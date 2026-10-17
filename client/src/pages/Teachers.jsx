import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { toast } from '../lib/toast';
import { SkeletonRows } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import RowMenu from '../components/RowMenu.jsx';

const APP_URL = 'https://app.giaoly.com.vn';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\s.()-]{8,16}$/;
const NA = <span className="muted">–</span>;
const LEVELS = ['Dự bị', 'Cấp 1', 'Cấp 2', 'Cấp 3'];
// Bỏ dấu để tìm kiếm (gõ "nguyen" vẫn ra "Nguyễn")
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const nameOf = (u) => [u.saint_name, u.full_name].filter(Boolean).join(' ');
function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* thử cách cũ */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
  } catch { return false; }
}
const loginText = (name, email, pw) => `Tài khoản Giáo Lý Số của ${name}\nĐịa chỉ: ${APP_URL}\nEmail: ${email}\nMật khẩu: ${pw}\nSau khi đăng nhập, vui lòng đổi mật khẩu (bấm vào tên ở góc phải, chọn Đổi mật khẩu).`;

export default function Teachers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [onlyFree, setOnlyFree] = useState(false); // chỉ người chưa phân lớp
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwFor, setPwFor] = useState(null);

  function load() { api.get('/auth/users').then((r) => { setUsers(r.data); setLoaded(true); }).catch(() => setLoaded(true)); }
  useEffect(() => { if (user?.role === 'admin') load(); }, [user]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên được quản lý tài khoản.</div>;

  async function remove(u) {
    const cls = u.classes || [];
    const msg = `Xóa tài khoản ${nameOf(u)}?\n\nNgười này sẽ không đăng nhập được nữa.`
      + (cls.length ? `\n\nCác lớp đang phụ trách (${cls.join(', ')}) sẽ mất người này trong phân công. Nhớ phân công người khác ở trang Lớp học.` : '')
      + '\n\nĐiểm danh, điểm số đã nhập vẫn giữ nguyên.';
    if (!await confirmDialog(msg)) return;
    try { await api.delete(`/auth/users/${u.id}`); toast(`Đã xóa tài khoản ${nameOf(u)}`); load(); }
    catch (err) { toast.err(err.response?.data?.error || 'Xóa thất bại'); }
  }

  const freeCount = users.filter((u) => u.role !== 'admin' && !(u.classes || []).length).length;
  const fq = fold(q.trim());
  const shown = users.filter((u) => {
    if (onlyFree && (u.role === 'admin' || (u.classes || []).length)) return false;
    if (fq && !fold([u.saint_name, u.full_name, u.email, u.phone, u.area].filter(Boolean).join(' ')).includes(fq)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Quản lý giáo lý viên" subtitle="Tài khoản đăng nhập của giáo lý viên và lớp mỗi người phụ trách.">
        <button data-tour="teacher-add" className="btn" onClick={() => setCreating(true)}>+ Thêm giáo lý viên</button>
      </PageHeader>

      <div className="toolbar">
        <input className="grow stu-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, email, SĐT, khu vực…" aria-label="Tìm giáo lý viên" />
      </div>
      <div className="tcx-count">
        <span>{loaded ? (shown.length === users.length ? `${users.length} tài khoản` : `Đang hiện ${shown.length} / ${users.length} tài khoản`) : ''}</span>
        {freeCount > 0 && (
          <button type="button" className={`tcx-chip${onlyFree ? ' on' : ''}`} onClick={() => setOnlyFree((v) => !v)}>
            Chưa phân lớp <b>{freeCount}</b>{onlyFree && <span aria-hidden="true"> ×</span>}
          </button>
        )}
      </div>

      <div className="panel">
        <table className="tcx-table">
          <thead>
            <tr><th>Họ tên</th><th>Liên hệ</th><th>Lớp phụ trách</th><th>Cấp · Khu vực</th><th></th></tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRows rows={5} cols={5} />}
            {shown.map((u) => {
              const cls = u.classes || [];
              const isAdm = u.role === 'admin';
              return (
                <tr key={u.id}>
                  <td className="tcx-c-name">
                    <span className="tcx-name">{u.saint_name && <small>{u.saint_name}</small>}<b>{u.full_name || 'Chưa đặt tên'}</b></span>
                    {isAdm && <span className="tag-chip tone-indigo">Quản trị</span>}
                    {u.id === user.id && <span className="muted tcx-me">(bạn)</span>}
                  </td>
                  <td data-label="Liên hệ"><span className="tcx-contact">{u.email || NA}{u.phone && <small>{u.phone}</small>}</span></td>
                  <td data-label="Lớp">
                    {cls.length ? <span className="tcx-classes">{cls.map((c) => <span key={c} className="tcx-cls">{c}</span>)}</span>
                      : isAdm ? NA : <button type="button" className="tcx-free" onClick={() => navigate('/classes')} title="Phân công ở trang Lớp học (nút Sửa của lớp)">Chưa phân lớp</button>}
                  </td>
                  <td data-label="Cấp, khu vực">{[u.glv_level, u.area].filter(Boolean).join(' · ') || NA}</td>
                  <td className="tcx-c-act">
                    <button className="btn ghost sm" onClick={() => setEditing(u)}>Sửa</button>
                    <RowMenu items={[
                      { label: 'Cấp lại mật khẩu', onClick: () => setPwFor(u) },
                      !isAdm && u.id !== user.id && { label: 'Xóa tài khoản…', danger: true, onClick: () => remove(u) },
                    ]} />
                  </td>
                </tr>
              );
            })}
            {loaded && shown.length === 0 && <tr className="tcx-empty"><td colSpan={5} className="muted">{users.length ? 'Không có ai khớp tìm kiếm.' : 'Chưa có giáo lý viên. Bấm "Thêm giáo lý viên" để tạo tài khoản.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted tcx-foot">Phân công lớp ở trang <span className="link" onClick={() => navigate('/classes')}>Lớp học</span> (nút Sửa của từng lớp). Thêm quản trị viên ở Cài đặt, mục Gói, quản trị viên.</p>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={load} />}
      {editing && <EditModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {pwFor && <PasswordModal target={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}

/* Ô mật khẩu: che/hiện + tạo ngẫu nhiên */
function PwField({ value, onChange, show, setShow, label, tour }) {
  return (
    <div className="field"><label>{label}</label>
      <div className="tcx-pw">
        <input data-tour={tour} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" />
        <button type="button" className="btn ghost sm" onClick={() => setShow(!show)}>{show ? 'Ẩn' : 'Hiện'}</button>
        <button type="button" className="btn ghost sm" onClick={() => { onChange(genPassword()); setShow(true); }}>Tạo ngẫu nhiên</button>
      </div>
    </div>
  );
}

/* Kết quả có thông tin đăng nhập để sao chép gửi cho giáo lý viên */
function LoginInfo({ name, email, password, note }) {
  const [copied, setCopied] = useState(false);
  const text = loginText(name, email, password);
  return (
    <div className="tcx-done">
      {note && <p className="tcx-note">{note}</p>}
      <pre className="tcx-login">{text}</pre>
      <button type="button" className="btn" onClick={async () => { const ok = await copyText(text); setCopied(ok); if (!ok) toast.err('Không sao chép được, hãy bôi đen và sao chép thủ công'); }}>
        {copied ? 'Đã sao chép' : 'Sao chép thông tin đăng nhập'}
      </button>
      <p className="muted tcx-hint">Dán gửi cho giáo lý viên qua Zalo hoặc tin nhắn. Mật khẩu chỉ hiện lần này.</p>
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [f, setF] = useState({ full_name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const busy = useRef(false);
  const dirty = !done && (f.full_name || f.email || f.password);

  async function close() {
    if (busy.current) return;
    if (dirty && !(await confirmDialog('Bỏ thông tin vừa nhập?'))) return;
    onClose();
  }
  async function save() {
    if (busy.current) return;
    const name = f.full_name.trim(); const email = f.email.trim().toLowerCase();
    const err = !name ? 'Vui lòng nhập họ tên.' : !EMAIL_RE.test(email) ? 'Email chưa đúng dạng, ví dụ ten@gmail.com.' : f.password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự.' : '';
    if (err) { setError(err); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      const r = await api.post('/auth/users', { email, password: f.password, full_name: name });
      setDone({ name, email, password: f.password, restored: !!r.data?.restored });
      toast(`Đã tạo tài khoản cho ${name}`);
      onCreated();
    } catch (e) { setError(e.response?.data?.error || 'Tạo tài khoản thất bại'); }
    finally { busy.current = false; setSaving(false); }
  }
  const again = () => { setDone(null); setF({ full_name: '', email: '', password: '' }); setShow(false); };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tcxCreateT">
        <h2 id="tcxCreateT">{done ? 'Đã tạo tài khoản' : 'Thêm giáo lý viên'}</h2>
        {done ? (
          <>
            <LoginInfo name={done.name} email={done.email} password={done.password}
              note={done.restored ? 'Email này từng có tài khoản đã bị xóa trước đây. Hệ thống đã khôi phục tài khoản đó vào giáo xứ với mật khẩu mới.' : ''} />
            <div className="modal-actions">
              <button className="btn ghost" onClick={again}>Thêm người khác</button>
              <button className="btn" onClick={onClose}>Xong</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted tcx-sub">Tạo tài khoản đăng nhập. Sau khi tạo, bạn sao chép thông tin gửi cho giáo lý viên.</p>
            <div className="field"><label>Họ tên *</label><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} autoFocus placeholder="VD: Maria Nguyễn Thị Hoa" /></div>
            <div className="field"><label>Email đăng nhập *</label><input data-tour="teacher-form-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="glv@gmail.com" autoComplete="off" /></div>
            <PwField label="Mật khẩu *" value={f.password} onChange={(v) => setF({ ...f, password: v })} show={show} setShow={setShow} />
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={close} disabled={saving}>Hủy</button>
              <button data-tour="teacher-form-save" className="btn" onClick={save} disabled={saving}>{saving ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditModal({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const start = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(f) !== start.current;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const F = (k) => f[k] || '';

  async function close() {
    if (busy.current) return;
    if (dirty && !(await confirmDialog('Bỏ các thay đổi chưa lưu?'))) return;
    onClose();
  }
  async function save() {
    if (busy.current) return;
    if (!String(f.full_name || '').trim()) { setError('Vui lòng nhập họ tên.'); return; }
    const ph = String(f.phone || '').trim();
    if (ph && !PHONE_RE.test(ph)) { setError('Số điện thoại chỉ gồm số, 8 đến 16 ký tự.'); return; }
    busy.current = true; setSaving(true); setError('');
    try { await api.put(`/auth/users/${f.id}`, f); toast(`Đã lưu hồ sơ ${f.full_name.trim()}`); onSaved(); }
    catch (e) { setError(e.response?.data?.error || 'Lưu thất bại'); }
    finally { busy.current = false; setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tcxEditT">
        <h2 id="tcxEditT">Hồ sơ: {initial.full_name}</h2>
        <p className="muted tcx-sub">Email đăng nhập: <b>{initial.email}</b></p>
        <div className="tcx-grid">
          <div className="field"><label>Tên thánh</label><input value={F('saint_name')} onChange={set('saint_name')} /></div>
          <div className="field"><label>Họ tên *</label><input value={F('full_name')} onChange={set('full_name')} /></div>
          <div className="field"><label>Ngày sinh</label><input type="date" value={F('birth_date')} onChange={set('birth_date')} /></div>
          <div className="field"><label>Cấp giáo lý viên</label>
            <input list="tcx-levels" value={F('glv_level')} onChange={set('glv_level')} placeholder="Chọn hoặc gõ" />
            <datalist id="tcx-levels">{LEVELS.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <div className="field"><label>Số điện thoại</label><input inputMode="tel" value={F('phone')} onChange={set('phone')} /></div>
          <div className="field"><label>Khu vực</label><input value={F('area')} onChange={set('area')} placeholder="VD: Khu 3" /></div>
          <div className="field"><label>Nghề nghiệp</label><input value={F('occupation')} onChange={set('occupation')} /></div>
          <div className="field"><label>Địa chỉ</label><input value={F('address')} onChange={set('address')} /></div>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          {dirty && <span className="tcx-dirty">Có thay đổi chưa lưu</span>}
          <button className="btn ghost" onClick={close} disabled={saving}>Hủy</button>
          <button className="btn" onClick={save} disabled={saving || !dirty}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ target, onClose }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function save() {
    if (busy) return;
    if (pw.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự.'); return; }
    setBusy(true); setError('');
    try { await api.post(`/auth/users/${target.id}/password`, { password: pw }); setDone(true); toast(`Đã cấp mật khẩu mới cho ${target.full_name}`); }
    catch (e) { setError(e.response?.data?.error || 'Cấp lại mật khẩu thất bại'); }
    finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tcxPwT">
        <h2 id="tcxPwT">Cấp lại mật khẩu: {target.full_name}</h2>
        {done ? (
          <>
            <LoginInfo name={nameOf(target)} email={target.email} password={pw} />
            <div className="modal-actions"><button className="btn" onClick={onClose}>Xong</button></div>
          </>
        ) : (
          <>
            <p className="muted tcx-sub">Đặt mật khẩu mới rồi gửi cho người này. Mật khẩu cũ sẽ không dùng được nữa.</p>
            <PwField label="Mật khẩu mới" value={pw} onChange={setPw} show={show} setShow={setShow} />
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
              <button className="btn" onClick={save} disabled={busy || !pw}>{busy ? 'Đang đặt…' : 'Cấp mật khẩu mới'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
