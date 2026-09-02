// Xuất ĐỀ THI GIẤY để in (qua hộp thoại in -> lưu PDF hoặc in thẳng).
//  - mode 'student': đề cho học viên làm (A/B/C/D, có ô Họ tên/Lớp/Điểm, KHÔNG đáp án).
//  - mode 'key'    : bản đáp án cho GLV chấm (Câu n → chữ cái đúng).
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KIND = { '15p': '15 phút', '1tiet': '1 tiết', hocky: 'Học kỳ', khac: 'Khác' };

const STYLE = `
*{box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;color:#000;margin:0;font-size:13pt;line-height:1.45}
.wrap{padding:14mm 16mm}
.head{text-align:center;margin-bottom:10px}
.head .org{font-size:11pt;text-transform:uppercase}
.head h1{font-size:16pt;margin:6px 0 2px;text-transform:uppercase}
.head .sub{font-size:11pt;font-style:italic}
.info{display:flex;justify-content:space-between;gap:16px;margin:14px 0 8px;font-size:12.5pt}
.info .fill{border-bottom:1px dotted #000;min-width:120px;display:inline-block}
.q{margin:9px 0;page-break-inside:avoid}
.q-t{font-weight:700}
.opts{margin:2px 0 0 18px}
.opt{margin:1px 0}
.key-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px 14px;margin-top:12px;font-size:13pt}
.key-grid b{font-weight:700}
.foot{margin-top:16px;text-align:right;font-size:11pt;font-style:italic}
@page{size:A4 portrait;margin:0}
@media print{.q{page-break-inside:avoid}}
`;

function pageHtml(inner) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${STYLE}</style></head><body><div class="wrap">${inner}</div></body></html>`;
}

function studentHtml(exam) {
  const qs = exam.questions || [];
  const dur = exam.duration_min ? ` · Thời gian: ${exam.duration_min} phút` : '';
  const head = `
    <div class="head">
      <div class="org">${esc(exam.parish_name || exam.diocese || '')}</div>
      <h1>${esc(exam.title || 'Đề thi')}</h1>
      <div class="sub">Lớp: ${esc(exam.class_name || '……')} · ${esc(KIND[exam.kind] || exam.kind || '')}${dur} · ${qs.length} câu</div>
    </div>
    <div class="info">
      <span>Họ và tên: <span class="fill"></span></span>
      <span>Lớp: <span class="fill" style="min-width:70px"></span></span>
      <span>Điểm: <span class="fill" style="min-width:50px"></span></span>
    </div>`;
  const body = qs.map((q, i) => `
    <div class="q">
      <div class="q-t">Câu ${i + 1}. ${esc(q.text)}</div>
      <div class="opts">${(q.options || []).map((o, idx) => `<div class="opt">${LETTERS[idx]}. ${esc(o)}</div>`).join('')}</div>
    </div>`).join('');
  return pageHtml(head + body);
}

function keyHtml(exam) {
  const qs = exam.questions || [];
  const head = `
    <div class="head">
      <h1>Đáp án — ${esc(exam.title || '')}</h1>
      <div class="sub">Lớp: ${esc(exam.class_name || '')} · ${qs.length} câu · (dành cho GLV chấm)</div>
    </div>`;
  const grid = `<div class="key-grid">${qs.map((q, i) =>
    `<div>Câu ${i + 1}: <b>${LETTERS[q.correct] ?? '?'}</b></div>`).join('')}</div>`;
  return pageHtml(head + grid);
}

export function printExamPaper(exam, mode = 'student') {
  const html = mode === 'key' ? keyHtml(exam) : studentHtml(exam);
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win.document; doc.open(); doc.write(html); doc.close();
  let done = false;
  const go = () => { if (done) return; done = true; win.focus(); win.print(); setTimeout(() => document.body.removeChild(iframe), 1500); };
  (doc.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 200));
  setTimeout(go, 3000);
}
