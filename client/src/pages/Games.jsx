import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { rank, isPro } from '../lib/plans';
import PricingModal from '../components/PricingModal.jsx';

const PALETTE = ['#2563eb', '#f59e0b', '#15803d', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#0ea5e9'];
const emptyGame = { name: '', description: '', url: '', emoji: '🎮', color: '#2563eb', min_plan: 'pro', order_index: 0 };
// Tạm thời chưa mở game -> hiển thị "Sắp ra mắt". Đổi thành false khi game sẵn sàng.
const COMING_SOON = true;

export default function Games() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [plan, setPlan] = useState('free');
  const [games, setGames] = useState([]);
  const [open, setOpen] = useState(null);
  const [pricing, setPricing] = useState(false);
  const [manage, setManage] = useState(false);
  const [proNotice, setProNotice] = useState(false);
  const [myGames, setMyGames] = useState([]); // game user thêm từ Ephata Store
  const [playing, setPlaying] = useState(null); // game đang chơi (iframe)
  const isFree = !isPro(plan);

  function load() { api.get('/games').then((r) => setGames(r.data)); }
  function loadMine() { api.get('/user-games').then((r) => setMyGames(r.data)).catch(() => setMyGames([])); }
  useEffect(() => { api.get('/parish').then((r) => setPlan(r.data?.plan || 'free')).catch(() => {}); load(); loadMine(); }, []);
  async function removeMine(g) {
    if (!confirm(`Gỡ "${g.title}" khỏi kho game của bạn?`)) return;
    try { await api.delete(`/user-games/${g.id}`); loadMine(); } catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }

  const unlocked = (g) => rank(plan) >= rank(g.min_plan);

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Game học giáo lý</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && <button className="btn ghost" onClick={() => (isFree ? setProNotice(true) : setManage(true))}>⚙ Quản lý game</button>}
        </div>
      </div>

      {myGames.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2 style={{ margin: 0 }}>Game của tôi</h2>
            <span className="muted" style={{ fontSize: 13 }}>Đã thêm từ Ephata Store</span>
          </div>
          <div className="game-grid">
            {myGames.map((g) => (
              <div key={g.id} className="game-card" onClick={() => setPlaying(g)}>
                <button className="ug-remove" title="Gỡ khỏi kho" onClick={(e) => { e.stopPropagation(); removeMine(g); }}>×</button>
                <div className="game-thumb" style={{ background: '#2563eb' }}><span>{g.icon || '◈'}</span></div>
                <div className="game-name">{g.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {COMING_SOON ? (
        <div className="panel coming-hero">
          <div style={{ fontSize: 44 }}>🎮</div>
          <h2 style={{ margin: '8px 0 4px' }}>Sắp ra mắt</h2>
          <p className="muted" style={{ margin: 0 }}>Các game học giáo lý đang được hoàn thiện và sẽ sớm có mặt tại Ephata Store.</p>
        </div>
      ) : games.length === 0 ? (
        <div className="panel"><p className="muted">Chưa có game nào.{isAdmin ? ' Bấm "⚙ Quản lý game" để thêm.' : ''}</p></div>
      ) : (
        <div className="game-grid">
          {games.map((g) => {
            const ok = unlocked(g);
            return (
              <div key={g.id} className={`game-card ${ok ? '' : 'locked'}`} onClick={() => (ok ? setOpen(g) : setPricing(true))}>
                <div className="game-thumb" style={{ background: ok ? g.color : '#c7c9cf' }}>
                  <span>{ok ? g.emoji : '🔒'}</span>
                </div>
                <div className="game-name">{g.name}</div>
                {!ok && <div className="game-lock">Cần gói Pro</div>}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: 'center' }}>{open.emoji}</div>
            <h2 style={{ textAlign: 'center', marginTop: 6 }}>{open.name}</h2>
            {open.description && <p className="muted" style={{ textAlign: 'center' }}>{open.description}</p>}
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setOpen(null)}>Đóng</button>
              {open.url && <a className="btn" href={open.url} target="_blank" rel="noopener noreferrer">▶ Chơi ngay</a>}
            </div>
          </div>
        </div>
      )}
      {playing && (
        <div className="game-frame-overlay" onClick={() => setPlaying(null)}>
          <div className="game-frame-box" onClick={(e) => e.stopPropagation()}>
            <div className="game-frame-head">
              <span>{playing.icon || '◈'} {playing.title}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn ghost sm" href={playing.play_url} target="_blank" rel="noopener noreferrer">Mở tab mới ↗</a>
                <button className="btn ghost sm" onClick={() => setPlaying(null)}>Đóng ✕</button>
              </div>
            </div>
            <iframe className="game-frame" src={playing.play_url} title={playing.title} allow="fullscreen; autoplay; gamepad" />
          </div>
        </div>
      )}
      {pricing && <PricingModal current={plan} onClose={() => setPricing(false)} />}
      {manage && <GameManager games={games} onChange={load} onClose={() => setManage(false)} />}
      {proNotice && (
        <div className="modal-backdrop" onClick={() => setProNotice(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: 'center' }}>🎮</div>
            <h2 style={{ textAlign: 'center', marginTop: 6 }}>Cần gói Pro</h2>
            <p className="muted" style={{ textAlign: 'center' }}>Quản lý game học giáo lý là tính năng của gói Pro. Nâng cấp để mở khoá.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setProNotice(false)}>Đóng</button>
              <button className="btn" onClick={() => { setProNotice(false); setPricing(true); }}>Xem gói Pro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Quản lý game (admin) ---------------- */
function GameManager({ games, onChange, onClose }) {
  const [editing, setEditing] = useState(null); // null | game | {new}
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    if (!editing.name?.trim()) { setErr('Nhập tên game'); return; }
    try {
      if (editing.id) await api.put(`/games/${editing.id}`, editing);
      else await api.post('/games', { ...editing, order_index: games.length });
      setEditing(null); onChange();
    } catch (e) { setErr(e.response?.data?.error || 'Lưu thất bại'); }
  }
  async function del(g) {
    if (!confirm(`Xóa game "${g.name}"?`)) return;
    await api.delete(`/games/${g.id}`); onChange();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h2>Quản lý game</h2>{!editing && <button className="btn" onClick={() => setEditing({ ...emptyGame })}>+ Thêm game</button>}</div>

        {!editing ? (
          <table>
            <thead><tr><th></th><th>Tên</th><th>Gói tối thiểu</th><th>Link</th><th></th></tr></thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td><span className="game-emoji-dot" style={{ background: g.color }}>{g.emoji}</span></td>
                  <td>{g.name}</td>
                  <td>{g.min_plan === 'free' ? 'Miễn phí' : 'Pro'}</td>
                  <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.url || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setEditing({ ...g, min_plan: g.min_plan === 'free' ? 'free' : 'pro' })}>Sửa</button>{' '}
                    <button className="btn danger sm" onClick={() => del(g)}>Xóa</button>
                  </td>
                </tr>
              ))}
              {games.length === 0 && <tr><td colSpan={5} className="muted">Chưa có game</td></tr>}
            </tbody>
          </table>
        ) : (
          <>
            <div className="row">
              <div className="field" style={{ flex: 2 }}><label>Tên game *</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="field" style={{ flex: '0 0 90px' }}><label>Icon</label><input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} placeholder="🎮" /></div>
            </div>
            <div className="field"><label>Mô tả</label><textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="field"><label>Link chơi (URL)</label><input value={editing.url || ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://ephatastore.com/..." /></div>
            <div className="row">
              <div className="field">
                <label>Gói tối thiểu để mở khóa</label>
                <select value={editing.min_plan} onChange={(e) => setEditing({ ...editing, min_plan: e.target.value })}>
                  <option value="free">Miễn phí (ai cũng chơi)</option>
                  <option value="pro">Pro (cần nâng cấp)</option>
                </select>
              </div>
              <div className="field">
                <label>Màu thẻ</label>
                <div className="swatches">
                  {PALETTE.map((c) => <button key={c} type="button" className={`swatch ${editing.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setEditing({ ...editing, color: c })} />)}
                </div>
              </div>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditing(null)}>Quay lại</button>
              <button className="btn" onClick={save}>Lưu game</button>
            </div>
          </>
        )}

        {!editing && <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>}
      </div>
    </div>
  );
}
