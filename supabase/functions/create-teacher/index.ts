// Supabase Edge Function: admin tạo tài khoản giáo lý viên (service_role).
// Tự xác thực người gọi là admin, rồi tạo user + profile cho ĐÚNG giáo xứ đó.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Chưa đăng nhập' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Xác định người gọi + kiểm tra là admin
    const { data: { user }, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401);
    const { data: caller } = await admin.from('profiles')
      .select('parish_id, role').eq('id', user.id).single();
    if (!caller || caller.role !== 'admin') {
      return json({ error: 'Chỉ quản trị viên được tạo tài khoản' }, 403);
    }

    const { email, password, full_name } = await req.json();
    if (!email || !password) return json({ error: 'Cần email và mật khẩu' }, 400);
    if (String(password).length < 6) return json({ error: 'Mật khẩu tối thiểu 6 ký tự' }, 400);

    // Tạo tài khoản (đã xác nhận email sẵn)
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: full_name || '', parish_id: caller.parish_id, role: 'teacher' },
    });
    if (cerr) return json({ error: cerr.message }, 400);

    // Tạo profile trực tiếp với parish_id đã xác thực
    const { error: perr } = await admin.from('profiles').insert({
      id: created.user!.id, parish_id: caller.parish_id, role: 'teacher',
      full_name: full_name || '', email,
    });
    if (perr) return json({ error: perr.message }, 400);

    return json({ id: created.user!.id, email, full_name: full_name || '' });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
