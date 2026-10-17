import { useState } from 'react';
import { ACCENTS, applyTheme, loadTheme } from '../theme.js';
import ToggleRow from './ToggleRow.jsx';

// Giao diện: tùy chọn riêng của từng máy (lưu trên trình duyệt), ai cũng chỉnh được.
export default function ThemeModal({ onClose }) {
  const [theme, setTheme] = useState(loadTheme());
  const set = (patch) => { const t = { ...theme, ...patch }; applyTheme(t); setTheme(t); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="stxThemeT">
        <h2 id="stxThemeT">Giao diện</h2>
        <p className="muted stx-modal-sub">Áp dụng cho máy đang dùng, không ảnh hưởng người khác.</p>
        <ToggleRow label="Chế độ tối" desc="Nền tối, dịu mắt khi dùng buổi tối" on={theme.mode === 'dark'} onClick={() => set({ mode: theme.mode === 'dark' ? 'light' : 'dark' })} />
        <ToggleRow label="Ảnh nền trang trí" desc="Các thẻ chuyển sang dạng kính mờ trên ảnh nền" on={!!theme.bgImage} onClick={() => set({ bgImage: !theme.bgImage })} />
        <div className="fp-label" style={{ marginTop: 14 }}>Màu chủ đề (theo năm phụng vụ)</div>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={`swatch ${theme.accent === k ? 'on' : ''}`} title={a.label} aria-label={a.label}
              style={{ background: a.p }} onClick={() => set({ accent: k })} />
          ))}
        </div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Xong</button></div>
      </div>
    </div>
  );
}
