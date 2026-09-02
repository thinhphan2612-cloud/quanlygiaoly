// Bộ chứng chỉ có thiết kế: dùng ảnh frame làm nền + vùng nội dung căn trong viền,
// nhúng font (Playfair Display SC cho tiêu đề, Fahkwang cho thân), in ra PDF qua iframe.
// Tất cả kích thước theo % của khung để độc lập độ phân giải khi in A4.

const FONT_CSS = `
@font-face{font-family:'PlayfairSC';src:url('/certfonts/PlayfairSC-Regular.ttf') format('truetype');font-weight:400;font-display:block}
@font-face{font-family:'PlayfairSC';src:url('/certfonts/PlayfairSC-Bold.ttf') format('truetype');font-weight:700;font-display:block}
@font-face{font-family:'Fahkwang';src:url('/certfonts/Fahkwang-Regular.ttf') format('truetype');font-weight:400;font-display:block}
@font-face{font-family:'Fahkwang';src:url('/certfonts/Fahkwang-SemiBold.ttf') format('truetype');font-weight:600;font-display:block}
@font-face{font-family:'Fahkwang';src:url('/certfonts/Fahkwang-Bold.ttf') format('truetype');font-weight:700;font-display:block}
`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmy = (d) => {
  if (!d) return '';
  const t = new Date(d); if (isNaN(t)) return String(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(t.getDate())}-${p(t.getMonth() + 1)}-${t.getFullYear()}`;
};
const dmyLong = (d) => {
  const t = d ? new Date(d) : new Date();
  return `ngày ${String(t.getDate()).padStart(2, '0')} tháng ${String(t.getMonth() + 1).padStart(2, '0')} năm ${t.getFullYear()}`;
};
const fullName = (s) => [s?.saint_name, s?.full_name].filter(Boolean).join(' ').trim();
const parentName = (saint, name) => [saint, name].filter(Boolean).join(' ').trim();
// dòng "nhãn: giá trị (đậm)"
const row = (label, value) => `<div class="r"><span class="lb">${esc(label)}</span> <b>${esc(value || '')}</b></div>`;

// ---------- Rửa Tội & Thêm Sức (khổ dọc) ----------
function baptismHtml({ parish, student: s, extra = {}, frame }) {
  const place = extra.place || parish?.name || '';
  return `
  <div class="cert portrait">
    <img class="frame" src="${frame}" alt="">
    <div class="content" style="top:6.5%;left:12.5%;right:12.5%;bottom:5%">
      <div class="org">${esc(parish?.diocese || '')}<br>${esc(parish?.name ? 'Giáo xứ ' + parish.name.replace(/^Giáo xứ\s*/i, '') : '')}</div>
      <div class="title2">CHỨNG CHỈ<br>RỬA TỘI VÀ THÊM SỨC</div>
      <div class="rows">
        ${row('Tên thánh, họ và tên:', fullName(s))}
        ${row('Sinh ngày:', dmy(s?.birth_date))}
        ${row('Tại:', extra.birth_place || s?.birth_place)}
        ${row('Con ông:', parentName(s?.father_saint, s?.father_name))}
        ${row('Và bà:', parentName(s?.mother_saint, s?.mother_name))}
        ${row('Nguyên quán:', extra.origin_place || s?.origin_place)}
        ${row('Trú quán:', extra.residence || s?.residence)}
        ${row('Đã được Rửa Tội ngày:', dmy(s?.baptism_date))}
        ${row('Tại Nhà thờ:', extra.baptism_church || s?.baptism_church)}
        ${row('Trích sổ Rửa Tội, số:', extra.baptism_book_no || s?.baptism_book_no)}
        ${row('Do Linh mục:', extra.baptism_priest || s?.baptism_priest)}
        ${row('Tên thánh:', s?.saint_name)}
        ${row('Người đỡ đầu:', s?.godparent_name)}
      </div>
      <div class="divider">❖</div>
      <div class="rows">
        ${row('Đã được Thêm Sức ngày:', dmy(s?.confirmation_date))}
        ${row('Tại Nhà thờ:', extra.confirmation_church || s?.confirmation_church)}
        ${row('Do Đức Giám mục:', extra.confirmation_bishop || s?.confirmation_bishop)}
        ${row('Người đỡ đầu:', extra.confirmation_godparent || s?.confirmation_godparent)}
        ${row('Trích sổ Thêm Sức, số:', extra.confirmation_book_no || s?.confirmation_book_no)}
      </div>
      <div class="sign">
        <div>${esc(place)}, ${dmyLong(extra.issue_date)}</div>
        <div>Linh mục Quản xứ</div>
        ${parish?.priest_signature ? `<img class="sig" src="${parish.priest_signature}">` : '<div class="sig-gap"></div>'}
        <div class="pr-name">${esc(parish?.priest_name || '')}</div>
      </div>
    </div>
  </div>`;
}

// ---------- Giáo Lý Hôn Nhân (khổ ngang) ----------
function marriageHtml({ parish, student: s, extra = {}, frame }) {
  const place = extra.place || parish?.name || '';
  const gx = parish?.name ? 'Giáo xứ ' + parish.name.replace(/^Giáo xứ\s*/i, '') : '';
  return `
  <div class="cert landscape">
    <img class="frame" src="${frame}" alt="">
    <div class="m-org">${esc(parish?.diocese || '')}<br>${esc(gx)}</div>
    <div class="m-quote"><i>${esc(extra.quote || '“Sự gì Thiên Chúa kết hợp, loài người không được phân ly”')}</i><br><b>(Mc 10,9)</b></div>
    <div class="content" style="top:24%;left:9%;right:9%;bottom:6%;align-items:center;text-align:center">
      <div class="title2 m-title">CHỨNG CHỈ GIÁO LÝ HÔN NHÂN</div>
      <div class="m-cert"><b>${esc(extra.certify_line || ('Linh mục ' + gx + ' chứng nhận'))}</b></div>
      <div class="m-name">${esc(extra.role || 'Anh')}: ${esc(fullName(s))}</div>
      <div class="m-line">Sinh ngày: ${esc(dmy(s?.birth_date))}</div>
      <div class="m-parents"><span>Con Ông: ${esc(parentName(s?.father_saint, s?.father_name))}</span><span>Và Bà: ${esc(parentName(s?.mother_saint, s?.mother_name))}</span></div>
      <div class="m-line">Đã hoàn thành chương trình giáo lý hôn nhân</div>
      <div class="m-sign">
        <div>${esc(place)}, ${dmyLong(extra.issue_date)}</div>
        <div>Linh mục quản xứ</div>
        ${parish?.priest_signature ? `<img class="sig" src="${parish.priest_signature}">` : '<div class="sig-gap"></div>'}
        <div>${esc(parish?.priest_name || '')}</div>
      </div>
    </div>
  </div>`;
}

// ---------- Huynh Trưởng (khổ ngang) ----------
function scoutHtml({ parish, student: s, extra = {}, frame }) {
  const place = extra.place || parish?.name || '';
  const org2 = extra.org2 || 'Ban Giáo lý & Mục vụ Thiếu nhi';
  return `
  <div class="cert landscape">
    <img class="frame" src="${frame}" alt="">
    <div class="s-org">${esc(parish?.diocese || '')}<br>${esc(org2)}</div>
    <div class="content" style="top:15.5%;left:11%;right:11%;bottom:6%;align-items:center;text-align:center">
      <div class="title2 s-title">CHỨNG CHỈ HUYNH TRƯỞNG</div>
      <div class="s-sub">Chiếu theo kết quả Sa Mạc Huấn Luyện Huynh Trưởng</div>
      <div class="s-org2">${esc(org2 + (parish?.diocese ? ' – ' + parish.diocese : ''))}</div>
      <div class="s-cn">CHỨNG NHẬN</div>
      <div class="s-name">${esc(fullName(s))}</div>
      <div class="s-fields"><span>Sinh ngày: <b>${esc(dmy(s?.birth_date))}</b></span><span>Giáo họ: <b>${esc(extra.giao_ho || '')}</b></span><span>Giáo xứ: <b>${esc(parish?.name || '')}</b></span></div>
      <div class="s-line">Đã hoàn thành Sa mạc Huấn luyện Huynh Trưởng cấp ${esc(extra.level || 'I')} tại ${esc(extra.samac || '……………')}, khai mạc ${extra.open_date ? dmyLong(extra.open_date) : 'ngày ……………'}</div>
      <div class="s-line">Xin Thiên Chúa chúc lành và ban muôn ơn cần thiết cho Trưởng và Gia đình.</div>
      <div class="s-bottom">
        <div class="s-sono">Vào sổ số: <b>${esc(extra.sono || '')}</b></div>
        <div class="s-sign">
          <div>${esc(place)}, ${dmyLong(extra.issue_date)}</div>
          <div>${esc(org2)}</div><div>Trưởng Ban</div>
          ${parish?.priest_signature ? `<img class="sig" src="${parish.priest_signature}">` : '<div class="sig-gap"></div>'}
          <div>${esc(parish?.priest_name || '')}</div>
        </div>
      </div>
    </div>
  </div>`;
}

const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%}
.cert{position:relative;width:100%;overflow:hidden;font-family:'Fahkwang',serif;color:#1a1a1a;container-type:size}
.cert.portrait{aspect-ratio:2475/3500}
.cert.landscape{aspect-ratio:4000/2828}
.frame{position:absolute;inset:0;width:100%;height:100%;display:block}
.content{position:absolute;display:flex;flex-direction:column}
.org{font-weight:700;font-size:1.75cqw;line-height:1.3;text-transform:uppercase}
.title2{font-family:'PlayfairSC',serif;font-weight:700;color:#c00000;text-align:center;font-size:3.7cqw;line-height:1.15;margin:1.8cqw 0 2cqw}
.rows{display:flex;flex-direction:column;gap:.6cqw}
.r{font-size:1.95cqw;line-height:1.35}
.r b{font-weight:700}
.divider{text-align:center;color:#b4813c;font-size:2.4cqw;margin:1.4cqw 0}
.sign{margin-top:2.2cqw;text-align:right;font-size:1.95cqw;line-height:1.5}
.sign .sig{height:8cqw;margin:.4cqw 0 0 auto;display:block}
.sign .sig-gap{height:7cqw}
.sign .pr-name{font-weight:400}
/* Hôn nhân */
.m-org{position:absolute;top:6%;left:9%;font-weight:700;font-size:1.7cqw;line-height:1.3;text-transform:uppercase;z-index:2}
.m-quote{position:absolute;top:6%;right:9%;text-align:right;font-weight:700;font-size:1.55cqw;line-height:1.35;max-width:32%;z-index:2}
.m-title{font-size:4.2cqw;margin:0 0 1.4cqw}
.m-cert{font-size:2.15cqw;margin-bottom:1.4cqw}
.m-name{font-family:'PlayfairSC',serif;font-size:3.3cqw;margin-bottom:.8cqw}
.m-line{font-size:2cqw;margin:.5cqw 0}
.m-parents{display:flex;justify-content:space-between;width:88%;font-size:2.2cqw;font-family:'PlayfairSC',serif;margin:1cqw 0}
.m-sign{margin-top:auto;align-self:flex-end;text-align:right;font-size:1.9cqw;line-height:1.5}
.m-sign .sig{height:7cqw;margin:.3cqw 0 0 auto;display:block}
/* Huynh trưởng */
.s-org{position:absolute;top:8%;left:9%;font-weight:700;font-size:1.5cqw;line-height:1.3;text-transform:uppercase;max-width:34%;z-index:2}
.s-title{color:#c00000;font-size:3.6cqw;margin:0}
.s-sub{color:#c00000;font-weight:700;font-size:1.7cqw;margin:.3cqw 0 .9cqw}
.s-org2{font-weight:700;font-size:2cqw;text-transform:uppercase}
.s-cn{color:#c00000;font-weight:700;font-family:'PlayfairSC',serif;font-size:2.4cqw;margin:.7cqw 0}
.s-name{font-family:'PlayfairSC',serif;font-size:2.9cqw;border-bottom:1px dotted #999;min-width:58%;padding:0 4cqw .4cqw;margin-bottom:1.2cqw}
.s-fields{display:flex;justify-content:space-between;width:82%;font-size:1.8cqw;margin-bottom:.8cqw}
.s-line{font-weight:700;font-size:1.85cqw;line-height:1.55}
.s-bottom{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:1.8cqw}
.s-sono{font-weight:700}
.s-sign{text-align:right;line-height:1.5}
.s-sign .sig{height:6cqw;margin:.3cqw 0 0 auto;display:block}
`;

const TEMPLATES = {
  baptism: { render: baptismHtml, frame: '/certs/frame-baptism-1.png', orient: 'portrait', label: 'Rửa Tội & Thêm Sức (mẫu 1)' },
  baptism2: { render: baptismHtml, frame: '/certs/frame-baptism-2.png', orient: 'portrait', label: 'Rửa Tội & Thêm Sức (mẫu 2)' },
  marriage: { render: marriageHtml, frame: '/certs/frame-marriage.png', orient: 'landscape', label: 'Giáo Lý Hôn Nhân' },
  scout: { render: scoutHtml, frame: '/certs/frame-scout.png', orient: 'landscape', label: 'Huynh Trưởng' },
};

function pageHtml(inner, orient) {
  const size = orient === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<style>${FONT_CSS}${STYLE}
@page{size:${size};margin:0}
@media print{.cert{page-break-after:always}}
body{background:#f0f0f0}
</style></head><body>${inner}</body></html>`;
}

// Kết xuất HTML cho 1 chứng chỉ (để xem trước hoặc in)
export function certPageHtml({ template = 'baptism', parish, students = [], extra = {} }) {
  const t = TEMPLATES[template] || TEMPLATES.baptism;
  const list = students.length ? students : [{}];
  const inner = list.map((s) => t.render({ parish, student: s, extra, frame: t.frame })).join('');
  return pageHtml(inner, t.orient);
}

// In ra PDF qua iframe ẩn (trình duyệt render tiếng Việt + font chuẩn)
export function printCert(opts) {
  const html = certPageHtml(opts);
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win.document; doc.open(); doc.write(html); doc.close();
  let done = false;
  const go = () => {
    if (done) return; done = true;
    win.focus(); win.print(); setTimeout(() => document.body.removeChild(iframe), 1500);
  };
  // ĐỢI cả font VÀ ảnh frame tải xong mới in (frame nặng, nếu in sớm sẽ mất khung).
  const imgs = [...doc.images];
  const imgReady = Promise.all(imgs.map((img) => (img.complete && img.naturalWidth) ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })));
  const fontsReady = doc.fonts?.ready || Promise.resolve();
  Promise.all([imgReady, fontsReady]).then(() => setTimeout(go, 250));
  setTimeout(go, 8000); // phòng hờ nếu có ảnh không tải được
}

export { TEMPLATES };
