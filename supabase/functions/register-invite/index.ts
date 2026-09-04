// Đăng ký tự động từ landing: gửi email mời tạo tài khoản (Supabase invite) ngay khi
// user submit. Nếu email đã được đăng ký thì KHÔNG gửi lại, trả {already:true}.
// Public (gọi bằng anon key). Deploy:
//   npx supabase functions deploy register-invite --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const fullName = String(body?.name || '').trim().slice(0, 160);
    const parishName = String(body?.parish || '').trim().slice(0, 200);
    const phone = String(body?.phone || '').trim().slice(0, 60);
    const note = String(body?.note || '').trim().slice(0, 2000);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'email-invalid' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });

    // Ghi đơn đăng ký vào leads kèm trạng thái kết quả (service role -> đặt status tự do).
    const saveLead = (status: string) => admin.from('leads').insert({
      kind: 'register', name: fullName || null, email, phone: phone || null,
      parish_name: parishName || null, note: note || null, status,
    }).then(() => {}, () => {});

    // Hạn mức theo IP: tối đa RATE_MAX lời mời / RATE_MIN phút. Fail-open nếu bảng chưa có.
    const RATE_MAX = 6, RATE_MIN = 60;
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || req.headers.get('cf-connecting-ip') || 'unknown';
    try {
      const since = new Date(Date.now() - RATE_MIN * 60000).toISOString();
      const { count, error: cErr } = await admin.from('register_invites')
        .select('*', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since);
      if (!cErr && (count ?? 0) >= RATE_MAX) return json({ rate: true }, 429);
      if (!cErr) await admin.from('register_invites').insert({ ip, email });
    } catch (_e) { /* bảng chưa tạo -> bỏ qua giới hạn */ }

    const redirectTo = (Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn') + '/set-password';
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, parish_name: parishName, diocese: String(body?.diocese || '').trim() },
      redirectTo,
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      // Email đã tồn tại -> không gửi lại, ghi đơn dạng 'duplicate'
      if ((error as { code?: string }).code === 'email_exists' || /already|registered|exist/.test(msg)) {
        await saveLead('duplicate');
        return json({ already: true });
      }
      await saveLead('new'); // lỗi khác -> để admin xử lý tay
      return json({ error: error.message }, 400);
    }
    await saveLead('invited'); // đã gửi email mời tự động
    return json({ ok: true, user_id: data?.user?.id, email });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
