// Quản lý giao diện: sáng/tối + màu nhấn theo năm phụng vụ. Lưu ở localStorage.
const KEY = 'ui_theme';

// Màu nhấn — gồm mặc định + các màu phụng vụ Công giáo
export const ACCENTS = {
  blue:   { label: 'Xanh dương', p: '#2563eb', d: '#1d4ed8', s: '#eaf1fe' },
  purple: { label: 'Tím (Mùa Vọng / Chay)', p: '#7c3aed', d: '#6d28d9', s: '#f1ecfc' },
  green:  { label: 'Xanh lá (Thường niên)', p: '#15803d', d: '#166534', s: '#e7f5ec' },
  red:    { label: 'Đỏ (Lễ Chúa Thánh Thần / Tử đạo)', p: '#dc2626', d: '#b91c1c', s: '#fdeaea' },
  pink:   { label: 'Hồng (CN Vui mừng)', p: '#db2777', d: '#be185d', s: '#fdecf4' },
  gold:   { label: 'Vàng (Lễ trọng)', p: '#b8860b', d: '#996f09', s: '#fbf3dd' },
};

export function loadTheme() {
  try { return { mode: 'light', accent: 'blue', ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { mode: 'light', accent: 'blue' }; }
}

export function applyTheme(t) {
  const root = document.documentElement;
  root.dataset.theme = t.mode === 'dark' ? 'dark' : 'light';
  const a = ACCENTS[t.accent] || ACCENTS.blue;
  root.style.setProperty('--primary', a.p);
  root.style.setProperty('--primary-dark', a.d);
  root.style.setProperty('--primary-soft', a.s);
  localStorage.setItem(KEY, JSON.stringify({ mode: t.mode, accent: t.accent }));
}
