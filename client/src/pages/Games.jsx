import { useEffect, useState } from 'react';
import api from '../api';
import { gamesUnlocked } from '../lib/plans';
import PricingModal from '../components/PricingModal.jsx';

// Danh sách game mẫu (điều hướng sang tên miền chơi game, vd wecatholic).
// Có thể cho admin tự quản lý ở bản sau.
const GAMES = [
  { id: 'quiz', name: 'Đố vui giáo lý', emoji: '❓', color: '#f59e0b', desc: 'Trả lời câu hỏi giáo lý theo từng cấp lớp, tính điểm và xếp hạng.', url: 'https://wecatholic.com' },
  { id: 'match', name: 'Ghép hình Kinh Thánh', emoji: '🧩', color: '#3b82f6', desc: 'Ghép các mảnh tranh về các câu chuyện trong Kinh Thánh.', url: 'https://wecatholic.com' },
  { id: 'word', name: 'Ô chữ Công giáo', emoji: '🔤', color: '#15803d', desc: 'Giải ô chữ với các thuật ngữ, tên thánh, ngày lễ.', url: 'https://wecatholic.com' },
  { id: 'memory', name: 'Lật thẻ ghi nhớ', emoji: '🃏', color: '#db2777', desc: 'Trò lật thẻ luyện trí nhớ về các bí tích, kinh nguyện.', url: 'https://wecatholic.com' },
  { id: 'saints', name: 'Đố về các Thánh', emoji: '😇', color: '#7c3aed', desc: 'Nhận biết các vị thánh qua hình ảnh và tiểu sử.', url: 'https://wecatholic.com' },
  { id: 'order', name: 'Sắp xếp phụng vụ', emoji: '⛪', color: '#0891b2', desc: 'Sắp xếp đúng thứ tự các phần trong Thánh lễ / năm phụng vụ.', url: 'https://wecatholic.com' },
];

export default function Games() {
  const [plan, setPlan] = useState('free');
  const [open, setOpen] = useState(null);
  const [pricing, setPricing] = useState(false);
  useEffect(() => { api.get('/parish').then((r) => setPlan(r.data?.plan || 'free')).catch(() => {}); }, []);
  const unlocked = gamesUnlocked(plan);

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Game học giáo lý</h1>
        {!unlocked && <button className="btn" onClick={() => setPricing(true)}>🚀 Nâng cấp để mở khóa</button>}
      </div>
      {!unlocked && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          Các game đang bị khóa ở gói Basic. Nâng lên <b>Standard</b> hoặc <b>Pro</b> để chơi.
        </div>
      )}

      <div className="game-grid">
        {GAMES.map((g) => (
          <div key={g.id} className={`game-card ${unlocked ? '' : 'locked'}`}
            onClick={() => (unlocked ? setOpen(g) : setPricing(true))}>
            <div className="game-thumb" style={{ background: unlocked ? g.color : '#c7c9cf' }}>
              <span>{unlocked ? g.emoji : '🔒'}</span>
            </div>
            <div className="game-name">{g.name}</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: 'center' }}>{open.emoji}</div>
            <h2 style={{ textAlign: 'center', marginTop: 6 }}>{open.name}</h2>
            <p className="muted" style={{ textAlign: 'center' }}>{open.desc}</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setOpen(null)}>Đóng</button>
              <a className="btn" href={open.url} target="_blank" rel="noopener noreferrer">▶ Chơi ngay</a>
            </div>
          </div>
        </div>
      )}
      {pricing && <PricingModal current={plan} onClose={() => setPricing(false)} />}
    </div>
  );
}
