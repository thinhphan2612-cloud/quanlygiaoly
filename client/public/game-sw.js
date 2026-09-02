// Service Worker: phục vụ file game (bucket default-games trên Supabase Storage)
// với ĐÚNG Content-Type. Cần vì Supabase ép mọi .html -> text/plain (chặn host
// HTML) khiến game nhiều trang không chạy. SW chạy trong chính bản build client
// nên hoạt động ở mọi nơi app được deploy, không cần serverless.
// Chỉ can thiệp các request /game-proxy/... — mọi request khác đi mạng bình thường.
const SUPA = 'https://jznntxlixctjwxqxatxs.supabase.co';
const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', txt: 'text/plain; charset=utf-8',
};
const mimeOf = (p) => MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/game-proxy/')) return;
  const rel = url.pathname.slice('/game-proxy/'.length);
  e.respondWith((async () => {
    try {
      const range = e.request.headers.get('range');
      const r = await fetch(`${SUPA}/storage/v1/object/public/default-games/${rel}`, range ? { headers: { range } } : {});
      // Giữ NGUYÊN header của Supabase (status 200/206, Content-Range, Content-Length,
      // Accept-Ranges) để video/audio tua & phát đúng; chỉ ép lại Content-Type (vì
      // Supabase trả text/plain cho .html). Stream thẳng body, không buffer.
      const h = new Headers(r.headers);
      h.set('Content-Type', mimeOf(rel));
      h.delete('content-encoding'); // Storage trả raw; xoá phòng hờ để không giải mã 2 lần
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    } catch (err) {
      return new Response('proxy error', { status: 502 });
    }
  })());
});
