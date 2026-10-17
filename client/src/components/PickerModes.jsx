// Các kiểu bốc thăm cho trang Chọn trả bài: Đua, Vòng quay, Lật thẻ, Quay số.
// Mỗi kiểu nhận pool (học viên còn được bốc) và gọi onPick(học viên) khi xong.
// Người trúng được chọn ngẫu nhiên trước (randInt), hiệu ứng chỉ "diễn" để dừng đúng người đó,
// riêng Đua thì ai về đích trước là trúng.
import { useEffect, useRef, useState } from 'react';
import { IconFlag, IconShuffle } from './Icons.jsx';
import { sfx } from '../lib/pickerSound';

export const COLORS = ['#2563eb', '#f59e0b', '#15803d', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#0ea5e9', '#ca8a04', '#16a34a', '#9333ea', '#ea580c'];
export const initials = (name = '') => { const p = name.trim().split(/\s+/); return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?'; };
export const fullName = (s) => [s.saint_name, s.full_name].filter(Boolean).join(' ');
// Số ngẫu nhiên đều [0, n) dùng crypto (công bằng hơn Math.random)
export function randInt(n) {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch { return Math.floor(Math.random() * n); }
}
export function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
// Tên ngắn cho ô nhỏ: lớp đông thì chỉ lấy tên gọi
const shortName = (s, n) => { const w = (s.full_name || '').trim().split(/\s+/); return n > 30 ? w[w.length - 1] : n > 16 ? w.slice(-2).join(' ') : s.full_name; };

/* ---------------- Đua ---------------- */
const MAX_RUNNERS = 8;
export function RaceMode({ pool, onPick, onBusy }) {
  const [runners, setRunners] = useState([]);
  const [progress, setProgress] = useState({});
  const [racing, setRacing] = useState(false);
  const [winner, setWinner] = useState(null);
  const timer = useRef(null);
  const progRef = useRef({});
  useEffect(() => () => clearInterval(timer.current), []);

  function start() {
    if (racing || !pool.length) return;
    // Lớp đông: bốc ngẫu nhiên 8 em vào đường đua cho dễ nhìn (vẫn công bằng)
    const rs = pool.length > MAX_RUNNERS ? shuffle(pool).slice(0, MAX_RUNNERS) : pool.slice();
    setRunners(rs); setWinner(null);
    progRef.current = Object.fromEntries(rs.map((s) => [s.id, 0]));
    setProgress({ ...progRef.current });
    setRacing(true); onBusy?.(true);
    clearInterval(timer.current);
    // Kịch tính: tăng tốc / khựng bất ngờ, ghì kẻ dẫn đầu, kéo kẻ bám đuổi -> đổi ngôi liên tục
    timer.current = setInterval(() => {
      const p = progRef.current;
      const maxP = Math.max(...rs.map((s) => p[s.id]));
      rs.forEach((s) => {
        let step = 0.45 + Math.random() * 0.8;
        if (Math.random() < 0.09) step += 1.4 + Math.random() * 2.6;
        if (Math.random() < 0.08) step *= 0.12;
        step += (maxP - p[s.id]) * 0.05;
        if (p[s.id] >= maxP - 0.001 && maxP > 0) step *= 0.72;
        p[s.id] = Math.min(100, p[s.id] + Math.max(step, 0));
      });
      const fin = rs.filter((s) => p[s.id] >= 100);
      setProgress({ ...p });
      if (fin.length) {
        clearInterval(timer.current);
        const w = fin.sort((a, b) => p[b.id] - p[a.id])[0];
        setRacing(false); setWinner(w); onBusy?.(false);
        onPick(w);
      }
    }, 90);
  }

  return (
    <div className="rpx-mode">
      {runners.length === 0 ? (
        <p className="rpx-hint">{pool.length > MAX_RUNNERS ? `Mỗi lượt bốc ngẫu nhiên ${MAX_RUNNERS} em vào đường đua, em về đích đầu tiên lên trả bài.` : 'Em về đích đầu tiên lên trả bài.'}</p>
      ) : (
        <div className="rpx-race">
          {runners.map((s, i) => {
            const pr = progress[s.id] || 0;
            return (
              <div className={`rpx-lane${winner?.id === s.id ? ' win' : ''}`} key={s.id}>
                <div className="rpx-lane-name">{s.full_name}</div>
                <div className="rpx-lane-track">
                  <div className="rpx-runner" style={{ left: `${pr}%`, background: s.avatar_url ? '#fff' : COLORS[i % COLORS.length] }}>
                    {s.avatar_url ? <img src={s.avatar_url} alt="" /> : initials(s.full_name)}
                  </div>
                </div>
                <IconFlag className="rpx-lane-flag" />
              </div>
            );
          })}
        </div>
      )}
      <div className="rpx-actions">
        <button data-tour="random-start" className="btn rpx-go" onClick={start} disabled={racing || !pool.length}>{racing ? 'Đang đua…' : <><IconFlag className="bi" />Bắt đầu đua</>}</button>
      </div>
    </div>
  );
}

/* ---------------- Vòng quay may mắn ---------------- */
export function WheelMode({ pool, onPick, onBusy }) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotRef = useRef(0);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const n = pool.length;
  const seg = n ? 360 / n : 360;
  const R = 200, C = 210;
  // Ô thứ i: từ góc i*seg đến (i+1)*seg, 0 độ = đỉnh, chiều kim đồng hồ
  const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const fontSize = n > 30 ? 9 : n > 20 ? 11 : n > 12 ? 13 : 15;

  function spin() {
    if (spinning || !n) return;
    const idx = randInt(n);
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const from = rotRef.current;
    // Đích: tâm ô idx nằm dưới mũi tên (đỉnh) => góc xoay = -(idx*seg + seg/2) (mod 360), thêm 6 vòng
    const base = from - (((from % 360) + 360) % 360);
    const to = base + 360 * 6 + (360 - (idx * seg + seg / 2)) + jitter;
    const dur = 5200; const t0 = performance.now();
    let lastSeg = Math.floor(from / seg);
    setSpinning(true); onBusy?.(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const r = from + (to - from) * easeOut(t);
      rotRef.current = r; setRot(r);
      const sNow = Math.floor(r / seg); if (sNow !== lastSeg) { lastSeg = sNow; sfx.tick(); }
      if (t < 1) raf.current = requestAnimationFrame(step);
      else { setSpinning(false); onBusy?.(false); onPick(pool[idx]); }
    };
    raf.current = requestAnimationFrame(step);
  }

  if (!n) return <div className="rpx-mode"><p className="rpx-hint">Không còn em nào để quay.</p></div>;
  return (
    <div className="rpx-mode">
      <div className="rpx-wheel-wrap">
        <div className="rpx-pointer" aria-hidden="true" />
        <svg viewBox="0 0 420 420" className="rpx-wheel" style={{ transform: `rotate(${rot}deg)` }} role="img" aria-label="Vòng quay tên học viên">
          {n === 1 ? <circle cx={C} cy={C} r={R} fill={COLORS[0]} /> : pool.map((s, i) => {
            const [x1, y1] = pt(i * seg, R); const [x2, y2] = pt((i + 1) * seg, R);
            return <path key={s.id} d={`M${C},${C} L${x1},${y1} A${R},${R} 0 ${seg > 180 ? 1 : 0} 1 ${x2},${y2} Z`} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="1.5" />;
          })}
          {pool.map((s, i) => {
            const mid = i * seg + seg / 2;
            return (
              // Chữ nằm dọc bán kính, đọc từ tâm ra mép (0 độ ở đỉnh = hướng -90 của SVG)
              <text key={'t' + s.id} x={C + R - 14} y={C} transform={`rotate(${mid - 90} ${C} ${C})`} fill="#fff" fontSize={fontSize} fontWeight="700" textAnchor="end" dominantBaseline="middle">{shortName(s, n)}</text>
            );
          })}
          <circle cx={C} cy={C} r="26" fill="#fff" stroke="#e5e7eb" strokeWidth="3" />
        </svg>
      </div>
      <div className="rpx-actions">
        <button data-tour="random-start" className="btn rpx-go" onClick={spin} disabled={spinning}>{spinning ? 'Đang quay…' : 'Quay'}</button>
      </div>
    </div>
  );
}

/* ---------------- Lật thẻ ---------------- */
export function CardsMode({ pool, onPick, onBusy }) {
  const key = pool.map((s) => s.id).join(',');
  const [deck, setDeck] = useState(() => shuffle(pool));
  const [flipped, setFlipped] = useState(null);
  const [shuffling, setShuffling] = useState(false);
  const timers = useRef([]);
  useEffect(() => { setDeck(shuffle(pool)); setFlipped(null); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function reshuffle() {
    if (shuffling || flipped) return;
    setShuffling(true); onBusy?.(true);
    for (let k = 0; k < 6; k++) timers.current.push(setTimeout(() => { setDeck((d) => shuffle(d)); sfx.pop(); }, k * 140));
    timers.current.push(setTimeout(() => { setShuffling(false); onBusy?.(false); }, 6 * 140 + 200));
  }
  function choose(s) {
    if (shuffling || flipped) return;
    setFlipped(s.id); sfx.flip(); onBusy?.(true);
    timers.current.push(setTimeout(() => { onBusy?.(false); onPick(s); }, 900));
    // Lượt sau: úp lại và xáo (kể cả khi không bỏ người đã chọn)
    timers.current.push(setTimeout(() => { setFlipped(null); setDeck((d) => shuffle(d)); }, 1600));
  }
  if (!pool.length) return <div className="rpx-mode"><p className="rpx-hint">Không còn thẻ nào.</p></div>;
  return (
    <div className="rpx-mode">
      <p className="rpx-hint">Mời một em chọn số thẻ, bấm vào thẻ đó để lật.</p>
      <div className={`rpx-cards${shuffling ? ' shuffling' : ''}`} data-tour="random-start">
        {deck.map((s, i) => (
          <button type="button" key={s.id} className={`rpx-card${flipped === s.id ? ' flipped' : ''}`} onClick={() => choose(s)} disabled={!!flipped || shuffling} aria-label={`Thẻ số ${i + 1}`}>
            <span className="rpx-card-in">
              <span className="rpx-card-back">{i + 1}</span>
              <span className="rpx-card-front">{s.full_name}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="rpx-actions">
        <button className="btn ghost" onClick={reshuffle} disabled={shuffling || !!flipped}><IconShuffle className="bi" />Xáo thẻ</button>
      </div>
    </div>
  );
}

/* ---------------- Quay số (tên chạy dọc như máy xổ số) ---------------- */
export function SlotMode({ pool, onPick, onBusy }) {
  const [reel, setReel] = useState(() => shuffle(pool).slice(0, 3));
  const [y, setY] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const itemRef = useRef(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const key = pool.map((s) => s.id).join(',');
  useEffect(() => { if (!spinning) { setReel(shuffle(pool).slice(0, 3)); setY(0); } }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function spin() {
    if (spinning || !pool.length) return;
    const chosen = pool[randInt(pool.length)];
    // Dải tên: ~36 tên ngẫu nhiên, người trúng ở áp chót (giữa khung 3 dòng khi dừng)
    const filler = []; while (filler.length < 36) filler.push(...shuffle(pool));
    const list = [...filler.slice(0, 36), chosen, pool[randInt(pool.length)]];
    setReel(list); setY(0);
    const h = itemRef.current?.offsetHeight || 64;
    const target = (list.length - 3) * h; // dòng giữa khung = list[length-2]
    const dur = 4300; const t0 = performance.now();
    let lastI = 0;
    setSpinning(true); onBusy?.(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = target * easeOut(t);
      setY(v);
      const i = Math.floor(v / h); if (i !== lastI) { lastI = i; sfx.tick(); }
      if (t < 1) raf.current = requestAnimationFrame(step);
      else { setSpinning(false); onBusy?.(false); onPick(chosen); }
    };
    raf.current = requestAnimationFrame(step);
  }
  if (!pool.length) return <div className="rpx-mode"><p className="rpx-hint">Không còn em nào để quay.</p></div>;
  return (
    <div className="rpx-mode">
      <div className="rpx-slot">
        <div className="rpx-slot-win" />
        <div className="rpx-slot-reel" style={{ transform: `translateY(${-y}px)` }}>
          {reel.map((s, i) => <div key={i} ref={i === 0 ? itemRef : null} className="rpx-slot-item">{fullName(s)}</div>)}
        </div>
      </div>
      <div className="rpx-actions">
        <button data-tour="random-start" className="btn rpx-go" onClick={spin} disabled={spinning}>{spinning ? 'Đang quay…' : 'Quay số'}</button>
      </div>
    </div>
  );
}
