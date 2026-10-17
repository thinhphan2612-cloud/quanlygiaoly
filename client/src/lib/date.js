// Hiển thị ngày kiểu Việt Nam dd/mm/yyyy.
// Chuỗi 'yyyy-mm-dd...' đổi trực tiếp (không qua Date để khỏi lệch múi giờ); giá trị khác giữ nguyên.
export function viDate(s) {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

// Thời gian tương đối cho thông báo: "Vừa xong", "5 phút trước", "Hôm qua, 08:30", "3 ngày trước", "12/09".
export function timeAgo(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return 'Vừa xong';
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return `${Math.floor(sec / 3600)} giờ trước`;
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= yest) return `Hôm qua, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  const days = Math.ceil((today - d) / 86400000);
  if (days < 7) return `${days} ngày trước`;
  const dm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.getFullYear() === today.getFullYear() ? dm : `${dm}/${d.getFullYear()}`;
}
// Ngày giờ đầy đủ (hiện khi rê chuột).
export const fullDateTime = (s) => new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
