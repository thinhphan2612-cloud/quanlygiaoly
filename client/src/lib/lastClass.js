// Nhớ lớp đã chọn gần nhất (dùng chung Điểm danh / Điểm số / Chọn trả bài, trên máy này)
// để mở trang là có sẵn lớp, không phải chọn lại mỗi lần.
const KEY = 'last_class';

// Ưu tiên: lớp truyền vào (vd ?class= trên URL) -> lớp đã nhớ -> lớp đầu tiên.
export function pickClass(classes, preferred) {
  if (!classes.length) return '';
  let saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch { /* bỏ qua */ }
  for (const id of [preferred, saved]) if (id && classes.some((c) => c.id === id)) return id;
  return classes[0].id;
}

export function rememberClass(id) {
  try { if (id) localStorage.setItem(KEY, id); } catch { /* bỏ qua */ }
}
