// Tiện ích phân tích danh sách học viên nhập hàng loạt (dán, CSV, hoặc Excel).
// Thứ tự cột (khớp mô hình học viên hiện tại):
//   1 Tên thánh và họ tên   2 Ngày sinh   3 Giới tính
//   4 Tên thánh & họ tên cha 5 SĐT cha     6 Tên thánh & họ tên mẹ  7 SĐT mẹ
//   8 Người đỡ đầu          9 SĐT học viên
//   10 Rửa tội  11 Rước lễ  12 Thêm sức   13 Địa chỉ   14 Ghi chú

export const COLUMNS = [
  'Tên thánh và họ tên',
  'Ngày sinh (dd/mm/yyyy)',
  'Giới tính (Nam/Nữ)',
  'Tên thánh & họ tên cha',
  'SĐT cha',
  'Tên thánh & họ tên mẹ',
  'SĐT mẹ',
  'Người đỡ đầu',
  'SĐT học viên',
  'Ngày rửa tội',
  'Ngày rước lễ',
  'Ngày thêm sức',
  'Địa chỉ',
  'Ghi chú',
];

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
      return { saint_name: name.slice(saint.length).trim() ? saint : '', full_name: name.slice(saint.length).trim() };
    }
  }
  const firstWord = name.split(' ')[0] || '';
  if (SAINTS_SINGLE.some((s) => lower(s) === lower(firstWord)) && name.includes(' ')) {
    return { saint_name: firstWord, full_name: name.slice(firstWord.length).trim() };
  }
  return { saint_name: '', full_name: name };
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
  return s; // giữ nguyên nếu không nhận dạng được
}

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
  return a.includes('tên thánh') || a === lower(COLUMNS[0]) || a.includes('họ tên') || a.includes('họ và tên');
}

// Một mảng ô -> object học viên
export function parseRow(cells) {
  const c = (i) => norm(cells[i] || '');
  const stu = splitSaintName(cells[0] || '');
  const dad = splitSaintName(cells[3] || '');
  const mom = splitSaintName(cells[5] || '');
  return {
    saint_name: stu.saint_name,
    full_name: stu.full_name,
    birth_date: normalizeDate(cells[1] || ''),
    gender: normalizeGender(cells[2] || ''),
    father_saint: dad.saint_name,
    father_name: dad.full_name,
    father_phone: c(4),
    mother_saint: mom.saint_name,
    mother_name: mom.full_name,
    mother_phone: c(6),
    godparent_name: c(7),
    student_phone: c(8),
    baptism_date: normalizeDate(cells[9] || ''),
    first_communion_date: normalizeDate(cells[10] || ''),
    confirmation_date: normalizeDate(cells[11] || ''),
    address: c(12),
    notes: c(13),
    _valid: !!stu.full_name,
  };
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
    if (!cells.some(Boolean)) continue; // dòng trống
    if (isHeader(cells)) continue;
    rows.push(parseRow(cells));
  }
  return rows;
}

// Bảng mẫu (tiêu đề + ví dụ) dùng cho file Excel/CSV
export function templateAoa() {
  return [
    COLUMNS,
    ['Phêrô Nguyễn Văn An', '26/12/2015', 'Nam', 'Giuse Nguyễn Văn Bố', '0901234567', 'Maria Trần Thị Mẹ', '0908765432', 'Gioan Trần Văn C', '', '20/01/2016', '', '', '123 Đường ABC, Phường 5', 'Ghi chú mẫu'],
    ['Maria Trần Thị Bình', '05/03/2016', 'Nữ', 'Phêrô Trần Văn Cha', '0912345678', '', '', '', '', '', '', '', '45 Đường XYZ', ''],
  ];
}
