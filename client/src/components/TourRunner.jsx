import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOURS } from '../lib/tours';
import { goStep, markTourDone, stopTour, useActiveTour } from '../lib/tour';
import { toast } from '../lib/toast';

// Chạy bài tập hướng dẫn trên trang thật: mở đúng trang, tô sáng phần tử cần thao tác, khung giải thích từng bước.
// Lớp tô sáng không chặn thao tác (pointer-events: none) nên người dùng bấm được ngay vào phần tử.
export default function TourRunner() {
  const active = useActiveTour();
  const navigate = useNavigate();
  const location = useLocation();
  const tour = active && TOURS.find((t) => t.id === active.id);
  const step = tour?.steps[active.step];
  const [rect, setRect] = useState(null);
  const [missing, setMissing] = useState(false);
  const isLast = !!tour && active.step === tour.steps.length - 1;

  function next() {
    if (!tour) return;
    if (isLast) {
      markTourDone(tour.id);
      stopTour();
      toast(`Hoàn thành bài tập "${tour.title}".`);
      navigate('/guide');
    } else goStep(active.step + 1);
  }

  // Mở đúng trang của bước.
  useEffect(() => {
    if (step?.route && location.pathname !== step.route) navigate(step.route);
  }, [active?.id, active?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tìm phần tử cần tô sáng và bám theo vị trí của nó (modal mở ra, trang cuộn...).
  useEffect(() => {
    setRect(null); setMissing(false);
    if (!step) return undefined;
    const started = Date.now();
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el && el.getClientRects().length) {
        if (!scrolled) {
          // Điện thoại: khung hướng dẫn nằm ở đáy màn hình nên đưa phần tử lên phần trên, tránh bị che.
          // Cuộn tức thời (cuộn mượt có thể bị bỏ qua trên một số trình duyệt / khi trang đang vẽ lại).
          if (window.innerWidth <= 640) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 90 });
          else el.scrollIntoView({ block: 'center' });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
        setMissing(false);
      } else {
        setRect(null);
        if (Date.now() - started > (step.wait || 5000)) setMissing(true);
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [active?.id, active?.step, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bước "bấm vào đây": bấm đúng phần tử thì tự sang bước sau.
  useEffect(() => {
    if (!step || step.action !== 'click') return undefined;
    const onClick = (e) => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el && el.contains(e.target)) setTimeout(next, 350);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active?.id, active?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc để thoát bài tập.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') stopTour(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  if (!tour || !step) return null;

  // Đặt khung giải thích dưới phần tử nếu đủ chỗ, không thì đặt phía trên. Trên điện thoại: cố định ở đáy màn hình.
  const mobile = window.innerWidth <= 640;
  const CARD_W = 340, CARD_H = 230, GAP = 14;
  let cardStyle;
  if (mobile || !rect) cardStyle = mobile ? {} : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  else {
    const below = rect.top + rect.height + GAP + CARD_H < window.innerHeight;
    const top = below ? rect.top + rect.height + GAP : Math.max(12, rect.top - GAP - CARD_H);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - CARD_W - 12);
    cardStyle = { top, left, width: CARD_W };
  }

  return (
    <>
      {rect ? (() => {
        // Nền mờ là 1 hình SVG có lỗ khoét bo góc quanh phần tử (không có đường nối, hiển thị ổn trên mọi trình duyệt).
        const P = 6, R = 10, t = rect.top - P, l = rect.left - P, w = rect.width + P * 2, h = rect.height + P * 2;
        const W = window.innerWidth, H = window.innerHeight;
        const hole = `M${l + R} ${t}H${l + w - R}A${R} ${R} 0 0 1 ${l + w} ${t + R}V${t + h - R}A${R} ${R} 0 0 1 ${l + w - R} ${t + h}H${l + R}A${R} ${R} 0 0 1 ${l} ${t + h - R}V${t + R}A${R} ${R} 0 0 1 ${l + R} ${t}Z`;
        return (
          <>
            <svg className="tour-svg" width={W} height={H} aria-hidden="true">
              <path fillRule="evenodd" d={`M0 0H${W}V${H}H0Z ${hole}`} />
            </svg>
            <div className="tour-ring" style={{ top: t, left: l, width: w, height: h }} />
          </>
        );
      })() : missing && <div className="tour-dim" />}
      <div className={`tour-card${mobile ? ' sheet' : ''}`} style={cardStyle} role="dialog" aria-label={`Bài tập: ${tour.title}`}>
        <div className="tour-meta">{tour.title} · Bước {active.step + 1}/{tour.steps.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {!rect && !missing && <p className="tour-note">Đang mở trang…</p>}
        {missing && <p className="tour-note warn">{step.missingText || 'Chưa thấy mục này trên trang (có thể cần thêm dữ liệu trước). Bấm Tiếp để bỏ qua bước này.'}</p>}
        {rect && step.action === 'click' && <p className="tour-note">Bấm vào chỗ đang được tô sáng để tiếp tục.</p>}
        <div className="tour-progress">{tour.steps.map((_, i) => <span key={i} className={i <= active.step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          <button className="tour-exit" onClick={stopTour}>Thoát</button>
          {active.step > 0 && <button className="btn ghost sm" onClick={() => goStep(active.step - 1)}>Quay lại</button>}
          <button className="btn sm" onClick={next}>{isLast ? 'Hoàn thành' : 'Tiếp'}</button>
        </div>
      </div>
    </>
  );
}
