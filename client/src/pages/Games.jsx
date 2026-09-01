import { useEffect, useState } from 'react';
import api from '../api';

const STORE_URL = 'https://ephatastore.com';

export default function Games() {
  const [defaults, setDefaults] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [playing, setPlaying] = useState(null); // game đang chơi (iframe)
  const [loading, setLoading] = useState(true);

  function loadAll() {
    Promise.all([
      api.get('/default-games').then((r) => r.data).catch(() => []),
      api.get('/user-games').then((r) => r.data).catch(() => []),
    ]).then(([d, m]) => { setDefaults(d); setMyGames(m); }).finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  async function removeMine(g) {
    if (!confirm(`Gỡ liên kết "${g.title}" khỏi kho game của bạn?`)) return;
    try { await api.delete(`/user-games/${g.id}`); loadAll(); }
    catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }

  function card(g, onRemove) {
    return (
      <div key={g.id} className="game-card">
        {onRemove && <button className="ug-remove" title="Gỡ liên kết" onClick={() => onRemove(g)}>×</button>}
        <div className="game-thumb" style={{ background: g.color || '#2563eb', cursor: 'pointer' }} onClick={() => setPlaying(g)}>
          <span>{g.icon || '◈'}</span>
        </div>
        <div className="game-name">{g.title}</div>
        <div className="ug-actions">
          <button className="btn ghost sm" onClick={() => setPlaying(g)}>▶ Chơi</button>
          {onRemove && <button className="btn danger sm" onClick={() => onRemove(g)}>Gỡ</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Game học giáo lý</h1>
        <a className="btn" href={STORE_URL} target="_blank" rel="noopener noreferrer">+ Thêm game từ Ephata Store ↗</a>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>
        Game mặc định có sẵn cho mọi tài khoản. Muốn thêm game riêng, chọn ở <b>Ephata Store</b> rồi bấm "Thêm vào Giáo Lý Số".
      </p>

      {loading ? (
        <div className="panel"><p className="muted">Đang tải…</p></div>
      ) : (
        <>
          {defaults.length > 0 && (
            <div className="panel">
              <div className="card-head">
                <h2 style={{ margin: 0 }}>Game mặc định</h2>
                <span className="muted" style={{ fontSize: 13 }}>Có sẵn cho mọi tài khoản</span>
              </div>
              <div className="game-grid">{defaults.map((g) => card(g))}</div>
            </div>
          )}

          {myGames.length > 0 ? (
            <div className="panel">
              <div className="card-head">
                <h2 style={{ margin: 0 }}>Game của tôi</h2>
                <span className="muted" style={{ fontSize: 13 }}>Đã thêm từ Ephata Store</span>
              </div>
              <div className="game-grid">{myGames.map((g) => card(g, removeMine))}</div>
            </div>
          ) : (
            <div className="panel"><p className="muted" style={{ margin: 0 }}>Chưa thêm game riêng nào. Bấm "+ Thêm game từ Ephata Store" để chọn thêm.</p></div>
          )}
        </>
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
    </div>
  );
}
