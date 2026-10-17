import { supabase } from '../supabase';

// Tùy chọn hiển thị của người dùng, lưu trong user_metadata.prefs của Supabase Auth
// để đồng bộ giữa các máy (không cần bảng riêng). Chỉ dùng cho tùy chọn giao diện.
export async function getPref(key) {
  const { data } = await supabase.auth.getUser();
  return data?.user?.user_metadata?.prefs?.[key];
}

export async function setPref(key, value) {
  const { data } = await supabase.auth.getUser();
  const meta = data?.user?.user_metadata || {};
  // Giữ nguyên các khóa metadata khác (full_name, parish_id...), chỉ thay prefs.
  await supabase.auth.updateUser({ data: { ...meta, prefs: { ...(meta.prefs || {}), [key]: value } } });
}
