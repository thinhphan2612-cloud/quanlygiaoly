// Supabase Edge Function: API cho super-admin (chủ hệ thống).
// Xác thực người gọi là super-admin (email nằm trong SUPERADMIN_EMAILS),
// rồi dùng service_role để đọc TẤT CẢ giáo xứ và bật/tắt gói Pro thủ công.
// Actions: { action: 'list' } | { action: 'set-plan', parish_id, plan, plan_expires_at }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Encode tiêu đề UTF-8 -> RFC 2047 base64 encoded-words (ASCII hợp lệ).
function mimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s) && !s.includes('=?')) return s;
  const enc = new TextEncoder(); const words: string[] = []; let buf: number[] = [];
  const flush = () => { if (buf.length) { words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...buf))}?=`); buf = []; } };
  for (const ch of s) { const b = Array.from(enc.encode(ch)); if (buf.length + b.length > 39) flush(); buf.push(...b); }
  flush(); return words.join('\r\n ');
}

// Gửi email HTML qua SMTP thô (Deno TLS) — không dùng denomailer (dựng MIME hỏng -> Gmail hiện raw).
async function smtpSend(to: string, subject: string, html: string) {
  const user = Deno.env.get('GMAIL_USER')!; const pass = Deno.env.get('GMAIL_APP_PASSWORD')!;
  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
  const E = new TextEncoder(), D = new TextDecoder();
  const read = async (): Promise<string> => {
    const b = new Uint8Array(8192); let out = '';
    while (true) { const n = await conn.read(b); if (n === null) break; out += D.decode(b.subarray(0, n));
      const last = out.trimEnd().split(/\r?\n/).pop() || ''; if (/^\d{3} /.test(last)) break; }
    return out;
  };
  const cmd = async (s: string) => { await conn.write(E.encode(s + '\r\n')); return await read(); };
  const b64 = (s: string) => { const by = E.encode(s); let bin = ''; for (const x of by) bin += String.fromCharCode(x); return btoa(bin); };
  const b64wrap = (s: string) => (b64(s).match(/.{1,76}/g) || []).join('\r\n');
  try {
    await read(); await cmd('EHLO giaoly'); await cmd('AUTH LOGIN'); await cmd(b64(user));
    const rp = await cmd(b64(pass)); if (!/^235/.test(rp.trimStart())) throw new Error('AUTH: ' + rp);
    await cmd(`MAIL FROM:<${user}>`); await cmd(`RCPT TO:<${to}>`);
    const rd = await cmd('DATA'); if (!/^354/.test(rd.trimStart())) throw new Error('DATA: ' + rd);
    const headers = [`From: Giao Ly So <${user}>`, `To: <${to}>`, `Subject: ${mimeWord(subject)}`,
      `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, `Content-Transfer-Encoding: base64`].join('\r\n');
    await conn.write(E.encode(headers + '\r\n\r\n' + b64wrap(html) + '\r\n.\r\n'));
    const fin = await read(); if (!/^250/.test(fin.trimStart())) throw new Error('SEND: ' + fin);
    await cmd('QUIT');
  } finally { try { conn.close(); } catch (_e) { /* ignore */ } }
}

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

// Gửi email chào mừng khi giáo xứ được kích hoạt / gia hạn Pro — gửi TỪ Gmail
// (support.giaolyso@gmail.com) qua SMTP + App Password. Tự bỏ qua nếu chưa cấu
// hình GMAIL_USER/GMAIL_APP_PASSWORD -> KHÔNG chặn việc kích hoạt.
async function sendProEmail(admin: any, parishId: string, opts: { expires?: string | null; maxClasses?: number | null }, kind: 'welcome' | 'renew' = 'welcome') {
  try {
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailUser || !gmailPass || !parishId) return;
    const appUrl = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';
    const { data: prof } = await admin.from('profiles').select('id, full_name').eq('parish_id', parishId).eq('role', 'admin').limit(1).maybeSingle();
    if (!prof) return;
    const { data: uu } = await admin.auth.admin.getUserById(prof.id);
    const to = uu?.user?.email;
    if (!to) return;
    const { data: par } = await admin.from('parishes').select('name').eq('id', parishId).maybeSingle();
    const pname = par?.name || 'Giáo xứ';
    const who = prof.full_name || 'Quý Cha / Quý Thầy Cô';
    const limitTxt = opts.maxClasses ? `tối đa <b>${opts.maxClasses} lớp</b>` : '<b>không giới hạn lớp</b>';
    const expTxt = opts.expires ? `đến hết ngày <b>${new Date(opts.expires).toLocaleDateString('vi-VN')}</b>` : '<b>không giới hạn thời gian</b>';
    const isRenew = kind === 'renew';
    const title = isRenew ? 'Gia hạn gói Pro thành công 🎉' : `Chào mừng ${pname} lên gói Pro! 🎉`;
    const intro = isRenew
      ? `Giáo xứ <b>${pname}</b> đã được <b>gia hạn gói Pro</b> trên Giáo Lý Số:`
      : `Giáo xứ <b>${pname}</b> đã được kích hoạt <b>gói Pro</b> trên Giáo Lý Số:`;
    const subject = isRenew ? `Gia hạn gói Pro thành công: ${pname}` : `Chào mừng ${pname} lên gói Pro`;
    const html = `
      <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
          <div style="background:#2563eb;padding:20px 28px;text-align:center">
            <img src="https://app.giaoly.com.vn/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
          </div>
          <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
            <h2 style="color:#2563eb;margin:0 0 12px;font-size:20px">${title}</h2>
            <p style="margin:0 0 12px">Kính gửi ${who},</p>
            <p style="margin:0 0 14px">${intro}</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280">Quy mô</td><td style="padding:8px 0;text-align:right">${limitTxt}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #eef2f7">Hiệu lực</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eef2f7">${expTxt}</td></tr>
            </table>
            <p style="margin:0 0 20px">Toàn bộ tính năng Pro đã mở khóa: không giới hạn giáo lý viên, xuất chứng chỉ, thi online, điểm số &amp; thi đua, lưu trữ niên khóa, game học giáo lý…</p>
            <p style="text-align:center;margin:0"><a href="${appUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Vào ứng dụng</a></p>
          </div>
          <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
            Xin Chúa chúc lành cho việc dạy giáo lý của giáo xứ. Cần hỗ trợ, xin phản hồi email này.<br>
            <b style="color:#374151">Giáo Lý Số</b> · ${gmailUser}
          </div>
        </div>
      </div>`;
    await smtpSend(to, subject, html);
  } catch (_e) { /* lỗi gửi mail không được chặn kích hoạt */ }
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
      const { data: prev } = await admin.from('parishes').select('plan').eq('id', parishId).maybeSingle();
      const { data, error } = await admin.from('parishes')
        .update({ plan, plan_expires_at: expires, plan_max_classes: maxClasses })
        .eq('id', parishId)
        .select('id, plan, plan_expires_at, plan_max_classes')
        .single();
      if (error) return json({ error: error.message }, 400);
      if (plan === 'pro') await sendProEmail(admin, parishId, { expires, maxClasses }, prev?.plan === 'pro' ? 'renew' : 'welcome');
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
        .select('id, order_code, parish_id, tier_label, base_amount, discount_code, discount_amount, credit_amount, final_amount, status, created_at, parishes(name)')
        .order('created_at', { ascending: false }).limit(500);
      if (body?.status) q = q.eq('status', body.status);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const orders = (data || []).map((o: any) => ({
        id: o.id, order_code: o.order_code, parish_id: o.parish_id, tier_label: o.tier_label,
        base_amount: o.base_amount, discount_code: o.discount_code, discount_amount: o.discount_amount,
        credit_amount: o.credit_amount || 0,
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
      let expires = body?.plan_expires_at || null;
      if (o.parish_id) {
        // Suy giới hạn số lớp từ mức của đơn (null = không giới hạn).
        let maxClasses: number | null = null;
        if (o.tier_id) {
          const { data: t } = await admin.from('plan_tiers').select('max_classes').eq('id', o.tier_id).maybeSingle();
          maxClasses = t?.max_classes ?? null;
        }
        const { data: prevP } = await admin.from('parishes').select('plan, plan_expires_at, settings').eq('id', o.parish_id).maybeSingle();
        // HẠN MỚI (kiểu Apple): chu kỳ 365 ngày (12 tháng) tính TỪ HÔM NAY. Không cộng dồn
        // thời gian — phần còn thừa của gói cũ đã được khấu trừ bằng tiền (credit) khi tạo đơn.
        if (!expires) {
          const base = new Date();
          base.setMonth(base.getMonth() + 12);
          expires = base.toISOString();
        }
        // Xóa cờ nhắc gia hạn để chu kỳ nhắc bắt đầu lại cho hạn mới.
        const st = { ...(prevP?.settings || {}) };
        delete st.renew_last_reminded; delete st.renew_reminded_for;
        const { error: e1 } = await admin.from('parishes')
          .update({ plan: 'pro', plan_expires_at: expires, plan_max_classes: maxClasses, settings: st }).eq('id', o.parish_id);
        if (e1) return json({ error: e1.message }, 400);
        await sendProEmail(admin, o.parish_id, { expires, maxClasses }, prevP?.plan === 'pro' ? 'renew' : 'welcome');
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
      const kind = ['amount', 'percent', 'pro_free'].includes(body?.kind) ? body.kind : 'percent';
      const row = {
        code,
        kind,
        value: kind === 'pro_free' ? 0 : (Number(body?.value) || 0),
        free_months: kind === 'pro_free' ? (Number(body?.free_months) || 3) : null,
        tier_id: kind === 'pro_free' ? (Number(body?.tier_id) || null) : null,
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
