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
        admin.from('parishes').select('id, name, diocese, plan, plan_expires_at, plan_max_classes, created_at'),
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
          plan_max_classes: p.plan_max_classes ?? null,
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
      // Giới hạn số lớp theo mức Pro (null = không giới hạn). Free -> null (mặc định 1 lớp do trigger).
      const maxClasses = plan === 'pro' ? (body?.plan_max_classes ?? null) : null;
      const { data, error } = await admin.from('parishes')
        .update({ plan, plan_expires_at: expires, plan_max_classes: maxClasses })
        .eq('id', parishId)
        .select('id, plan, plan_expires_at, plan_max_classes')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, parish: data });
    }

    // -------- sửa tên/giáo phận 1 giáo xứ --------
    if (action === 'update-parish') {
      const parishId = body?.parish_id;
      const name = (body?.name || '').trim();
      if (!parishId || !name) return json({ error: 'Thiếu tên giáo xứ' }, 400);
      const { data, error } = await admin.from('parishes')
        .update({ name, diocese: (body?.diocese || '').trim() || null })
        .eq('id', parishId).select('id, name, diocese').single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, parish: data });
    }

    // -------- xoá 1 giáo xứ (cascade: lớp/học viên/profile theo FK) --------
    if (action === 'delete-parish') {
      const parishId = body?.parish_id;
      if (!parishId) return json({ error: 'Thiếu parish_id' }, 400);
      const { error } = await admin.from('parishes').delete().eq('id', parishId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- sổ thanh toán --------
    if (action === 'payments-list') {
      const { data, error } = await admin.from('payments')
        .select('id, parish_id, amount, method, tier, discount_code, note, paid_at, parishes(name)')
        .order('paid_at', { ascending: false }).order('created_at', { ascending: false }).limit(500);
      if (error) return json({ error: error.message }, 400);
      const payments = (data || []).map((p: any) => ({
        id: p.id, parish_id: p.parish_id, amount: p.amount, method: p.method,
        tier: p.tier, discount_code: p.discount_code, note: p.note, paid_at: p.paid_at,
        parish_name: p.parishes?.name || '(đã xoá)',
      }));
      return json({ payments });
    }
    if (action === 'payment-add') {
      const { data, error } = await admin.from('payments').insert({
        parish_id: body?.parish_id || null,
        amount: Number(body?.amount) || 0,
        method: body?.method || null,
        tier: body?.tier || null,
        discount_code: body?.discount_code || null,
        note: body?.note || null,
        paid_at: body?.paid_at || new Date().toISOString().slice(0, 10),
      }).select('id').single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data.id });
    }
    if (action === 'payment-delete') {
      if (!body?.id) return json({ error: 'Thiếu id' }, 400);
      const { error } = await admin.from('payments').delete().eq('id', body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- đơn chờ thanh toán --------
    if (action === 'orders-list') {
      let q = admin.from('plan_orders')
        .select('id, order_code, parish_id, tier_label, base_amount, discount_code, discount_amount, final_amount, status, created_at, parishes(name)')
        .order('created_at', { ascending: false }).limit(500);
      if (body?.status) q = q.eq('status', body.status);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const orders = (data || []).map((o: any) => ({
        id: o.id, order_code: o.order_code, parish_id: o.parish_id, tier_label: o.tier_label,
        base_amount: o.base_amount, discount_code: o.discount_code, discount_amount: o.discount_amount,
        final_amount: o.final_amount, status: o.status, created_at: o.created_at,
        parish_name: o.parishes?.name || '(đã xoá)',
      }));
      return json({ orders });
    }
    // đánh dấu đơn đã trả -> kích hoạt Pro + ghi sổ thu + cộng lượt dùng mã
    if (action === 'order-paid') {
      const id = body?.id;
      if (!id) return json({ error: 'Thiếu id' }, 400);
      const { data: o, error: e0 } = await admin.from('plan_orders').select('*').eq('id', id).single();
      if (e0 || !o) return json({ error: 'Không tìm thấy đơn' }, 400);
      const expires = body?.plan_expires_at || null;
      if (o.parish_id) {
        // Suy giới hạn số lớp từ mức của đơn (null = không giới hạn).
        let maxClasses: number | null = null;
        if (o.tier_id) {
          const { data: t } = await admin.from('plan_tiers').select('max_classes').eq('id', o.tier_id).maybeSingle();
          maxClasses = t?.max_classes ?? null;
        }
        const { error: e1 } = await admin.from('parishes')
          .update({ plan: 'pro', plan_expires_at: expires, plan_max_classes: maxClasses }).eq('id', o.parish_id);
        if (e1) return json({ error: e1.message }, 400);
      }
      await admin.from('plan_orders').update({ status: 'paid' }).eq('id', id);
      await admin.from('payments').insert({
        parish_id: o.parish_id, amount: o.final_amount, method: 'bank',
        tier: o.tier_label, discount_code: o.discount_code,
        note: `Đơn ${o.order_code}`, paid_at: new Date().toISOString().slice(0, 10),
      });
      if (o.discount_code) {
        const { data: dc } = await admin.from('discount_codes').select('used_count').eq('code', o.discount_code).single();
        if (dc) await admin.from('discount_codes').update({ used_count: (dc.used_count || 0) + 1 }).eq('code', o.discount_code);
      }
      return json({ ok: true });
    }
    if (action === 'order-cancel') {
      if (!body?.id) return json({ error: 'Thiếu id' }, 400);
      const { error } = await admin.from('plan_orders').update({ status: 'canceled' }).eq('id', body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- mã giảm giá --------
    if (action === 'codes-list') {
      const { data, error } = await admin.from('discount_codes').select('*').order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ codes: data || [] });
    }
    if (action === 'code-save') {
      const code = (body?.code || '').trim().toUpperCase();
      if (!code) return json({ error: 'Thiếu mã' }, 400);
      const row = {
        code,
        kind: body?.kind === 'amount' ? 'amount' : 'percent',
        value: Number(body?.value) || 0,
        expires_at: body?.expires_at || null,
        max_uses: body?.max_uses === '' || body?.max_uses == null ? null : Number(body.max_uses),
        active: body?.active !== false,
        note: body?.note || null,
      };
      const { error } = await admin.from('discount_codes').upsert(row, { onConflict: 'code' });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === 'code-delete') {
      if (!body?.code) return json({ error: 'Thiếu mã' }, 400);
      const { error } = await admin.from('discount_codes').delete().eq('code', body.code);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- sửa giá gói --------
    if (action === 'tier-save') {
      const id = Number(body?.id);
      if (!id) return json({ error: 'Thiếu id bậc' }, 400);
      const patch: Record<string, unknown> = {};
      if (body?.label !== undefined) patch.label = body.label;
      if (body?.price !== undefined) patch.price = body.price === '' || body.price == null ? null : Number(body.price);
      if (body?.max_classes !== undefined) patch.max_classes = body.max_classes === '' || body.max_classes == null ? null : Number(body.max_classes);
      const { error } = await admin.from('plan_tiers').update(patch).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- đơn liên hệ & đăng ký dùng thử (leads) --------
    if (action === 'leads-list') {
      const { data, error } = await admin.from('leads')
        .select('*').order('created_at', { ascending: false }).limit(500);
      if (error) return json({ error: error.message }, 400);
      return json({ leads: data || [] });
    }
    if (action === 'lead-status') {
      if (!body?.id || !body?.status) return json({ error: 'Thiếu id/status' }, 400);
      const { error } = await admin.from('leads').update({ status: body.status }).eq('id', body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === 'lead-delete') {
      if (!body?.id) return json({ error: 'Thiếu id' }, 400);
      const { error } = await admin.from('leads').delete().eq('id', body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    // Cấp tài khoản cho người liên hệ: mời qua email (Supabase gửi link đặt mật khẩu).
    // Trigger handle_new_user tự tạo giáo xứ + tài khoản admin từ metadata.
    if (action === 'grant-account') {
      const email = (body?.email || '').trim().toLowerCase();
      const parishName = (body?.parish_name || '').trim();
      const fullName = (body?.full_name || '').trim();
      if (!email) return json({ error: 'Thiếu email' }, 400);
      if (!parishName) return json({ error: 'Thiếu tên giáo xứ' }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, parish_name: parishName, diocese: (body?.diocese || '').trim() },
      });
      if (error) return json({ error: error.message }, 400);
      if (body?.lead_id) await admin.from('leads').update({ status: 'granted' }).eq('id', body.lead_id);
      return json({ ok: true, user_id: data?.user?.id, email });
    }

    return json({ error: 'Action không hợp lệ' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
