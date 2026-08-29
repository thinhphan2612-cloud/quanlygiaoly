// Supabase Edge Function: API cho super-admin (chủ hệ thống).
// Xác thực người gọi là super-admin (email nằm trong SUPERADMIN_EMAILS),
// rồi dùng service_role để đọc TẤT CẢ giáo xứ và bật/tắt gói Pro thủ công.
// Actions: { action: 'list' } | { action: 'set-plan', parish_id, plan, plan_expires_at }
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

const superEmails = (Deno.env.get('SUPERADMIN_EMAILS') || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

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

    // Xác thực người gọi là super-admin (theo email)
    const { data: { user }, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401);
    const email = (user.email || '').toLowerCase();
    if (!email || !superEmails.includes(email)) {
      return json({ error: 'Không có quyền super-admin' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // -------- liệt kê tất cả giáo xứ + số liệu --------
    if (action === 'list') {
      const [parishesR, profilesR, classesR, studentsR] = await Promise.all([
        admin.from('parishes').select('id, name, diocese, plan, plan_expires_at, created_at'),
        admin.from('profiles').select('id, parish_id, role, full_name, email'),
        admin.from('classes').select('parish_id, graduated'),
        admin.from('students').select('parish_id, graduated'),
      ]);
      if (parishesR.error) return json({ error: parishesR.error.message }, 400);

      const profiles = profilesR.data || [];
      const classes = classesR.data || [];
      const students = studentsR.data || [];

      const countBy = (arr: any[], key: string, pred?: (x: any) => boolean) => {
        const m: Record<string, number> = {};
        for (const x of arr) {
          if (pred && !pred(x)) continue;
          const k = x[key];
          if (k) m[k] = (m[k] || 0) + 1;
        }
        return m;
      };
      const classCount = countBy(classes, 'parish_id', (c) => !c.graduated);
      const studentCount = countBy(students, 'parish_id', (s) => !s.graduated);
      const teacherCount = countBy(profiles, 'parish_id', (p) => p.role === 'teacher');
      const adminByParish: Record<string, any> = {};
      for (const p of profiles) {
        if (p.role === 'admin' && p.parish_id && !adminByParish[p.parish_id]) adminByParish[p.parish_id] = p;
      }

      const parishes = (parishesR.data || [])
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          diocese: p.diocese || '',
          plan: p.plan === 'free' ? 'free' : 'pro',
          plan_expires_at: p.plan_expires_at || null,
          created_at: p.created_at,
          classes: classCount[p.id] || 0,
          students: studentCount[p.id] || 0,
          teachers: teacherCount[p.id] || 0,
          admin_name: adminByParish[p.id]?.full_name || '',
          admin_email: adminByParish[p.id]?.email || '',
        }))
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

      return json({ parishes });
    }

    // -------- bật/tắt gói Pro cho 1 giáo xứ --------
    if (action === 'set-plan') {
      const parishId = body?.parish_id;
      const plan = body?.plan === 'pro' ? 'pro' : 'free';
      if (!parishId) return json({ error: 'Thiếu parish_id' }, 400);
      const expires = plan === 'pro' ? (body?.plan_expires_at || null) : null;
      const { data, error } = await admin.from('parishes')
        .update({ plan, plan_expires_at: expires })
        .eq('id', parishId)
        .select('id, plan, plan_expires_at')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, parish: data });
    }

    return json({ error: 'Action không hợp lệ' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
