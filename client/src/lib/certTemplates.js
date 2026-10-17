// Bộ chứng chỉ có thiết kế: dùng ảnh frame làm nền + vùng nội dung căn trong viền,
// nhúng font (Playfair Display SC cho tiêu đề, Fahkwang cho thân), in ra PDF qua iframe.
// Tất cả kích thước theo % của khung (cqw) để độc lập độ phân giải khi in A4.
// Dòng có class "fit" không xuống dòng: chữ dài quá thì tự co (biến --k) cho vừa,
// nên tên/địa chỉ dài không tràn viền và người dùng không phải căn tay.

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
const gxName = (parish) => (parish?.name ? 'Giáo xứ ' + parish.name.replace(/^Giáo xứ\s*/i, '') : '');
// dòng "nhãn: giá trị (đậm)", tự co nếu dài
const row = (label, value) => `<div class="r fit"><span class="lb">${esc(label)}</span> <b>${esc(value || '')}</b></div>`;
// Dòng "Nơi cấp, ngày ...": nơi cấp dài thì tách 2 dòng để chữ không bị co quá nhỏ
const placeDate = (parish, extra) => {
  const place = extra.place || parish?.name || '';
  return place.length > 18
    ? `<div class="fit">${esc(place)},</div><div class="fit">${dmyLong(extra.issue_date)}</div>`
    : `<div class="fit">${esc(place)}, ${dmyLong(extra.issue_date)}</div>`;
};
const signHtml = (parish, extra, role, cls = 'sign') => `
      <div class="${cls}">
        ${placeDate(parish, extra)}
        <div class="fit">${esc(role)}</div>
        ${parish?.priest_signature ? `<img class="sig" src="${parish.priest_signature}">` : '<div class="sig-gap"></div>'}
        <div class="fit pr-name">${esc(parish?.priest_name || '')}</div>
      </div>`;

// "Vùng nội dung" = ô trống bên trong khung. inset {top,right,bottom,left} theo % của
// tờ; inset 0 = phủ toàn tờ. Khung viền dày -> tăng inset để cả nội dung co vào ô trống.
const DEFAULT_INSET = { top: 0, right: 0, bottom: 0, left: 0 };
const areaStyle = (ins) => { const i = { ...DEFAULT_INSET, ...(ins || {}) }; return `top:${i.top}%;left:${i.left}%;right:${i.right}%;bottom:${i.bottom}%`; };

// ---------- Rửa Tội (+ Thêm Sức nếu em đã nhận) (khổ dọc) ----------
function baptismHtml({ parish, student: s, extra = {}, frame, inset }) {
  const v = (k) => extra[k] || s?.[k];
  const hasConf = ['confirmation_date', 'confirmation_church', 'confirmation_bishop', 'confirmation_book_no'].some((k) => v(k));
  return `
  <div class="cert portrait">
    <img class="frame" src="${frame}" alt="">
    <div class="area" style="${areaStyle(inset)}">
    <div class="content p-content${hasConf ? '' : ' roomy'}">
      <div class="org fit">${esc(parish?.diocese || '')}<br>${esc(gxName(parish))}</div>
      <div class="title2">CHỨNG CHỈ<br>${hasConf ? 'RỬA TỘI VÀ THÊM SỨC' : 'RỬA TỘI'}</div>
      <div class="p-body">
        <div class="rows">
          ${row('Tên Thánh:', s?.saint_name)}
          ${row('Họ và tên:', s?.full_name)}
          ${row('Sinh ngày:', dmy(s?.birth_date))}
          ${row('Tại:', v('birth_place'))}
          ${row('Con ông:', parentName(s?.father_saint, s?.father_name))}
          ${row('Và bà:', parentName(s?.mother_saint, s?.mother_name))}
          ${row('Nguyên quán:', v('origin_place'))}
          ${row('Trú quán:', v('residence'))}
        </div>
        <div class="divider">❖</div>
        <div class="rows">
          ${row('Đã được Rửa Tội ngày:', dmy(v('baptism_date')))}
          ${row('Tại Nhà thờ:', v('baptism_church'))}
          ${row('Do Linh mục:', v('baptism_priest'))}
          ${row('Người đỡ đầu:', s?.godparent_name)}
          ${row('Trích sổ Rửa Tội, số:', v('baptism_book_no'))}
        </div>
        ${hasConf ? `<div class="divider">❖</div>
        <div class="rows">
          ${row('Đã được Thêm Sức ngày:', dmy(v('confirmation_date')))}
          ${row('Tại Nhà thờ:', v('confirmation_church'))}
          ${row('Do Đức Giám mục:', v('confirmation_bishop'))}
          ${row('Người đỡ đầu:', v('confirmation_godparent'))}
          ${row('Trích sổ Thêm Sức, số:', v('confirmation_book_no'))}
        </div>` : ''}
      </div>
      ${signHtml(parish, extra, 'Linh mục Quản xứ')}
    </div>
    </div>
  </div>`;
}

// ---------- Rước Lễ lần đầu (khổ dọc, cùng phong cách Rửa Tội) ----------
function firstCommunionHtml({ parish, student: s, extra = {}, frame, inset }) {
  const v = (k) => extra[k] || s?.[k];
  return `
  <div class="cert portrait">
    <img class="frame" src="${frame}" alt="">
    <div class="area" style="${areaStyle(inset)}">
    <div class="content p-content roomy">
      <div class="org fit">${esc(parish?.diocese || '')}<br>${esc(gxName(parish))}</div>
      <div class="title2">CHỨNG NHẬN<br>RƯỚC LỄ LẦN ĐẦU</div>
      <div class="p-quote"><i>“Ai ăn thịt và uống máu tôi thì được sống muôn đời”</i> <b>(Ga 6,54)</b></div>
      <div class="p-body">
        <div class="rows">
          ${row('Tên Thánh:', s?.saint_name)}
          ${row('Họ và tên:', s?.full_name)}
          ${row('Sinh ngày:', dmy(s?.birth_date))}
          ${row('Tại:', v('birth_place'))}
          ${row('Con ông:', parentName(s?.father_saint, s?.father_name))}
          ${row('Và bà:', parentName(s?.mother_saint, s?.mother_name))}
          ${row('Đã được Rửa Tội ngày:', dmy(v('baptism_date')))}
          ${row('Tại Nhà thờ:', v('baptism_church'))}
        </div>
        <div class="divider">❖</div>
        <div class="rows">
          ${row('Đã Rước Lễ lần đầu ngày:', dmy(v('first_communion_date')))}
          ${row('Tại Nhà thờ:', extra.communion_church || (parish?.name ? 'Nhà thờ ' + gxName(parish) : ''))}
          ${row('Do Linh mục:', extra.communion_priest || parish?.priest_name)}
        </div>
      </div>
      ${signHtml(parish, extra, 'Linh mục Quản xứ')}
    </div>
    </div>
  </div>`;
}

// ---------- Giáo Lý Hôn Nhân (khổ ngang) ----------
function marriageHtml({ parish, student: s, extra = {}, frame, inset }) {
  const gx = gxName(parish);
  return `
  <div class="cert landscape">
    <img class="frame" src="${frame}" alt="">
    <div class="area" style="${areaStyle(inset)}">
    <div class="m-org fit">${esc(parish?.diocese || '')}<br>${esc(gx)}</div>
    <div class="m-quote"><i>${esc(extra.quote || '“Sự gì Thiên Chúa kết hợp, loài người không được phân ly”')}</i><br><b>(Mc 10,9)</b></div>
    <div class="content" style="top:22%;left:9%;right:9%;bottom:9%;align-items:center;text-align:center">
      <div class="title2 m-title">CHỨNG CHỈ GIÁO LÝ HÔN NHÂN</div>
      <div class="m-cert fit"><b>${esc(extra.certify_line || ('Linh mục ' + gx + ' chứng nhận'))}</b></div>
      <div class="m-name fit">${esc(s?._role || extra.role || 'Anh')}: ${esc(fullName(s))}</div>
      <div class="m-line fit">Sinh ngày: ${esc(dmy(s?.birth_date))}</div>
      <div class="m-parents fit"><span>Con Ông: ${esc(parentName(s?.father_saint, s?.father_name))}</span><span>Và Bà: ${esc(parentName(s?.mother_saint, s?.mother_name))}</span></div>
      <div class="m-line fit">Đã hoàn thành chương trình giáo lý hôn nhân</div>
      ${signHtml(parish, extra, 'Linh mục quản xứ', 'm-sign')}
    </div>
    </div>
  </div>`;
}

// ---------- Huynh Trưởng (khổ ngang) ----------
function scoutHtml({ parish, student: s, extra = {}, frame, inset }) {
  const org2 = extra.org2 || 'Ban Giáo lý & Mục vụ Thiếu nhi';
  const sono = s?._sono ?? extra.sono ?? '';
  const giaoHo = s?._giao_ho ?? extra.giao_ho ?? '';
  return `
  <div class="cert landscape">
    <img class="frame" src="${frame}" alt="">
    <div class="area" style="${areaStyle(inset)}">
    <div class="s-org fit">${esc(parish?.diocese || '')}<br>${esc(org2)}</div>
    <div class="content" style="top:21%;left:8%;right:8%;bottom:5%;align-items:center;text-align:center">
      <div class="title2 s-title">CHỨNG CHỈ HUYNH TRƯỞNG</div>
      <div class="s-sub fit">Chiếu theo kết quả Sa Mạc Huấn Luyện Huynh Trưởng</div>
      <div class="s-org2 fit">${esc(org2 + (parish?.diocese ? ' - ' + parish.diocese : ''))}</div>
      <div class="s-cn">CHỨNG NHẬN</div>
      <div class="s-name fit">${esc(fullName(s))}</div>
      <div class="s-fields fit"><span>Sinh ngày: <b>${esc(dmy(s?.birth_date))}</b></span>${giaoHo ? `<span>Giáo họ: <b>${esc(giaoHo)}</b></span>` : ''}<span>Giáo xứ: <b>${esc((parish?.name || '').replace(/^Giáo xứ\s*/i, ''))}</b></span></div>
      <div class="s-line">Đã hoàn thành Sa mạc Huấn luyện Huynh Trưởng cấp ${esc(extra.level || 'I')}${extra.samac ? ` tại ${esc(extra.samac)}` : ''}${extra.open_date ? `, khai mạc ${dmyLong(extra.open_date)}` : ''}</div>
      <div class="s-line">Xin Thiên Chúa chúc lành và ban muôn ơn cần thiết cho Trưởng và Gia đình.</div>
      <div class="s-bottom">
        <div class="s-sono">${sono ? `Vào sổ số: <b>${esc(sono)}</b>` : ''}</div>
        <div class="s-sign">
          ${placeDate(parish, extra)}
          <div class="fit">${esc(org2)}</div><div class="fit">Trưởng Ban</div>
          ${parish?.priest_signature ? `<img class="sig" src="${parish.priest_signature}">` : '<div class="sig-gap"></div>'}
          <div class="fit">${esc(parish?.priest_name || '')}</div>
        </div>
      </div>
    </div>
    </div>
  </div>`;
}

// ---------- Giấy khen (khổ ngang) ----------
function meritHtml({ parish, student: s, extra = {}, frame, inset }) {
  const nameUp = (parish?.name || '').replace(/^Giáo xứ\s*/i, '').toUpperCase();
  const rank = s?._rank ?? extra.rank ?? ''; // vị thứ riêng từng em; trống thì không in dòng này
  return `
  <div class="cert landscape">
    <img class="frame" src="${frame}" alt="">
    <div class="area" style="${areaStyle(inset)}">
    <div class="k-org fit">${esc((parish?.diocese || '').toUpperCase())}${parish?.name ? '<br>GIÁO XỨ ' + esc(nameUp) : ''}</div>
    <div class="k-quote"><i>${esc(extra.quote || '“Lời Chúa là ngọn đèn soi cho con bước, là Ánh Sáng dẫn đường con đi”')}</i><br><b>(Tv 119, 105)</b></div>
    <div class="content" style="top:26%;left:8%;right:8%;bottom:6%;align-items:center;text-align:center">
      <div class="k-title fit">${esc(extra.merit_title || 'GIẤY KHEN')}</div>
      <div class="k-sub fit">LINH MỤC QUẢN XỨ ${esc(nameUp)}</div>
      <div class="k-sub2">TẶNG KHEN GIÁO LÝ SINH</div>
      <div class="k-name fit">${esc(fullName(s))}</div>
      <div class="k-fields fit"><span><span class="k-lb">LỚP:</span> <b>${esc(extra.class_name || '')}</b></span>${rank ? `<span><span class="k-lb">VỊ THỨ:</span> <b>${esc(rank)}</b></span>` : ''}</div>
      <div class="k-reason">${esc((extra.merit_reason || 'Đã chuyên chăm học giáo lý và siêng năng tham dự Thánh Lễ').toUpperCase())}</div>
      ${extra.year ? `<div class="k-year">NĂM HỌC: ${esc(extra.year)}</div>` : ''}
      ${signHtml(parish, extra, 'Linh mục quản xứ', 'k-sign')}
    </div>
    </div>
  </div>`;
}

// Cỡ chữ = cqw * --k (mặc định 1); script co --k riêng từng dòng .fit khi tràn.
const fs = (n) => `font-size:calc(${n}cqw * var(--k,1))`;
const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%}
.cert{position:relative;width:100%;overflow:hidden;font-family:'Fahkwang',serif;color:#1a1a1a}
.cert.portrait{aspect-ratio:2475/3500}
.cert.landscape{aspect-ratio:4000/2828}
.frame{position:absolute;inset:0;width:100%;height:100%;display:block}
.area{position:absolute;container-type:size}
.content{position:absolute;display:flex;flex-direction:column}
.fit{white-space:nowrap;align-self:stretch}
/* dòng .fit trong khối chữ ký không tự khai cỡ chữ: co theo cỡ của khối */
.sign .fit,.m-sign .fit,.k-sign .fit,.s-sign .fit{font-size:calc(1em * var(--k,1))}
.sig{display:block}
/* Rửa Tội / Rước Lễ (dọc) */
.p-content{top:6.5%;left:12.5%;right:12.5%;bottom:5.5%}
.org{font-weight:700;${fs(1.85)};line-height:1.35;text-transform:uppercase}
.title2{font-family:'PlayfairSC',serif;font-weight:700;color:#c00000;text-align:center;font-size:4.3cqw;line-height:1.15;margin:2.4cqw 0 1.2cqw}
.p-quote{text-align:center;${fs(1.85)};color:#7a5a1e;margin-bottom:.6cqw}
.p-body{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
.rows{display:flex;flex-direction:column;gap:.95cqw}
.r{${fs(2.25)};line-height:1.35}
.roomy .rows{gap:1.6cqw}
.roomy .r{${fs(2.6)}}
.roomy .divider{margin:2.4cqw 0}
.r .lb{color:#333}
.r b{font-weight:700}
.divider{text-align:center;color:#b4813c;font-size:2.6cqw;margin:1.6cqw 0}
.sign{align-self:flex-end;max-width:72%;text-align:center;${fs(2.15)};line-height:1.5;margin-top:1cqw}
.sign .sig{height:8cqw;margin:.4cqw auto 0}
.sign .sig-gap{height:8cqw}
/* Hôn nhân */
.m-org{position:absolute;top:7%;left:9.5%;max-width:33%;font-weight:700;${fs(1.7)};line-height:1.35;text-transform:uppercase;z-index:2}
.m-quote{position:absolute;top:7%;right:9.5%;text-align:right;font-weight:700;font-size:1.55cqw;line-height:1.4;max-width:31%;z-index:2}
.m-title{font-size:4.3cqw;margin:0 0 1.6cqw}
.m-cert{${fs(2.25)};margin-bottom:1.6cqw}
.m-name{font-family:'PlayfairSC',serif;${fs(3.4)};margin-bottom:.9cqw}
.m-line{${fs(2.1)};margin:.6cqw 0}
.m-parents{display:flex;justify-content:space-between;gap:4cqw;width:92%;align-self:center;${fs(2)};font-family:'PlayfairSC',serif;margin:1.3cqw 0}
.m-sign{margin-top:auto;align-self:flex-end;max-width:55%;text-align:center;${fs(1.9)};line-height:1.5}
.m-sign .sig{height:5.5cqw;margin:.3cqw auto 0}
.m-sign .sig-gap{height:5.5cqw}
/* Huynh trưởng */
.s-org{position:absolute;top:11.5%;left:10.5%;font-weight:700;${fs(1.5)};line-height:1.3;text-transform:uppercase;max-width:30%;z-index:2}
.s-title{color:#c00000;font-size:3.6cqw;margin:0}
.s-sub{color:#c00000;font-weight:700;${fs(1.7)};margin:.3cqw 0 .9cqw}
.s-org2{font-weight:700;${fs(2)};text-transform:uppercase}
.s-cn{color:#c00000;font-weight:700;font-family:'PlayfairSC',serif;font-size:2.4cqw;margin:.7cqw 0}
.s-name{font-family:'PlayfairSC',serif;${fs(2.9)};border-bottom:1px dotted #999;width:70%;align-self:center;padding-bottom:.4cqw;margin-bottom:1.2cqw}
.s-fields{display:flex;justify-content:center;gap:5cqw;width:86%;align-self:center;${fs(1.8)};margin-bottom:.8cqw}
.s-line{font-weight:700;font-size:1.85cqw;line-height:1.55}
.s-bottom{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:1.8cqw}
.s-sono{font-weight:700;padding-left:5cqw}
.s-sign{text-align:center;line-height:1.5;max-width:50%;${fs(1.8)}}
.s-sign .sig{height:6cqw;margin:.3cqw auto 0}
.s-sign .sig-gap{height:6cqw}
/* Giấy khen */
.k-org{position:absolute;top:11%;left:7.5%;font-weight:700;${fs(1.65)};line-height:1.4;z-index:2;max-width:30%}
.k-quote{position:absolute;top:11%;right:9%;text-align:right;font-style:italic;font-size:1.45cqw;line-height:1.4;max-width:27%;z-index:2}
.k-title{font-family:'Fahkwang',sans-serif;font-weight:700;color:#c00000;${fs(4)};line-height:1.1;letter-spacing:.3cqw;margin-bottom:.5cqw}
.k-sub{color:#1b3fae;font-weight:700;${fs(2.5)};line-height:1.2}
.k-sub2{color:#1b3fae;font-weight:700;font-size:2.05cqw;margin-bottom:1cqw}
.k-name{font-family:'PlayfairSC',serif;font-weight:700;${fs(3.5)};margin:.3cqw 0 1.1cqw}
.k-fields{display:flex;justify-content:center;gap:6cqw;${fs(2.1)};margin-bottom:1cqw}
.k-lb{color:#1b3fae;font-weight:700}
.k-reason{color:#c00000;font-weight:700;font-size:2.05cqw;line-height:1.35;max-width:86%}
.k-year{color:#c00000;font-weight:700;font-size:2.05cqw;margin-top:.4cqw}
.k-sign{margin-top:auto;align-self:flex-end;max-width:55%;text-align:center;${fs(1.9)};line-height:1.5}
.k-sign .sig{height:6.5cqw;margin:.3cqw auto 0}
.k-sign .sig-gap{height:6cqw}
`;

// Co chữ các dòng .fit cho vừa bề ngang: chữ dài thì giảm --k theo tỉ lệ (tối thiểu 55%).
// Tỉ lệ không phụ thuộc khổ hiển thị nên xem trước và bản in giống nhau.
const FIT_JS = `
(function(){
  function fit(){
    document.querySelectorAll('.fit').forEach(function(el){
      el.style.removeProperty('--k');
      var w=el.clientWidth, s=el.scrollWidth;
      if(w>0 && s>w+1) el.style.setProperty('--k', Math.max(0.55, w/s*0.98).toFixed(3));
    });
  }
  window.__certFit=fit;
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('load', fit);
  window.addEventListener('beforeprint', fit);
})();`;

// Loại chứng chỉ (cách render), độc lập với KHUNG (ảnh nền có thể chọn/tùy chỉnh).
const RENDERERS = {
  baptism: { render: baptismHtml, orient: 'portrait' },
  first_communion: { render: firstCommunionHtml, orient: 'portrait' },
  marriage: { render: marriageHtml, orient: 'landscape' },
  scout: { render: scoutHtml, orient: 'landscape' },
  merit: { render: meritHtml, orient: 'landscape' },
};
// Khung dựng sẵn theo loại (user chọn; admin có thể thêm khung tùy chỉnh).
// inset = lề mặc định (% tờ) để nội dung không đè hoa văn; giáo xứ lưu lề riêng thì dùng lề đã lưu.
const PORTRAIT_FRAMES = [
  { id: 'bt1', name: 'Cổ điển (viền lá)', url: '/certs/frame-baptism-1.png' },
  { id: 'bt2', name: 'Hoa văn góc', url: '/certs/frame-baptism-2.png' },
];
export const BUILTIN_FRAMES = {
  baptism: PORTRAIT_FRAMES,
  first_communion: PORTRAIT_FRAMES,
  marriage: [{ id: 'mr1', name: 'Chuẩn', url: '/certs/frame-marriage.png', inset: { top: 2.5, right: 2.5, bottom: 2, left: 2.5 } }],
  scout: [{ id: 'sc1', name: 'Chuẩn', url: '/certs/frame-scout.png', inset: { top: 6, right: 5, bottom: 7, left: 5 } }],
  merit: [{ id: 'mrt1', name: 'Chuẩn', url: '/certs/frame-merit.jpg', inset: { top: 6, right: 5, bottom: 7, left: 5 } }],
};
export const CERT_ORIENT = { baptism: 'portrait', first_communion: 'portrait', marriage: 'landscape', scout: 'landscape', merit: 'landscape' };

function pageHtml(inner, orient) {
  const size = orient === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<style>${FONT_CSS}${STYLE}
@page{size:${size};margin:0}
@media print{.cert{page-break-after:always}}
body{background:#f0f0f0}
</style></head><body>${inner}<script>${FIT_JS}</script></body></html>`;
}

// Kết xuất HTML cho 1 chứng chỉ (type = loại render, frame = URL khung được chọn)
export function certPageHtml({ type = 'baptism', frame, inset, parish, students = [], extra = {} }) {
  const r = RENDERERS[type] || RENDERERS.baptism;
  const fr = frame || BUILTIN_FRAMES[type]?.[0]?.url;
  const list = students.length ? students : [{}];
  const inner = list.map((s) => r.render({ parish, student: s, extra, frame: fr, inset })).join('');
  return pageHtml(inner, r.orient);
}

// Lề hiệu lực của khung: lề giáo xứ đã lưu > lề mặc định của khung dựng sẵn
export function frameInset(frame, parish) {
  if (!frame) return {};
  return (frame.builtin === false ? frame.inset : (parish?.settings?.cert_insets?.[frame.id] || frame.inset)) || {};
}

// In ra PDF qua iframe ẩn (trình duyệt render tiếng Việt + font chuẩn).
// Iframe có kích thước thật (đặt ngoài màn hình) để bước co chữ đo được.
// Trả về Promise xong khi hộp thoại in đóng (Chrome/Edge chặn ở print(); Safari iOS trả về ngay).
export function printCert(opts) {
  return new Promise((resolve) => {
    const html = certPageHtml(opts);
    const land = CERT_ORIENT[opts.type] === 'landscape';
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', left: '-20000px', top: '0', width: land ? '1123px' : '794px', height: land ? '794px' : '1123px', border: '0', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win.document; doc.open(); doc.write(html); doc.close();
    let done = false;
    const go = () => {
      if (done) return; done = true;
      try { win.__certFit?.(); } catch { /* noop */ }
      win.focus(); win.print(); resolve();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    };
    // ĐỢI cả font VÀ ảnh frame tải xong mới in (frame nặng, nếu in sớm sẽ mất khung).
    const imgs = [...doc.images];
    const imgReady = Promise.all(imgs.map((img) => (img.complete && img.naturalWidth) ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })));
    const fontsReady = doc.fonts?.ready || Promise.resolve();
    Promise.all([imgReady, fontsReady]).then(() => setTimeout(go, 250));
    setTimeout(go, 8000); // phòng hờ nếu có ảnh không tải được
  });
}
