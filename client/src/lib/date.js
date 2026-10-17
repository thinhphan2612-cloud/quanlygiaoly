// Hiển thị ngày kiểu Việt Nam dd/mm/yyyy.
// Chuỗi 'yyyy-mm-dd...' đổi trực tiếp (không qua Date để khỏi lệch múi giờ); giá trị khác giữ nguyên.
export function viDate(s) {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}
