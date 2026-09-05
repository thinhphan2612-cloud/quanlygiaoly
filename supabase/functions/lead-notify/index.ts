// Nhận tin nhắn từ form liên hệ (Zalo FAB) trên landing → gửi email về hộp hỗ trợ.
// Public (gọi bằng anon key từ trang tĩnh). Deploy:
//   npx supabase functions deploy lead-notify --no-verify-jwt --project-ref <ref>
const SUPPORT_TO = 'support.giaolyso@gmail.com';

// Encode tiêu đề UTF-8 -> RFC 2047 base64 encoded-words (ASCII hợp lệ).
function mimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s) && !s.includes('=?')) return s;
  const enc = new TextEncoder(); const words: string[] = []; let buf: number[] = [];
  const flush = () => { if (buf.length) { words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...buf))}?=`); buf = []; } };
  for (const ch of s) { const b = Array.from(enc.encode(ch)); if (buf.length + b.length > 39) flush(); buf.push(...b); }
  flush(); return words.join('\r\n ');
}

// Gửi 1 email HTML qua SMTP thô (Deno TLS) -> tự dựng thư, không dùng thư viện (denomailer 1.6.0 dựng MIME hỏng).
async function smtpSend(opts: { to: string; subject: string; html: string; replyTo?: string }) {
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
    await cmd(`MAIL FROM:<${user}>`); await cmd(`RCPT TO:<${opts.to}>`);
    const rd = await cmd('DATA'); if (!/^354/.test(rd.trimStart())) throw new Error('DATA: ' + rd);
    const headers = [`From: Giao Ly So <${user}>`, `To: <${opts.to}>`,
      ...(opts.replyTo ? [`Reply-To: <${opts.replyTo}>`] : []),
      `Subject: ${mimeWord(opts.subject)}`, `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`, `Content-Transfer-Encoding: base64`].join('\r\n');
    await conn.write(E.encode(headers + '\r\n\r\n' + b64wrap(opts.html) + '\r\n.\r\n'));
    const fin = await read(); if (!/^250/.test(fin.trimStart())) throw new Error('SEND: ' + fin);
    await cmd('QUIT');
  } finally { try { conn.close(); } catch (_e) { /* ignore */ } }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function esc(s: string) {
  return String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
}

function notifyHtml(name: string, phone: string, msg: string, source: string) {
  return `
  <div style="background:#f4f6fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
      <div style="background:#2563eb;padding:16px 24px;color:#fff;font-weight:700;font-size:16px">📩 Tin nhắn liên hệ mới</div>
      <div style="padding:22px 26px;color:#1f2937;line-height:1.6">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280;width:110px">Tên</td><td style="padding:6px 0"><b>${esc(name) || '(không rõ)'}</b></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">SĐT / Email</td><td style="padding:6px 0"><b>${esc(phone) || '(không có)'}</b></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Nguồn</td><td style="padding:6px 0">${esc(source) || 'Landing'}</td></tr>
        </table>
        <div style="margin-top:14px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;white-space:pre-wrap">${esc(msg)}</div>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').slice(0, 120);
    const phone = String(body?.phone || '').slice(0, 120);
    const msg = String(body?.msg || '').slice(0, 4000).trim();
    const source = String(body?.source || 'Landing / Zalo FAB').slice(0, 120);
    if (!msg) return new Response(JSON.stringify({ ok: false, error: 'empty' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const user = Deno.env.get('GMAIL_USER');
    const pass = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!user || !pass) return new Response(JSON.stringify({ ok: false, error: 'no-smtp' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    await smtpSend({
      to: SUPPORT_TO,
      replyTo: phone && /@/.test(phone) ? phone : undefined,
      subject: `[Liên hệ] ${name || 'Khách'}${phone ? ' · ' + phone : ''}`,
      html: notifyHtml(name, phone, msg, source),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
