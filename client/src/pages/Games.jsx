import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { IconExpand, IconExt } from '../components/Icons.jsx';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import RowMenu from '../components/RowMenu.jsx';

const STORE_URL = 'https://ephatastore.com';

// Supabase Storage ép mọi .html thành text/plain (chặn host HTML) -> game không
// chạy khi mở thẳng URL Storage. Ta cho iframe trỏ vào /game-proxy/... do Service
// Worker phục vụ với ĐÚNG content-type (mọi trang/asset render đúng, điều hướng
// nội bộ như trang biên soạn câu hỏi hoạt động). Chạy client-side nên độc lập host.
const STORAGE_MARK = '/storage/v1/object/public/default-games/';
// CHỈ áp cho game mặc định host trên bucket default-games của MÌNH. Game Ephata
// Store (source 'ephata', host trên store) luôn giữ nguyên play_url -> không đụng.
function gameRel(g) {
  if (!g || g.source === 'ephata' || typeof g.play_url !== 'string') return null;
  const i = g.play_url.indexOf(STORAGE_MARK);
  return i >= 0 ? g.play_url.slice(i + STORAGE_MARK.length) : null;
}
function frameSrc(g) {
  const rel = gameRel(g);
  return rel == null ? g?.play_url : '/game-proxy/' + rel;
}

// Mô tả + nhãn cho game có sẵn (bảng default_games chưa có cột mô tả)
const KNOWN = [
  { match: /tri[eệ]u ph[uú]|altp|millionaire/i, desc: 'Trả lời 15 câu hỏi giáo lý tăng dần độ khó, có trợ giúp 50:50, gọi điện, hỏi ý kiến. Chọn gói câu hỏi theo lớp hoặc tự soạn.', tags: ['Chiếu cả lớp', 'Tự tạo câu hỏi'] },
  { match: /n[oó]n k[yỳ] di[eệ]u|wheel/i, desc: 'Quay nón, đoán chữ cái để mở ô chữ giáo lý.', tags: ['Chiếu cả lớp'] },
];
const infoOf = (g) => KNOWN.find((k) => k.match.test(`${g.key || ''} ${g.title || ''}`)) || null;
const RECENT_KEY = 'games_recent';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

export default function Games() {
  const [defaults, setDefaults] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [playing, setPlaying] = useState(null); // game đang chơi (iframe)
  const [loading, setLoading] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [swSlow, setSwSlow] = useState(false); // chờ quá lâu -> hiện cách xử lý thay vì "Đang chuẩn bị" mãi
  const [recent, setRecent] = useState(readRecent);
  const [portrait, setPortrait] = useState(false);
  const boxRef = useRef(null);

  function loadAll() {
    Promise.all([
      api.get('/default-games').then((r) => r.data).catch(() => []),
      api.get('/user-games').then((r) => r.data).catch(() => []),
    ]).then(([d, m]) => { setDefaults(d); setMyGames(m); }).finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  // Service Worker (sw.js, có proxy game) phải đang điều khiển trang thì iframe /game-proxy/ mới chạy.
  // Hỏi thử /game-proxy/__ping: nếu SW chưa điều khiển trang hoặc là bản cũ không có proxy,
  // request ra mạng và nhận về index.html của app thay vì 'ok' -> chờ SW mới kích hoạt rồi thử lại.
  // Tải lại cứng (Ctrl+F5) làm trang KHÔNG được SW điều khiển dù SW đang chạy -> nhờ SW nhận trang (message 'claim').
  useEffect(() => {
    const slow = setTimeout(() => setSwSlow(true), 4000);
    if (!('serviceWorker' in navigator)) return () => clearTimeout(slow);
    let live = true;
    const check = () => fetch('/game-proxy/__ping', { cache: 'no-store' })
      .then((r) => r.text()).then((t) => { const ok = t === 'ok'; if (live && ok) setSwReady(true); return ok; })
      .catch(() => false);
    navigator.serviceWorker.addEventListener('controllerchange', check);
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.update().catch(() => {}).then(() => reg))
      .then(async (reg) => { if (!(await check())) reg.active?.postMessage('claim'); })
      .catch(() => {});
    return () => { live = false; clearTimeout(slow); navigator.serviceWorker.removeEventListener('controllerchange', check); };
  }, []);

  // Đang chơi: Esc hỏi trước khi đóng; điện thoại cầm dọc thì nhắc xoay ngang
  useEffect(() => {
    if (!playing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) askClose(); };
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 760px)');
    const onMq = () => setPortrait(mq.matches);
    onMq();
    document.addEventListener('keydown', onKey);
    mq.addEventListener?.('change', onMq);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); mq.removeEventListener?.('change', onMq); document.body.style.overflow = ''; };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  function play(g) {
    setPlaying(g);
    const next = [g.id, ...readRecent().filter((id) => id !== g.id)].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* bộ nhớ trình duyệt bị chặn */ }
  }
  async function askClose() {
    const ok = await confirmDialog({
      message: `Đóng game "${playing?.title}"?\n\nVán đang chơi sẽ dừng. Nếu vừa tự soạn câu hỏi, hãy bấm "Lưu trò chơi" trong game để tải bộ câu hỏi về máy trước khi đóng.`,
      okText: 'Đóng game', cancelText: 'Chơi tiếp',
    });
    if (!ok) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setPlaying(null);
  }
  function fullscreen() {
    const el = boxRef.current;
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); return; }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => toast.err('Trình duyệt không cho bật toàn màn hình'));
    else toast.err('Trình duyệt này không hỗ trợ toàn màn hình. Thử "Mở tab mới".');
  }

  async function removeMine(g) {
    if (!await confirmDialog(`Gỡ "${g.title}" khỏi kho game của bạn?\n\nChỉ gỡ khỏi Giáo Lý Số. Bạn vẫn thêm lại được từ Ephata Store bất cứ lúc nào.`)) return;
    try { await api.delete(`/user-games/${g.id}`); toast(`Đã gỡ "${g.title}"`); loadAll(); }
    catch (e) { toast.err(e.response?.data?.error || 'Gỡ game thất bại'); }
  }

  function card(g, mine) {
    const info = infoOf(g);
    const tags = [...(info?.tags || []), ...(mine ? ['Từ Ephata Store'] : [])];
    return (
      <div key={g.id} className="gmx-card">
        <button type="button" className="gmx-play" onClick={() => play(g)} aria-label={`Chơi ${g.title}`}>
          <span className="gmx-thumb" style={{ background: g.color || '#2563eb' }}>
            {g.thumb_url ? <img src={g.thumb_url} alt="" /> : <span className="gmx-ico">{g.icon || '◈'}</span>}
            <span className="gmx-playbadge">▶ Chơi</span>
          </span>
          <span className="gmx-body">
            <b className="gmx-name">{g.title}</b>
            {info?.desc && <span className="gmx-desc">{info.desc}</span>}
            {tags.length > 0 && <span className="gmx-tags">{tags.map((t) => <span key={t} className="gmx-tag">{t}</span>)}</span>}
          </span>
        </button>
        {mine && <span className="gmx-menu"><RowMenu items={[{ label: 'Gỡ khỏi kho game…', danger: true, onClick: () => removeMine(g) }]} label={`Thao tác với ${g.title}`} /></span>}
      </div>
    );
  }

  const all = [...defaults, ...myGames];
  const recentGames = recent.map((id) => all.find((g) => g.id === id)).filter(Boolean);
  const waiting = playing && gameRel(playing) != null && !swReady;

  return (
    <div>
      <PageHeader title="Game học giáo lý" subtitle="Ôn bài sinh động cùng cả lớp. Nên chiếu lên TV hoặc máy chiếu.">
        <a className="btn btn-ext gmx-link" href={STORE_URL} target="_blank" rel="noopener noreferrer">+ Thêm game từ Ephata Store <IconExt /></a>
      </PageHeader>

      {loading ? (
        <div className="panel"><p className="muted">Đang tải…</p></div>
      ) : (
        <>
          {recentGames.length > 0 && all.length > 2 && (
            <div className="panel">
              <div className="card-head"><h2 style={{ margin: 0 }}>Chơi gần đây</h2></div>
              <div className="gmx-recent">
                {recentGames.map((g) => (
                  <button key={g.id} type="button" className="gmx-chip" onClick={() => play(g)}>
                    <span className="gmx-chip-ico" style={{ background: g.color || '#2563eb' }}>{g.thumb_url ? <img src={g.thumb_url} alt="" /> : (g.icon || '◈')}</span>
                    {g.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {defaults.length > 0 && (
            <div className="panel">
              <div className="card-head">
                <h2 style={{ margin: 0 }}>Game có sẵn</h2>
                <span className="muted" style={{ fontSize: 13 }}>Dùng được cho mọi tài khoản</span>
              </div>
              <div className="gmx-grid">{defaults.map((g) => card(g, false))}</div>
            </div>
          )}

          <div className="panel">
            <div className="card-head">
              <h2 style={{ margin: 0 }}>Game của tôi</h2>
              {myGames.length > 0 && <span className="muted" style={{ fontSize: 13 }}>Đã thêm từ Ephata Store</span>}
            </div>
            {myGames.length > 0 ? (
              <div className="gmx-grid">{myGames.map((g) => card(g, true))}</div>
            ) : (
              <div className="gmx-empty">
                <p>Chưa thêm game riêng nào. Chọn game ở Ephata Store rồi bấm "Thêm vào Giáo Lý Số", game sẽ hiện ở đây.</p>
                <a className="btn ghost btn-ext gmx-link" href={STORE_URL} target="_blank" rel="noopener noreferrer">Mở Ephata Store <IconExt /></a>
              </div>
            )}
          </div>
        </>
      )}

      {playing && (
        <div className="gmx-overlay" role="dialog" aria-modal="true" aria-label={playing.title}>
          <div className="gmx-box" ref={boxRef}>
            <div className="gmx-head">
              <span className="gmx-title">{playing.icon || '◈'} {playing.title}</span>
              <div className="gmx-tools">
                {!waiting && <button className="btn ghost sm" onClick={fullscreen}><IconExpand className="bi" />Toàn màn hình</button>}
                {!waiting && <a className="btn ghost sm btn-ext gmx-link" href={frameSrc(playing)} target="_blank" rel="noopener noreferrer">Mở tab mới <IconExt /></a>}
                <button className="btn sm" onClick={askClose}>Đóng</button>
              </div>
            </div>
            {portrait && <div className="gmx-rotate">Game thiết kế cho màn hình ngang: xoay ngang điện thoại, hoặc chiếu lên TV / máy tính để cả lớp cùng xem.</div>}
            {waiting ? (
              <div className="gmx-frame gmx-wait">
                {!swSlow ? <span className="muted">Đang chuẩn bị game…</span> : (
                  <>
                    <p>Trình duyệt chưa sẵn sàng chạy game trong khung này.</p>
                    <p className="muted" style={{ fontSize: 13 }}>Thường do vừa tải lại trang bằng Ctrl+F5. Bấm "Tải lại trang", hoặc mở game ở tab mới.</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button className="btn" onClick={() => window.location.reload()}>Tải lại trang</button>
                      <a className="btn ghost btn-ext gmx-link" href={frameSrc(playing)} target="_blank" rel="noopener noreferrer">Mở game ở tab mới <IconExt /></a>
                    </div>
                  </>
                )}
              </div>
            ) : <iframe className="gmx-frame" src={frameSrc(playing)} title={playing.title} allow="fullscreen; autoplay; gamepad" allowFullScreen />}
          </div>
        </div>
      )}
    </div>
  );
}
