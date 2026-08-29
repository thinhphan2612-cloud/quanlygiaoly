// Nhận diện super-admin (chủ hệ thống) ở phía client — CHỈ để hiện/ẩn UI.
// Bảo mật thật do Edge Function admin-api enforce (env SUPERADMIN_EMAILS).
// Có thể ghi đè bằng biến build VITE_SUPERADMIN_EMAILS (danh sách, ngăn cách dấu phẩy).
const EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAILS || 'support.giaolyso@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isSuperAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return !!email && EMAILS.includes(email);
}
