import { useEffect, useState } from 'react';
import api from '../api';

const STORE_URL = 'https://ephatastore.com';

export default function Games() {
  const [myGames, setMyGames] = useState([]);
  const [playing, setPlaying] = useState(null); // game đang chơi (iframe)
  const [loading, setLoading] = useState(true);

  function loadMine() {
    api.get('/user-games').then((r) => setMyGames(r.data)).catch(() => setMyGames([])).finally(() => setLoading(false));
  }
  useEffect(() => { loadMine(); }, []);

  async function removeMine(g) {
    if (!confirm(`Gỡ liên kết "${g.title}" khỏi kho game của bạn?`)) return;
    try { await api.delete(`/user-games/${g.id}`); loadMine(); }
    catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Game học giáo lý</h1>
        <a className="btn" href={STORE_URL} target="_blank" rel="noopener noreferrer">+ Thêm game từ Ephata Store ↗</a>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>
        Chọn game ở <b>Ephata Store</b> rồi bấm "Thêm vào Giáo Lý Số" — game sẽ xuất hiện tại đây để chơi ngay trong ứng dụng.
      </p>

      {loading ? (
        <div className="panel"><p className="muted">Đang tải…</p></div>
      ) : myGames.length === 0 ? (
        <div className="panel coming-hero">
          <div style={{ fontSize: 44 }}>🎮</div>
          <h2 style={{ margin: '8px 0 4px' }}>Chưa có game nào</h2>
          <p className="muted" style={{ margin: '0 0 14px' }}>Khám phá kho game giáo lý ở Ephata Store và thêm về để chơi trong ứng dụng.</p>
          <a className="btn" href={STORE_URL} target="_blank" rel="noopener noreferrer">Mở Ephata Store ↗</a>
        </div>
      ) : (
        <div className="panel">
          <div className="card-head">
            <h2 style={{ margin: 0 }}>Game của tôi</h2>
            <span className="muted" style={{ fontSize: 13 }}>Đã thêm từ Ephata Store</span>
          </div>
          <div className="game-grid">
            {myGames.map((g) => (
              <div key={g.id} className="game-card">
                <button className="ug-remove" title="Gỡ liên kết" onClick={() => removeMine(g)}>×</button>
                <div className="game-thumb" style={{ background: '#2563eb', cursor: 'pointer' }} onClick={() => setPlaying(g)}>
                  <span>{g.icon || '◈'}</span>
                </div>
                <div className="game-name">{g.title}</div>
                <div className="ug-actions">
                  <button className="btn ghost sm" onClick={() => setPlaying(g)}>▶ Chơi</button>
                  <button className="btn danger sm" onClick={() => removeMine(g)}>Gỡ</button>
                </div>
              </div>
            ))}
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
    </div>
  );
}
