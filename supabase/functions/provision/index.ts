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

  // Tính năng mua trên Ephata Store → bật cho CẢ GIÁO XỨ (bảng parish_features).
  // Body: { action:"grant_feature", parish_id, feature_key, expires_at|null, source, ref,
  //         feature:{ name, description } }
  if (body?.action === 'grant_feature') {
    const parishId = body.parish_id;
    const key = body.feature_key;
    if (!parishId || !key) return json({ error: 'Thiếu parish_id hoặc feature_key' }, 400);
    const { data: parish } = await admin.from('parishes').select('id').eq('id', String(parishId)).maybeSingle();
    if (!parish) return json({ error: 'Không tìm thấy giáo xứ' }, 404);

    // Đảm bảo có trong catalog tính năng (không ghi đè cấu hình tính năng đã có sẵn).
    const f = body.feature || {};
    const { error: ferr } = await admin.from('features').upsert(
      { key: String(key), name: f.name ? String(f.name) : String(key), description: f.description ? String(f.description) : null, category: 'Ephata' },
      { onConflict: 'key', ignoreDuplicates: true },
    );
    if (ferr) return json({ error: ferr.message }, 400);

    // Nhiều quản trị cùng giáo xứ mua → giữ hạn xa nhất (null = vĩnh viễn thắng).
    const { data: cur } = await admin.from('parish_features')
      .select('status, expires_at').eq('parish_id', String(parishId)).eq('feature_key', String(key)).maybeSingle();
    const incoming = body.expires_at ? String(body.expires_at) : null;
    const keepCurrent = cur && cur.status === 'active' &&
      (cur.expires_at === null || (incoming !== null && new Date(cur.expires_at) > new Date(incoming)));
    const expiresAt = keepCurrent ? cur.expires_at : incoming;

    const { error } = await admin.from('parish_features').upsert({
      parish_id: String(parishId),
      feature_key: String(key),
      status: 'active',
      source: 'purchase',
      starts_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: 'parish_id,feature_key' });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, expires_at: expiresAt });
  }

  // Thu hồi tính năng của giáo xứ (admin Ephata thu hồi quyền).
  // Body: { action:"revoke_feature", parish_id, feature_key, source, ref }
  if (body?.action === 'revoke_feature') {
    const parishId = body.parish_id;
    const key = body.feature_key;
    if (!parishId || !key) return json({ error: 'Thiếu parish_id hoặc feature_key' }, 400);
    const { error } = await admin.from('parish_features')
      .update({ status: 'revoked' })
      .eq('parish_id', String(parishId)).eq('feature_key', String(key));
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  // Ephata làm mới ngữ cảnh người dùng đã liên kết (giáo xứ, vai trò, gói, hạn gói) — đọc, không ghi.
  // Body: { action:"user_contexts", giaoly_user_ids:[...] } (tối đa 100)
  // Trả: { ok, contexts:[{ giaoly_user_id, parish_id, role, plan, plan_expires_at }] } — user không còn tồn tại thì không có trong danh sách.
  if (body?.action === 'user_contexts') {
    const ids = Array.isArray(body.giaoly_user_ids) ? body.giaoly_user_ids.map(String).slice(0, 100) : [];
    if (!ids.length) return json({ error: 'Thiếu giaoly_user_ids' }, 400);
    const { data: profs, error: perr } = await admin.from('profiles').select('id, parish_id, role').in('id', ids);
    if (perr) return json({ error: perr.message }, 400);
    const parishIds = [...new Set((profs || []).map((p) => p.parish_id).filter(Boolean))];
    const { data: pars, error: parr } = parishIds.length
      ? await admin.from('parishes').select('id, plan, plan_expires_at').in('id', parishIds)
      : { data: [], error: null };
    if (parr) return json({ error: parr.message }, 400);
    const byId = new Map((pars || []).map((p) => [p.id, p]));
    const contexts = (profs || []).map((p) => {
      const par = p.parish_id ? byId.get(p.parish_id) : null;
      return {
        giaoly_user_id: p.id,
        parish_id: p.parish_id ?? null,
        role: p.role ?? null,
        plan: par?.plan ?? null,
        plan_expires_at: par?.plan_expires_at ?? null,
      };
    });
    return json({ ok: true, contexts });
  }

  return json({ error: 'Unknown action' }, 400);
});
