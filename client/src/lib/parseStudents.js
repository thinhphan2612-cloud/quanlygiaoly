// Tiện ích phân tích danh sách học viên nhập hàng loạt (dán, CSV, hoặc Excel).
// Cột khai báo theo FIELDS bên dưới (khớp mô hình học viên hiện tại). Các cột chi tiết
// chứng chỉ để trống được — có thể điền sau ở form từng em.

// Tên thánh nhiều chữ (khớp trước để ưu tiên chuỗi dài hơn)
const SAINTS_MULTI = [
  'Gioan Baotixita', 'Gioan Tẩy Giả', 'Maria Madalena', 'Maria Mađalêna', 'Maria Goretti',
  'Phanxicô Xaviê', 'Phanxicô Assisi', 'Vinh Sơn', 'Đa Minh', 'Gioan Phaolô', 'Phêrô Phaolô',
  'Têrêsa Hài Đồng', 'Anna Maria', 'Martinô Porres',
];

// Tên thánh một chữ
const SAINTS_SINGLE = [
  'Giuse', 'Maria', 'Phêrô', 'Phaolô', 'Gioan', 'Anê', 'Anna', 'Anrê', 'Antôn', 'Antôniô',
  'Augustinô', 'Bênêđictô', 'Bênađô', 'Bosco', 'Catarina', 'Cêcilia', 'Cecilia', 'Clara',
  'Đaminh', 'Đôminicô', 'Emmanuel', 'Faustina', 'Gabriel', 'Giacôbê', 'Gioakim', 'Giêrônimô',
  'Grêgôriô', 'Inê', 'Ignatiô', 'Inhaxiô', 'Isave', 'Lôrensô', 'Laurensô', 'Lucia', 'Luca',
  'Máccô', 'Marcô', 'Mátthêu', 'Matthêu', 'Micae', 'Michael', 'Monica', 'Martinô', 'Mađalêna',
  'Madalena', 'Nicôla', 'Philipphê', 'Rôsa', 'Rosa', 'Simon', 'Stêphanô', 'Tôma', 'Têrêsa',
  'Têrêxa', 'Tađêô', 'Vincentê', 'Veronica', 'Bartôlômêô', 'Batôlômêô', 'Phanxicô', 'Anphongsô',
  'Anphong', 'Clêmentê', 'Cornêliô', 'Đamianô', 'Raphael', 'Agata', 'Agatha', 'Barbara',
  'Elisabeth', 'Êlisabeth', 'Isaac', 'Isaia', 'Kitô',
];

const norm = (s) => (s == null ? '' : String(s)).trim().replace(/\s+/g, ' ');
const lower = (s) => norm(s).toLowerCase();

// Tách tên thánh khỏi họ tên (khớp phần đầu chuỗi)
export function splitSaintName(combined) {
  const name = norm(combined);
  const nameLower = lower(name);
  for (const saint of SAINTS_MULTI) {
    if (nameLower.startsWith(lower(saint) + ' ')) {
      return { saint: name.slice(saint.length).trim() ? saint : '', rest: name.slice(saint.length).trim() };
    }
  }
  const firstWord = name.split(' ')[0] || '';
  if (SAINTS_SINGLE.some((s) => lower(s) === lower(firstWord)) && name.includes(' ')) {
    return { saint: firstWord, rest: name.slice(firstWord.length).trim() };
  }
  return { saint: '', rest: name };
}

// Chuẩn hóa giới tính về 'Nam' / 'Nữ' (để trống nếu không rõ)
export function normalizeGender(raw) {
  const s = lower(raw).replace(/\./g, '');
  if (!s) return '';
  if (['nam', 'm', 'male', 'trai', 'con trai', 'boy', 'b'].includes(s)) return 'Nam';
  if (['nữ', 'nu', 'f', 'female', 'gái', 'gai', 'con gái', 'con gai', 'girl', 'g'].includes(s)) return 'Nữ';
  return norm(raw);
}

// Chuẩn hóa ngày về YYYY-MM-DD (chấp nhận dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd)
export function normalizeDate(raw) {
  const s = norm(raw);
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/); // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// Khai báo cột theo thứ tự. kind: 'name'|'father'|'mother' -> tự tách tên thánh thành 2 trường.
// t: 'date'|'gender' -> chuẩn hóa. Còn lại lưu thẳng vào key.
const FIELDS = [
  { h: 'Tên thánh và họ tên', kind: 'name', keys: ['saint_name', 'full_name'] },
  { h: 'Ngày sinh (dd/mm/yyyy)', k: 'birth_date', t: 'date' },
  { h: 'Giới tính (Nam/Nữ)', k: 'gender', t: 'gender' },
  { h: 'Nơi sinh', k: 'birth_place' },
  { h: 'Nguyên quán', k: 'origin_place' },
  { h: 'Trú quán', k: 'residence' },
  { h: 'Tên thánh & họ tên cha', kind: 'name', keys: ['father_saint', 'father_name'] },
  { h: 'SĐT cha', k: 'father_phone' },
  { h: 'Tên thánh & họ tên mẹ', kind: 'name', keys: ['mother_saint', 'mother_name'] },
  { h: 'SĐT mẹ', k: 'mother_phone' },
  { h: 'Người đỡ đầu', k: 'godparent_name' },
  { h: 'SĐT học viên', k: 'student_phone' },
  { h: 'Ngày rửa tội', k: 'baptism_date', t: 'date' },
  { h: 'Nhà thờ Rửa Tội', k: 'baptism_church' },
  { h: 'Số trích sổ Rửa Tội', k: 'baptism_book_no' },
  { h: 'Linh mục Rửa Tội', k: 'baptism_priest' },
  { h: 'Ngày rước lễ', k: 'first_communion_date', t: 'date' },
  { h: 'Ngày thêm sức', k: 'confirmation_date', t: 'date' },
  { h: 'Nhà thờ Thêm Sức', k: 'confirmation_church' },
  { h: 'Giám mục Thêm Sức', k: 'confirmation_bishop' },
  { h: 'Người đỡ đầu Thêm Sức', k: 'confirmation_godparent' },
  { h: 'Số trích sổ Thêm Sức', k: 'confirmation_book_no' },
  { h: 'Địa chỉ', k: 'address' },
  { h: 'Ghi chú', k: 'notes' },
];

export const COLUMNS = FIELDS.map((f) => f.h);

// Tách một dòng text: ưu tiên Tab (dán từ Excel), nếu không thì CSV có xử lý dấu ngoặc kép
function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

// True nếu dòng là tiêu đề (bỏ qua khi nhập)
function isHeader(cells) {
  const a = lower(cells[0]);
  return a.includes('tên thánh') || a.includes('họ tên') || a.includes('họ và tên');
}

// Một mảng ô -> object học viên
export function parseRow(cells) {
  const row = {};
  FIELDS.forEach((f, i) => {
    const raw = cells[i] == null ? '' : cells[i];
    if (f.kind === 'name') {
      const { saint, rest } = splitSaintName(raw);
      row[f.keys[0]] = saint;
      row[f.keys[1]] = rest;
    } else if (f.t === 'date') row[f.k] = normalizeDate(raw);
    else if (f.t === 'gender') row[f.k] = normalizeGender(raw);
    else row[f.k] = norm(raw);
  });
  row._valid = !!row.full_name;
  return row;
}

// Phân tích text (dán / CSV) -> mảng object học viên
export function parseStudents(text) {
  const rows = [];
  const lines = (text || '').replace(/^﻿/, '').split(/\r?\n/);
  for (const line of lines) {
    if (!norm(line)) continue;
    const cells = splitLine(line);
    if (isHeader(cells)) continue;
    rows.push(parseRow(cells));
  }
  return rows;
}

// Phân tích mảng-2-chiều (từ Excel) -> mảng object học viên
export function parseAoa(aoa) {
  const rows = [];
  for (const arr of (aoa || [])) {
    const cells = (arr || []).map((v) => norm(v));
    if (!cells.some(Boolean)) continue;
    if (isHeader(cells)) continue;
    rows.push(parseRow(cells));
  }
  return rows;
}

// Bảng mẫu (tiêu đề + ví dụ) dùng cho file Excel. Cột chi tiết chứng chỉ để trống ở dòng 2.
export function templateAoa() {
  return [
    COLUMNS,
    ['Phêrô Nguyễn Văn An', '26/12/2015', 'Nam', 'Bệnh viện Từ Dũ', 'Nam Định', 'TP.HCM',
      'Giuse Nguyễn Văn Bố', '0901234567', 'Maria Trần Thị Mẹ', '0908765432', 'Gioan Trần Văn C', '',
      '20/01/2016', 'Nhà thờ Chính Tòa', 'Q1/S15', 'Lm. Giuse Nguyễn A', '', '', '', '', '', '',
      '123 Đường ABC, Phường 5', 'Ghi chú mẫu'],
    ['Maria Trần Thị Bình', '05/03/2016', 'Nữ', '', '', '',
      'Phêrô Trần Văn Cha', '0912345678', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '',
      '45 Đường XYZ', ''],
  ];
}
