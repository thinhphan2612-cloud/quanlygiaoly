// Gửi email chương trình khuyến mãi cho USER ĐANG DÙNG GÓI KHỞI ĐỘNG (plan='free').
// Bảo vệ bằng header x-promo-secret == PROMO_SECRET.
// 3 chế độ (body.mode): 'dry' (chỉ liệt kê người nhận, KHÔNG gửi) | 'test' (gửi 1 email
//   tới body.to) | 'send' (gửi thật cho tất cả free). Deploy:
//   npx supabase functions deploy promo-blast --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CODE = 'BACKTOSCHOOL';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';

function promoHtml(who: string, pname: string, remaining: number | null, gmailUser: string) {
  const rem = remaining != null
    ? `Chương trình chỉ dành cho <b>50 giáo xứ nhập mã đầu tiên</b> — hiện còn <b>${remaining} suất</b>.`
    : `Chương trình chỉ dành cho <b>50 giáo xứ nhập mã đầu tiên</b> — nhanh tay kẻo hết.`;
  return `
  <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#2563eb;padding:20px 28px;text-align:center">
        <img src="${APP_URL}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
      </div>
      <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
        <h2 style="color:#2563eb;margin:0 0 12px;font-size:21px">Quà năm học mới: 3 tháng gói Pro miễn phí 🎒</h2>
        <p style="margin:0 0 12px">Kính gửi ${who},</p>
        <p style="margin:0 0 14px">Nhân dịp khai giảng năm học giáo lý mới, <b>Giáo Lý Số</b> gửi tặng giáo xứ <b>${pname}</b> — hiện đang dùng gói <b>Khởi động</b> — cơ hội trải nghiệm <b>MIỄN PHÍ toàn bộ gói Pro (tối đa 5 lớp) trong 3 tháng</b>.</p>
        <div style="margin:0 0 16px;padding:16px;background:#eff6ff;border:1px dashed #93c5fd;border-radius:12px;text-align:center">
          <div style="color:#6b7280;font-size:13px;margin-bottom:4px">Mã ưu đãi của bạn</div>
          <div style="font-size:26px;font-weight:800;letter-spacing:2px;color:#2563eb">${CODE}</div>
          <div style="color:#6b7280;font-size:12.5px;margin-top:6px">${rem}</div>
        </div>
        <p style="margin:0 0 8px;font-weight:600">Cách nhận ưu đãi (mất 30 giây):</p>
        <ol style="margin:0 0 16px;padding-left:20px;font-size:14px">
          <li>Đăng nhập ứng dụng Giáo Lý Số.</li>
          <li>Mở mục <b>Xem gói &amp; nâng cấp</b>.</li>
          <li>Nhập mã <b>${CODE}</b> vào ô <b>“Có mã khuyến mãi?”</b> → gói Pro mở khóa ngay.</li>
        </ol>
        <p style="margin:0 0 18px;font-size:14px">Khi lên Pro, giáo xứ mở khóa: không giới hạn giáo lý viên, xuất chứng chỉ, thi online &amp; tự chấm điểm, điểm số &amp; thi đua, lưu trữ niên khóa, game học giáo lý…</p>
        <p style="text-align:center;margin:0"><a href="${APP_URL}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:10px;font-weight:600;display:inline-block">Nhập mã ngay →</a></p>
      </div>
      <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
        Xin Chúa chúc lành cho việc dạy giáo lý của giáo xứ. Cần hỗ trợ, xin phản hồi email này hoặc nhắn Zalo 0964 013 126.<br>
        <b style="color:#374151">Giáo Lý Số</b> · ${gmailUser}
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if ((req.headers.get('x-promo-secret') || '') !== (Deno.env.get('PROMO_SECRET') || '\0')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const body = await req.json().catch(() => ({}));
  const mode = ['dry', 'test', 'send'].includes(body?.mode) ? body.mode : 'dry';

  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  // Số suất còn lại của mã
  let remaining: number | null = null;
  try {
    const { data } = await admin.rpc('code_remaining', { p_code: CODE });
    if (data && data.remaining != null) remaining = data.remaining;
  } catch (_e) { /* ignore */ }

  const subject = `🎒 Tặng giáo xứ 3 tháng gói Pro MIỄN PHÍ — Giáo Lý Số`;

  // ---- TEST: gửi 1 email mẫu ----
  if (mode === 'test') {
    const to = String(body?.to || '').trim();
    if (!to) return new Response(JSON.stringify({ error: 'thiếu to' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser!, password: gmailPass! } } });
    await client.send({ from: `Giáo Lý Số <${gmailUser}>`, to, subject: '[TEST] ' + subject, html: promoHtml('Quý Cha / Quý Thầy Cô', 'Giáo xứ Mẫu', remaining, gmailUser!) });
    await client.close();
    return new Response(JSON.stringify({ ok: true, mode, sent_to: to, remaining }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ---- Thu thập người nhận: parish plan='free' + admin của parish ----
  const { data: parishes } = await admin.from('parishes').select('id, name, plan').eq('plan', 'free');
  const { data: profiles } = await admin.from('profiles').select('id, parish_id, role, full_name, email').eq('role', 'admin');
  const admins = new Map<string, any>();
  for (const p of (profiles || [])) if (p.parish_id && !admins.has(p.parish_id)) admins.set(p.parish_id, p);

  const exclude = new Set<string>(((body?.exclude || []) as string[]).map((e) => String(e).trim().toLowerCase()));
  const seen = new Set<string>();
  const recipients: { to: string; who: string; pname: string; parish_id: string }[] = [];
  for (const par of (parishes || [])) {
    const prof = admins.get(par.id);
    if (!prof) continue;
    let to = (prof.email || '').trim();
    if (!to) { try { const { data: uu } = await admin.auth.admin.getUserById(prof.id); to = uu?.user?.email || ''; } catch (_e) { /* ignore */ } }
    to = to.trim().toLowerCase();
    if (!to || seen.has(to) || exclude.has(to)) continue;
    seen.add(to);
    recipients.push({ to, who: prof.full_name || 'Quý Cha / Quý Thầy Cô', pname: par.name || 'Giáo xứ', parish_id: par.id });
  }

  // ---- DRY: chỉ liệt kê ----
  if (mode === 'dry') {
    return new Response(JSON.stringify({ ok: true, mode, remaining, count: recipients.length,
      recipients: recipients.map((r) => ({ to: r.to, pname: r.pname, who: r.who })) }, null, 2),
      { headers: { 'Content-Type': 'application/json' } });
  }

  // ---- SEND: gửi thật ----
  if (!gmailUser || !gmailPass) return new Response(JSON.stringify({ error: 'no-smtp' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } } });
  let sent = 0; const failed: string[] = [];
  for (const r of recipients) {
    try {
      await client.send({ from: `Giáo Lý Số <${gmailUser}>`, to: r.to, subject,
        content: `Kính gửi ${r.who}, tặng giáo xứ ${r.pname} 3 tháng gói Pro miễn phí. Nhập mã ${CODE} trong mục Xem gói & nâng cấp. ${APP_URL}`,
        html: promoHtml(r.who, r.pname, remaining, gmailUser) });
      sent++;
      await new Promise((res) => setTimeout(res, 350));
    } catch (_e) { failed.push(r.to); }
  }
  await client.close();
  return new Response(JSON.stringify({ ok: true, mode, remaining, total: recipients.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } });
});
