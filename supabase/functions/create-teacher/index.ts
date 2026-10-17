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

// Tìm tài khoản đăng nhập theo email (duyệt từng trang; số tài khoản của hệ thống không lớn).
// deno-lint-ignore no-explicit-any
async function findUserByEmail(admin: any, email: string) {
  const want = String(email || '').trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users || [];
    const hit = users.find((u: { email?: string }) => (u.email || '').toLowerCase() === want);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
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

    const body = await req.json();

    // Cấp lại mật khẩu cho một tài khoản trong CÙNG giáo xứ của admin.
    if (body.action === 'reset-password') {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ error: 'Cần user_id và mật khẩu' }, 400);
      if (String(password).length < 6) return json({ error: 'Mật khẩu tối thiểu 6 ký tự' }, 400);
      const { data: target } = await admin.from('profiles').select('parish_id').eq('id', user_id).maybeSingle();
      if (!target || target.parish_id !== caller.parish_id) return json({ error: 'Không có quyền với tài khoản này' }, 403);
      const { error: rerr } = await admin.auth.admin.updateUserById(user_id, { password });
      if (rerr) return json({ error: rerr.message }, 400);
      return json({ ok: true });
    }

    // Xóa hẳn tài khoản giáo lý viên (cả tài khoản đăng nhập) trong CÙNG giáo xứ.
    // profiles xóa theo (on delete cascade); phân công lớp, thông báo của người này cũng xóa theo.
    if (body.action === 'delete-user') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'Cần user_id' }, 400);
      if (user_id === user.id) return json({ error: 'Không thể tự xóa tài khoản của chính mình' }, 400);
      const { data: target } = await admin.from('profiles').select('parish_id, role').eq('id', user_id).maybeSingle();
      if (!target || target.parish_id !== caller.parish_id) return json({ error: 'Không có quyền với tài khoản này' }, 403);
      if (target.role === 'admin') return json({ error: 'Đây là quản trị viên. Gỡ quyền quản trị trước (Cài đặt) rồi mới xóa.' }, 400);
      const { error: derr } = await admin.auth.admin.deleteUser(user_id);
      if (derr) return json({ error: derr.message }, 400);
      return json({ ok: true });
    }

    const { email, password, full_name, role: reqRole } = body;
    const role = reqRole === 'admin' ? 'admin' : 'teacher';
    if (!email || !password) return json({ error: 'Cần email và mật khẩu' }, 400);
    if (String(password).length < 6) return json({ error: 'Mật khẩu tối thiểu 6 ký tự' }, 400);

    // Thêm quản trị viên là tính năng gói Pro
    if (role === 'admin') {
      const { data: par } = await admin.from('parishes').select('plan').eq('id', caller.parish_id).maybeSingle();
      if (par?.plan !== 'pro') return json({ error: 'Thêm quản trị viên chỉ dành cho gói Pro' }, 403);
    }

    // Tạo tài khoản (đã xác nhận email sẵn)
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: full_name || '', parish_id: caller.parish_id, role },
    });
    if (cerr) {
      const m = (cerr.message || '').toLowerCase();
      if ((cerr as { code?: string }).code === 'email_exists' || /already|registered|exist/.test(m)) {
        // Tài khoản "mồ côi": bị xóa hồ sơ theo cách cũ (còn tài khoản đăng nhập, không còn profile).
        // Nối lại vào giáo xứ này thay vì báo trùng email.
        const orphan = await findUserByEmail(admin, email);
        if (orphan) {
          const { data: hasProfile } = await admin.from('profiles').select('id').eq('id', orphan.id).maybeSingle();
          if (!hasProfile) {
            const { error: uperr } = await admin.auth.admin.updateUserById(orphan.id, {
              password, email_confirm: true,
              user_metadata: { full_name: full_name || '', parish_id: caller.parish_id, role },
            });
            if (uperr) return json({ error: uperr.message }, 400);
            const { error: perr2 } = await admin.from('profiles').insert({
              id: orphan.id, parish_id: caller.parish_id, role, full_name: full_name || '', email,
            });
            if (perr2) return json({ error: perr2.message }, 400);
            return json({ id: orphan.id, email, full_name: full_name || '', role, restored: true });
          }
        }
        return json({ error: 'Email này đã được dùng cho một tài khoản khác. Vui lòng dùng email khác.' }, 400);
      }
      return json({ error: cerr.message }, 400);
    }

    // Tạo profile trực tiếp với parish_id đã xác thực
    const { error: perr } = await admin.from('profiles').insert({
      id: created.user!.id, parish_id: caller.parish_id, role,
      full_name: full_name || '', email,
    });
    if (perr) return json({ error: perr.message }, 400);

    return json({ id: created.user!.id, email, full_name: full_name || '', role });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
