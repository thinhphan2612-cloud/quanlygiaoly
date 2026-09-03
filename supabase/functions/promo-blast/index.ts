// Gửi email chương trình khuyến mãi cho USER ĐANG DÙNG GÓI KHỞI ĐỘNG (plan='free').
// Bảo vệ bằng header x-promo-secret == PROMO_SECRET.
// 3 chế độ (body.mode): 'dry' (chỉ liệt kê người nhận, KHÔNG gửi) | 'test' (gửi 1 email
//   tới body.to) | 'send' (gửi thật cho tất cả free). Deploy:
//   npx supabase functions deploy promo-blast --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CODE = 'BACKTOSCHOOL';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';

// Encode tiêu đề UTF-8 -> RFC 2047 base64 encoded-words (ASCII hợp lệ, gập đúng chuẩn).
// Tránh bug encode header của denomailer với chuỗi tiếng Việt/emoji dài.
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

// Gửi 1 email HTML qua SMTP thô (Deno TLS) -> tự dựng thư, không dùng thư viện.
// Thư 1 phần text/html; charset UTF-8; body base64 -> Gmail render đúng, không vỡ MIME.
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
    await read();                       // greeting 220
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

function promoHtml(who: string, pname: string, remaining: number | null, gmailUser: string, apology = false) {
  const rem = remaining != null
    ? `Chương trình chỉ dành cho <b>50 giáo xứ nhập mã đầu tiên</b> — hiện còn <b>${remaining} suất</b>.`
    : `Chương trình chỉ dành cho <b>50 giáo xứ nhập mã đầu tiên</b> — nhanh tay kẻo hết.`;
  const apologyBox = apology
    ? `<div style="margin:0 0 16px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:13.5px;line-height:1.55">
         Chúng con xin lỗi vì email gửi trước đó bị <b>lỗi hiển thị</b> (hiện dạng mã kỹ thuật). Chúng con đã khắc phục — đây là nội dung đúng, xin Quý Cha / Quý Thầy Cô bỏ qua thư trước ạ.
       </div>`
    : '';
  return `
  <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#2563eb;padding:20px 28px;text-align:center">
        <img src="${APP_URL}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
      </div>
      <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
        ${apologyBox}
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
  const mode = ['dry', 'test', 'send', 'list'].includes(body?.mode) ? body.mode : 'dry';
  const apology = body?.apology === true;

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

  const rawSubject = `🎒 Tặng giáo xứ 3 tháng gói Pro MIỄN PHÍ — Giáo Lý Số`;

  // ---- TEST: gửi 1 email mẫu ----
  if (mode === 'test') {
    const to = String(body?.to || '').trim();
    if (!to) return new Response(JSON.stringify({ error: 'thiếu to' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    await smtpSend(to, '[TEST] ' + rawSubject, promoHtml('Quý Cha / Quý Thầy Cô', 'Giáo xứ Mẫu', remaining, gmailUser!, apology));
    return new Response(JSON.stringify({ ok: true, mode, sent_to: to, remaining }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ---- LIST: gửi đúng danh sách email chỉ định (KHÔNG lọc theo plan) ----
  if (mode === 'list') {
    if (!gmailUser || !gmailPass) return new Response(JSON.stringify({ error: 'no-smtp' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const emails = ((body?.emails || []) as string[]).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    const { data: profs } = await admin.from('profiles').select('parish_id, full_name, email').in('email', emails);
    const byEmail = new Map<string, any>();
    for (const p of (profs || [])) if (p.email) byEmail.set(String(p.email).toLowerCase(), p);
    const pids = [...new Set((profs || []).map((p) => p.parish_id).filter(Boolean))];
    const { data: pars } = pids.length ? await admin.from('parishes').select('id, name').in('id', pids) : { data: [] as any[] };
    const pnameById = new Map<string, string>();
    for (const x of (pars || [])) pnameById.set(x.id, x.name);
    let sent = 0; const failed: string[] = [];
    for (const to of emails) {
      const pr = byEmail.get(to);
      const who = pr?.full_name || 'Quý Cha / Quý Thầy Cô';
      const pn = (pr && pnameById.get(pr.parish_id)) || 'giáo xứ';
      try { await smtpSend(to, rawSubject, promoHtml(who, pn, remaining, gmailUser, apology)); sent++; await new Promise((r) => setTimeout(r, 350)); }
      catch (_e) { failed.push(to); }
    }
    return new Response(JSON.stringify({ ok: true, mode, total: emails.length, sent, failed, remaining }), { headers: { 'Content-Type': 'application/json' } });
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
  let sent = 0; const failed: string[] = [];
  for (const r of recipients) {
    try {
      await smtpSend(r.to, rawSubject, promoHtml(r.who, r.pname, remaining, gmailUser, apology));
      sent++;
      await new Promise((res) => setTimeout(res, 350));
    } catch (_e) { failed.push(r.to); }
  }
  return new Response(JSON.stringify({ ok: true, mode, remaining, total: recipients.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } });
});
