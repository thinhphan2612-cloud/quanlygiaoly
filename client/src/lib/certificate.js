// Xuất chứng chỉ bí tích (Rửa tội / Rước lễ / Thêm Sức) ra PDF bằng cách in
// (trình duyệt render tiếng Việt hoàn hảo, người dùng chọn "Lưu thành PDF").
// Mẫu tạm do Claude thiết kế — sẽ thay bằng mẫu chuẩn của giáo xứ sau.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dashDate = (d) => (d ? d.split('-').reverse().join(' / ') : '…… / …… / ………');

const KINDS = {
  baptism: { title: 'CHỨNG CHỈ RỬA TỘI', latin: 'Sacramentum Baptismi', verb: 'đã lãnh nhận Bí tích <b>Rửa Tội</b>', dateKey: 'baptism_date', showGodparent: true },
  ruoc_le: { title: 'CHỨNG NHẬN RƯỚC LỄ LẦN ĐẦU', latin: 'Prima Communio', verb: 'đã lãnh nhận Bí tích <b>Thánh Thể</b> (Rước Lễ lần đầu)', dateKey: 'first_communion_date', showGodparent: false },
  them_suc: { title: 'CHỨNG CHỈ THÊM SỨC', latin: 'Sacramentum Confirmationis', verb: 'đã lãnh nhận Bí tích <b>Thêm Sức</b>', dateKey: 'confirmation_date', showGodparent: true },
};

export function exportCertificate({ parish, student, kind }) {
  const K = KINDS[kind];
  if (!K) return;
  const fullName = ((student.saint_name ? student.saint_name + ' ' : '') + (student.full_name || '')).trim();
  const father = [student.father_saint, student.father_name].filter(Boolean).join(' ') || student.parent_name || '………………………';
  const mother = [student.mother_saint, student.mother_name].filter(Boolean).join(' ') || '………………………';
  const parishName = parish?.name || '……………………………';
  const diocese = parish?.diocese || '';
  const logo = parish?.logo_url ? `<img class="logo" src="${parish.logo_url}" alt="logo" />` : '<div class="logo cross">✝</div>';
  const today = new Date();
  const place = parishName;

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(K.title)} - ${esc(fullName)}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; }
    .sheet { width: 297mm; height: 210mm; padding: 12mm; }
    .frame { width: 100%; height: 100%; border: 3px double #8a6d3b; border-radius: 6px; padding: 10mm 16mm; position: relative; display: flex; flex-direction: column; align-items: center; }
    .frame::before { content: ''; position: absolute; inset: 4mm; border: 1px solid #c9b58b; border-radius: 4px; pointer-events: none; }
    .head { text-align: center; }
    .logo { width: 60px; height: 60px; object-fit: contain; margin: 0 auto 6px; display: block; }
    .logo.cross { font-size: 44px; color: #8a6d3b; line-height: 60px; }
    .diocese { font-size: 15px; letter-spacing: 1px; text-transform: uppercase; color: #444; }
    .parish { font-size: 20px; font-weight: 700; margin-top: 2px; }
    .title { margin: 14px 0 2px; font-size: 34px; font-weight: 700; letter-spacing: 2px; color: #7a1f1f; text-transform: uppercase; }
    .latin { font-style: italic; color: #8a6d3b; font-size: 14px; margin-bottom: 12px; }
    .body { font-size: 17px; line-height: 2.1; text-align: center; max-width: 210mm; }
    .name { font-size: 26px; font-weight: 700; letter-spacing: 1px; margin: 4px 0; }
    .u { display: inline-block; min-width: 60px; border-bottom: 1px dotted #999; padding: 0 6px; font-weight: 600; }
    .foot { margin-top: auto; width: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 6mm; }
    .sign { text-align: center; width: 80mm; }
    .sign .role { font-style: italic; font-size: 14px; }
    .sign .line { margin-top: 22mm; border-top: 1px solid #333; padding-top: 4px; font-weight: 700; }
    .place { text-align: center; width: 80mm; font-style: italic; font-size: 14px; }
  </style></head>
  <body>
    <div class="sheet"><div class="frame">
      <div class="head">
        ${logo}
        ${diocese ? `<div class="diocese">${esc(diocese)}</div>` : ''}
        <div class="parish">Giáo xứ ${esc(parishName)}</div>
      </div>
      <div class="title">${esc(K.title)}</div>
      <div class="latin">${esc(K.latin)}</div>
      <div class="body">
        Chứng nhận:
        <div class="name">${esc(fullName)}</div>
        Sinh ngày <span class="u">${dashDate(student.birth_date)}</span>${student.gender ? ` &nbsp;·&nbsp; Giới tính: <span class="u">${esc(student.gender)}</span>` : ''}<br/>
        Con ông <span class="u">${esc(father)}</span> và bà <span class="u">${esc(mother)}</span><br/>
        ${K.showGodparent ? `Người đỡ đầu: <span class="u">${esc(student.godparent_name || '………………………')}</span><br/>` : ''}
        ${K.verb} ngày <span class="u">${dashDate(student[K.dateKey])}</span><br/>
        tại giáo xứ <span class="u">${esc(parishName)}</span>.
      </div>
      <div class="foot">
        <div class="place">
          ${esc(place)}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}
        </div>
        <div class="sign">
          <div class="role">Linh mục Chánh xứ</div>
          <div class="line">(Ký tên &amp; đóng dấu)</div>
        </div>
      </div>
    </div></div>
  </body></html>`;

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 300);
}
