// CHIẾN DỊCH ĐẶC BIỆT: nâng các giáo xứ đang Khởi động (free) hoặc Pro 3 tháng
// lên Pro 12 tháng (giữ nguyên bậc; free -> bậc nhỏ ≤5 lớp), rồi gửi email báo.
// BỎ QUA giáo xứ đã có Pro dài hạn (có đơn đã thanh toán HOẶC còn > 150 ngày).
// Chống gửi/nâng trùng bằng cờ settings.pro12_campaign.
// Bảo vệ bằng header x-campaign-secret == PRO12_SECRET.
// Chế độ (body.mode): 'dry' (chỉ liệt kê, KHÔNG đổi gì) | 'test' (gửi 1 email tới body.to)
//   | 'apply' (nâng gói THẬT + gửi email). Deploy:
//   npx supabase functions deploy pro12-campaign --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';
const LONG_DAYS = 150; // 'pro' còn > ngưỡng này coi như đã có gói dài -> bỏ qua

function mimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s) && !s.includes('=?')) return s;
  const enc = new TextEncoder();
  const words: string[] = [];
  let buf: number[] = [];
  const flush = () => { if (buf.length) { words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...buf))}?=`); buf = []; } };
  for (const ch of s) {
    const b = Array.from(enc.encode(ch));
    if (buf.length + b.length > 39) flush();
    buf.push(...b);
  }
  flush();
  return words.join('\r\n ');
}
const FROM = `Giao Ly So <${Deno.env.get('GMAIL_USER')}>`;

async function smtpSend(to: string, subject: string, html: string) {
  const user = Deno.env.get('GMAIL_USER')!;
  const pass = Deno.env.get('GMAIL_APP_PASSWORD')!;
  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
  const E = new TextEncoder(), D = new TextDecoder();
  const read = async (): Promise<string> => {
    const b = new Uint8Array(8192); let out = '';
    while (true) {
      const n = await conn.read(b);
      if (n === null) break;
      out += D.decode(b.subarray(0, n));
      const last = out.trimEnd().split(/\r?\n/).pop() || '';
      if (/^\d{3} /.test(last)) break;
    }
    return out;
  };
  const cmd = async (s: string) => { await conn.write(E.encode(s + '\r\n')); return await read(); };
  const b64 = (s: string) => { const by = E.encode(s); let bin = ''; for (const x of by) bin += String.fromCharCode(x); return btoa(bin); };
  const b64wrap = (s: string) => (b64(s).match(/.{1,76}/g) || []).join('\r\n');
  try {
    await read();
    await cmd('EHLO giaoly');
    await cmd('AUTH LOGIN');
    await cmd(b64(user));
    const rp = await cmd(b64(pass));
    if (!/^235/.test(rp.trimStart())) throw new Error('AUTH: ' + rp);
    await cmd(`MAIL FROM:<${user}>`);
    await cmd(`RCPT TO:<${to}>`);
    const rd = await cmd('DATA');
    if (!/^354/.test(rd.trimStart())) throw new Error('DATA: ' + rd);
    const headers = [
      `From: ${FROM}`,
      `To: <${to}>`,
      `Subject: ${mimeWord(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
    ].join('\r\n');
    await conn.write(E.encode(headers + '\r\n\r\n' + b64wrap(html) + '\r\n.\r\n'));
    const fin = await read();
    if (!/^250/.test(fin.trimStart())) throw new Error('SEND: ' + fin);
    await cmd('QUIT');
  } finally { try { conn.close(); } catch (_e) { /* ignore */ } }
}

function tierLabel(maxClasses: number | null): string {
  if (maxClasses === 5) return 'Nhỏ (tối đa 5 lớp)';
  if (maxClasses === 12) return 'Vừa (6 đến 12 lớp)';
  if (maxClasses === 20) return 'Lớn (13 đến 20 lớp)';
  if (maxClasses == null) return 'Rất lớn (trên 20 lớp)';
  return `Tối đa ${maxClasses} lớp`;
}
const ddmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

function campaignHtml(who: string, pname: string, tier: string, expiry: string, gmailUser: string) {
  return `
  <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#2563eb;padding:20px 28px;text-align:center">
        <img src="${APP_URL}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
      </div>
      <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
        <h2 style="color:#2563eb;margin:0 0 12px;font-size:21px">Giáo xứ được nâng lên Pro 12 tháng miễn phí</h2>
        <p style="margin:0 0 12px">Kính gửi ${who},</p>
        <p style="margin:0 0 14px">Tạ ơn Chúa và cảm ơn giáo xứ đã đồng hành cùng <b>Giáo Lý Số</b>. Theo một <b>chương trình đặc biệt tri ân</b>, giáo xứ <b>${pname}</b> đã được <b>tự động nâng lên gói Pro, hoàn toàn miễn phí trong 12 tháng</b>.</p>
        <div style="margin:0 0 16px;padding:16px;background:#eff6ff;border:1px dashed #93c5fd;border-radius:12px">
          <div style="margin-bottom:6px"><span style="color:#6b7280;font-size:13px">Gói hiện tại:&nbsp;</span><b>Pro · ${tier}</b></div>
          <div><span style="color:#6b7280;font-size:13px">Hiệu lực đến:&nbsp;</span><b>${expiry}</b></div>
        </div>
        <p style="margin:0 0 16px;font-size:14px">Quý Cha, Quý Thầy Cô <b>không cần làm gì thêm</b>. Toàn bộ tính năng Pro đã sẵn sàng ngay khi đăng nhập: nhiều lớp và nhiều giáo lý viên, xuất chứng chỉ, thi online và tự chấm điểm, điểm số và thi đua, việc thiêng liêng, lưu trữ niên khóa, game học giáo lý…</p>
        <p style="text-align:center;margin:0"><a href="${APP_URL}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:10px;font-weight:600;display:inline-block">Mở ứng dụng →</a></p>
      </div>
      <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
        Xin Chúa chúc lành cho việc dạy giáo lý của giáo xứ. Cần hỗ trợ, xin phản hồi email này hoặc nhắn Zalo 0964 013 126.<br>
        <b style="color:#374151">Giáo Lý Số</b> · ${gmailUser}
      </div>
    </div>
  </div>`;
}

const SUBJECT = 'Giáo xứ được nâng lên Pro 12 tháng miễn phí theo chương trình đặc biệt';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if ((req.headers.get('x-campaign-secret') || '') !== (Deno.env.get('PRO12_SECRET') || '\0')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const body = await req.json().catch(() => ({}));
  const mode = ['dry', 'test', 'apply'].includes(body?.mode) ? body.mode : 'dry';
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

  // ---- TEST: gửi 1 email mẫu ----
  if (mode === 'test') {
    const to = String(body?.to || '').trim();
    if (!to) return J({ error: 'thiếu to' }, 400);
    await smtpSend(to, '[TEST] ' + SUBJECT, campaignHtml('Quý Cha / Quý Thầy Cô', 'Giáo xứ Mẫu', 'Vừa (6 đến 12 lớp)', ddmy(new Date(Date.now() + 365 * 864e5)), gmailUser!));
    return J({ ok: true, mode, sent_to: to });
  }

  // Hạn mới = đúng 12 tháng kể từ bây giờ
  const now = new Date();
  const newExp = new Date(now); newExp.setMonth(newExp.getMonth() + 12);
  const newExpIso = newExp.toISOString();
  const newExpVi = ddmy(newExp);

  // Dữ liệu: giáo xứ, đơn đã thanh toán, admin của giáo xứ
  const { data: parishes } = await admin.from('parishes').select('id, name, plan, plan_expires_at, plan_max_classes, settings');
  const { data: paidOrders } = await admin.from('plan_orders').select('parish_id').eq('status', 'paid');
  const paid = new Set<string>((paidOrders || []).map((o) => o.parish_id).filter(Boolean));
  const { data: profiles } = await admin.from('profiles').select('id, parish_id, role, full_name, email').eq('role', 'admin');
  const adminByParish = new Map<string, any>();
  for (const p of (profiles || [])) if (p.parish_id && !adminByParish.has(p.parish_id)) adminByParish.set(p.parish_id, p);

  const exclude = new Set<string>(((body?.exclude || []) as string[]).map((e) => String(e).trim().toLowerCase()));

  type Elig = { parish_id: string; name: string; to: string; who: string; from: string; tier_label: string; new_max: number | null };
  const eligible: Elig[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const par of (parishes || [])) {
    const settings = (par.settings || {}) as Record<string, unknown>;
    if (settings.pro12_campaign) { skipped.push({ name: par.name, reason: 'đã chạy chiến dịch trước đó' }); continue; }

    const isPro = par.plan === 'pro';
    const daysLeft = par.plan_expires_at ? (new Date(par.plan_expires_at).getTime() - now.getTime()) / 864e5 : -Infinity;
    if (isPro && (paid.has(par.id) || daysLeft > LONG_DAYS)) {
      skipped.push({ name: par.name, reason: paid.has(par.id) ? 'đã mua gói (đơn đã thanh toán)' : `đã có Pro dài hạn (còn ${Math.round(daysLeft)} ngày)` });
      continue;
    }
    // Đủ điều kiện: free, hoặc pro ngắn hạn (welcome 3 tháng) chưa mua
    const from = isPro ? 'Pro 3 tháng' : 'Khởi động';
    const newMax = isPro ? (par.plan_max_classes ?? 5) : 5; // pro: giữ bậc; free: bậc nhỏ (≤5)

    const prof = adminByParish.get(par.id);
    let to = (prof?.email || '').trim();
    if (!to && prof) { try { const { data: uu } = await admin.auth.admin.getUserById(prof.id); to = uu?.user?.email || ''; } catch (_e) { /* ignore */ } }
    to = to.trim().toLowerCase();
    if (!to) { skipped.push({ name: par.name, reason: 'không tìm thấy email quản trị viên' }); continue; }
    if (exclude.has(to)) { skipped.push({ name: par.name, reason: 'nằm trong danh sách loại trừ' }); continue; }

    eligible.push({ parish_id: par.id, name: par.name, to, who: prof?.full_name || 'Quý Cha / Quý Thầy Cô', from, tier_label: tierLabel(newMax), new_max: newMax });
  }

  // ---- DRY: chỉ liệt kê ----
  if (mode === 'dry') {
    return J({
      ok: true, mode, new_expiry: newExpVi, long_days: LONG_DAYS,
      eligible_count: eligible.length, skipped_count: skipped.length,
      eligible: eligible.map((e) => ({ name: e.name, to: e.to, from: e.from, new_tier: e.tier_label })),
      skipped,
    });
  }

  // ---- APPLY: nâng gói + gửi email ----
  if (!gmailUser || !gmailPass) return J({ error: 'no-smtp' }, 500);
  let upgraded = 0, sent = 0; const failedMail: string[] = []; const failedUpd: string[] = [];
  for (const e of eligible) {
    // 1) Nâng gói (đọc settings mới nhất để merge chính xác)
    const { data: cur } = await admin.from('parishes').select('settings').eq('id', e.parish_id).maybeSingle();
    const ns = { ...((cur?.settings || {}) as Record<string, unknown>) };
    delete ns.renew_last_reminded; delete ns.renew_reminded_for; // reset chu kỳ nhắc gia hạn
    ns.pro12_campaign = { at: now.toISOString(), tier: e.new_max, from: e.from };
    const { error: ue } = await admin.from('parishes')
      .update({ plan: 'pro', plan_expires_at: newExpIso, plan_max_classes: e.new_max, settings: ns })
      .eq('id', e.parish_id);
    if (ue) { failedUpd.push(e.name); continue; }
    upgraded++;
    // 2) Gửi email
    try { await smtpSend(e.to, SUBJECT, campaignHtml(e.who, e.name, e.tier_label, newExpVi, gmailUser)); sent++; await new Promise((r) => setTimeout(r, 350)); }
    catch (_e) { failedMail.push(e.to); }
  }
  return J({ ok: true, mode, new_expiry: newExpVi, eligible: eligible.length, upgraded, sent, failed_update: failedUpd, failed_mail: failedMail, skipped_count: skipped.length });
});
