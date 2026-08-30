import { supabase } from '../supabase';

// Gửi tin nhắn liên hệ/góp ý từ trong app -> lưu vào bảng leads (hiện ở trang Quản trị).
// user, parish: lấy từ useAuth()/useParish() để đính kèm tên + email tài khoản.
export async function sendContactMessage({ user, parish, message, context }) {
  const note = (context ? '[' + context + '] ' : '') + (message || '').trim();
  const { error } = await supabase.from('leads').insert({
    kind: 'contact',
    name: user?.full_name || null,
    email: user?.email || null,
    parish_name: parish?.name || null,
    note,
  });
  if (error) throw error;
}
