import { useEffect, useState } from 'react';

// Thông báo nhỏ ở cuối màn hình, thay cho hộp alert() của trình duyệt.
// toast('Đã lưu')          -> thông báo thường (tự ẩn sau 3,5 giây)
// toast.err('Lưu thất bại') -> thông báo lỗi (nền đỏ, hiện lâu hơn)
let current = null;
let timer = null;
const subs = new Set();

function show(text, kind) {
  clearTimeout(timer);
  current = { text: String(text ?? ''), kind, id: Date.now() };
  subs.forEach((fn) => fn(current));
  timer = setTimeout(() => { current = null; subs.forEach((fn) => fn(null)); }, kind === 'err' ? 7000 : 3500);
}

export function toast(text) { show(text, 'ok'); }
toast.err = (text) => show(text, 'err');

export function useToast() {
  const [t, setT] = useState(current);
  useEffect(() => { subs.add(setT); return () => { subs.delete(setT); }; }, []);
  return [t, () => { clearTimeout(timer); current = null; subs.forEach((fn) => fn(null)); }];
}
