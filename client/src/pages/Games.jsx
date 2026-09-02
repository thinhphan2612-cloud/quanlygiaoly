import { useEffect, useState } from 'react';
import api from '../api';

const STORE_URL = 'https://ephatastore.com';

// Game host trên Supabase Storage: index.html bị Supabase ép về text/plain +
// nosniff (chặn host HTML) nên KHÔNG render khi iframe trỏ src thẳng. Cách chạy:
// fetch nội dung HTML rồi nạp bằng srcdoc, chèn <base href> để CSS/JS/ảnh (được
// Storage phục vụ đúng type) tải theo đường dẫn tương đối.
const isStorageGame = (u) => typeof u === 'string' && u.includes('/storage/v1/object/public/');
function injectBase(html, base) {
  const tag = `<base href="${base}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + html;
}

export default function Games() {
  const [defaults, setDefaults] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [playing, setPlaying] = useState(null); // game đang chơi (iframe)
  const [gameDoc, setGameDoc] = useState(null);  // srcdoc cho game host trên Storage
  const [loading, setLoading] = useState(true);

  function loadAll() {
    Promise.all([
      api.get('/default-games').then((r) => r.data).catch(() => []),
      api.get('/user-games').then((r) => r.data).catch(() => []),
    ]).then(([d, m]) => { setDefaults(d); setMyGames(m); }).finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  // Nạp nội dung HTML cho game host trên Storage (dùng srcdoc + <base href>).
  useEffect(() => {
    setGameDoc(null);
    if (!playing || !isStorageGame(playing.play_url)) return;
    const base = playing.play_url.slice(0, playing.play_url.lastIndexOf('/') + 1);
    let alive = true;
    fetch(playing.play_url)
      .then((r) => r.text())
      .then((html) => { if (alive) setGameDoc(injectBase(html, base)); })
      .catch(() => { if (alive) setGameDoc('<p style="font-family:sans-serif;padding:16px">Không tải được game.</p>'); });
    return () => { alive = false; };
  }, [playing]);

  function openGameTab() {
    if (!gameDoc) return;
    const url = URL.createObjectURL(new Blob([gameDoc], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

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
          {g.thumb_url ? <img className="game-thumb-img" src={g.thumb_url} alt={g.title} /> : <span>{g.icon || '◈'}</span>}
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
                {isStorageGame(playing.play_url)
                  ? <button className="btn ghost sm" onClick={openGameTab} disabled={!gameDoc}>Mở tab mới ↗</button>
                  : <a className="btn ghost sm" href={playing.play_url} target="_blank" rel="noopener noreferrer">Mở tab mới ↗</a>}
                <button className="btn ghost sm" onClick={() => setPlaying(null)}>Đóng ✕</button>
              </div>
            </div>
            {isStorageGame(playing.play_url)
              ? <iframe className="game-frame" srcDoc={gameDoc || '<p style="font-family:sans-serif;padding:16px">Đang tải game…</p>'} title={playing.title} allow="fullscreen; autoplay; gamepad" />
              : <iframe className="game-frame" src={playing.play_url} title={playing.title} allow="fullscreen; autoplay; gamepad" />}
          </div>
        </div>
      )}
    </div>
  );
}
