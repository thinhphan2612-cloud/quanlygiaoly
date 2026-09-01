// Supabase Edge Function: nhận webhook từ Ephata Store để cấp phát (provision)
// nội dung cho user Giáo Lý Số. Xác thực bằng header 'x-provision-secret'
// (khớp env PROVISION_SECRET), rồi ghi bằng service_role (bỏ qua RLS).
//
// Body:
//   { "action":"add_game", "giaoly_user_id":"<auth user id>",
//     "game":{ "key":"slug", "title":"...", "play_url":"https://...", "icon":"◈" } }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-provision-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Xác thực secret dùng chung với store
  const secret = req.headers.get('x-provision-secret') || '';
  const expected = Deno.env.get('PROVISION_SECRET') || '';
  if (!expected || secret !== expected) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (body?.action === 'add_game') {
    const uid = body.giaoly_user_id;
    const g = body.game || {};
    if (!uid || !g.key || !g.play_url) {
      return json({ error: 'Thiếu giaoly_user_id hoặc game.key/play_url' }, 400);
    }
    // Đảm bảo user tồn tại (tránh ghi rác)
    const { data: got, error: uerr } = await admin.auth.admin.getUserById(String(uid));
    if (uerr || !got?.user) return json({ error: 'Không tìm thấy user Giáo Lý Số' }, 404);

    const row = {
      user_id: String(uid),
      key: String(g.key),
      title: g.title ? String(g.title) : String(g.key),
      play_url: String(g.play_url),
      icon: g.icon ? String(g.icon) : '◈',
      source: 'ephata',
    };
    const { error } = await admin.from('user_games')
      .upsert(row, { onConflict: 'user_id,key' });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
