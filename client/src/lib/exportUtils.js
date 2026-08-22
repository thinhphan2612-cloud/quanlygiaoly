import * as XLSX from 'xlsx';

// columns: [{ label, get: (row) => value, width? }]
// subtitle: chuỗi 1 dòng HOẶC mảng nhiều dòng
function subLines(subtitle) {
  return Array.isArray(subtitle) ? subtitle.filter(Boolean) : (subtitle ? [subtitle] : []);
}
function headerRows(title, subtitle) {
  const rows = [];
  if (title) rows.push([title]);
  subLines(subtitle).forEach((s) => rows.push([s]));
  if (title || subLines(subtitle).length) rows.push([]);
  return rows;
}

// Xuất Excel (.xlsx). totalsRow: mảng theo cột (dòng tổng); summary: dòng chú thích cuối.
export function exportXlsx({ filename, sheetName = 'Sheet1', title, subtitle, columns, rows, totalsRow, summary }) {
  const aoa = [
    ...headerRows(title, subtitle),
    columns.map((c) => c.label),
    ...rows.map((r, i) => columns.map((c) => c.get(r, i))),
  ];
  if (totalsRow) aoa.push(totalsRow);
  if (summary) { aoa.push([]); aoa.push([summary]); }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Xuất PDF bằng cách in (trình duyệt render tiếng Việt hoàn hảo, người dùng chọn "Lưu thành PDF")
export function exportPdf({ title, subtitle, columns, rows, totalsRow, summary, align }) {
  const thead = '<tr>' + columns.map((c) => `<th>${esc(c.label)}</th>`).join('') + '</tr>';
  const tbody = rows
    .map((r, i) => '<tr>' + columns.map((c) => `<td>${esc(c.get(r, i))}</td>`).join('') + '</tr>')
    .join('');
  const tfoot = totalsRow
    ? `<tfoot><tr>${totalsRow.map((c) => `<td><b>${esc(c)}</b></td>`).join('')}</tr></tfoot>`
    : '';
  const now = new Date().toLocaleDateString('vi-VN');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font-family: 'Times New Roman', serif; color: #111; padding: 24px; }
      h1 { font-size: 18px; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
      .sub { text-align: center; color: #444; font-size: 13px; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #333; padding: 5px 7px; text-align: ${align === 'center' ? 'center' : 'left'}; vertical-align: top; }
      th { background: #eee; font-weight: 700; }
      tfoot td { background: #f4f4f4; }
      .summary { margin-top: 10px; font-size: 13px; font-weight: 700; text-align: center; }
      .foot { margin-top: 14px; font-size: 11px; color: #666; text-align: right; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h1>${esc(title)}</h1>
      ${subLines(subtitle).length ? `<div class="sub">${subLines(subtitle).map(esc).join('<br>')}</div>` : ''}
      <table><thead>${thead}</thead><tbody>${tbody}</tbody>${tfoot}</table>
      ${summary ? `<div class="summary">${esc(summary)}</div>` : ''}
      <div class="foot">Xuất ngày ${now} · Quản lý Giáo lý</div>
    </body></html>`;

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 300);
}

// Dựng phần đầu bản xuất (dùng chung): giáo xứ, lớp + năm học, GV phụ trách, dòng thêm
export function exportSubtitle({ parish, cls, extra = [] } = {}) {
  const lines = [];
  if (parish?.name) lines.push(`Giáo xứ: ${parish.name}${parish.diocese ? ' — ' + parish.diocese : ''}`);
  if (cls?.name) {
    lines.push(`Lớp: ${cls.name}${cls.year ? '     Năm học: ' + cls.year : ''}`);
    if (cls.teacher_name) lines.push(`Giáo lý viên phụ trách: ${cls.teacher_name}`);
  }
  return [...lines, ...extra].filter(Boolean);
}

// Map trạng thái điểm danh -> tiếng Việt (dùng chung)
export const ATT_LABEL = { present: 'Có mặt', absent: 'Vắng', late: 'Trễ' };

// Cột STT dùng chung
export const STT_COL = { label: 'STT', get: (_r, i) => i + 1, width: 6 };

// Bỏ dấu tiếng Việt để đặt tên file
export const fileSlug = (s) =>
  Array.from(String(s || '').normalize('NFD'))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f; // bỏ dấu tổ hợp U+0300..U+036F
    })
    .join('')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
