// Bộ icon dạng stroke đơn giản (24x24, dùng currentColor)
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconHome = (p) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>
);
export const IconStudents = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6" /><path d="M17.5 20a5.5 5.5 0 0 0-3-4.9" /></svg>
);
export const IconClass = (p) => (
  <svg {...base} {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5Z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5Z" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9h17" /><path d="m8.5 14 2 2 4-4" /></svg>
);
export const IconGrades = (p) => (
  <svg {...base} {...p}><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="12" width="3" height="5" rx="1" /><rect x="12.5" y="8" width="3" height="9" rx="1" /><rect x="18" y="5" width="0" height="12" /></svg>
);
export const IconDice = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" /></svg>
);
export const IconGame = (p) => (
  <svg {...base} {...p}><path d="M7 8h10a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-6.3 2.1L14 14h-4l-.7.6A3.5 3.5 0 0 1 3 12.5V12a4 4 0 0 1 4-4Z" /><path d="M7 11.5v2M6 12.5h2" /><circle cx="16" cy="11.5" r=".9" fill="currentColor" stroke="none" /><circle cx="18" cy="13.5" r=".9" fill="currentColor" stroke="none" /></svg>
);
export const IconTeacher = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="7.5" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
);
export const IconLogout = (p) => (
  <svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12h10" /><path d="m14 8 4 4-4 4" /></svg>
);
export const IconBell = (p) => (
  <svg {...base} {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconMoney = (p) => (
  <svg {...base} {...p}><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9v0M18 15v0" /></svg>
);
// Icon "lưu trữ": thùng hồ sơ
export const IconArchive = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>
);
// Icon chứng chỉ / giấy khen (huy hiệu + dải ruy băng)
export const IconCert = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="9" r="5" /><path d="m8.5 13.5-1.5 6 5-2.5 5 2.5-1.5-6" /><path d="m10 9 1.4 1.4 3-3" /></svg>
);
// Icon hướng dẫn sử dụng (sách mở + dấu hỏi)
export const IconGuide = (p) => (
  <svg {...base} {...p}><path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5Z" /><path d="M12 6.5V20" /><path d="M10.4 11.2a1.6 1.6 0 1 1 2.3 1.6c-.6.4-.9.7-.9 1.3" /><path d="M11.8 15.6v0" /></svg>
);
// Icon đề thi (giấy + dấu tích)
export const IconExam = (p) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9.5 13.5 1.5 1.5 3-3" /></svg>
);
// Icon cửa hàng (Ephata Store)
export const IconStore = (p) => (
  <svg {...base} {...p}><path d="M4 8h16l-1 3.5a3 3 0 0 1-3 2.5H8a3 3 0 0 1-3-2.5z" /><path d="M4 8 6 4h12l2 4" /><path d="M6 14v6h12v-6" /></svg>
);
// Icon mở link ngoài (external link)
export const IconExt = (p) => (
  <svg {...base} {...p}><path d="M14 5h5v5" /><path d="M19 5l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
);
// Icon "sửa ảnh": khung ảnh + bút chì
export const IconEditImage = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11.5V6.5A2.5 2.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H12" />
    <circle cx="8.6" cy="8.6" r="1.7" />
    <path d="M4.4 16.8l3.5-3 2.4 2 2.7-3" />
    <path d="M19 13.4l2.2 1.4-4.4 6.5-2.4.5.3-2.4z" />
  </svg>
);

// ---- Icon cho nút / tiêu đề (thay emoji để hiển thị giống nhau trên mọi máy) ----
export const IconFilter = (p) => (
  <svg {...base} {...p}><path d="M4 5h16l-6 7.5V19l-4 1.5v-8Z" /></svg>
);
export const IconUpload = (p) => (
  <svg {...base} {...p}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
);
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
);
export const IconPrinter = (p) => (
  <svg {...base} {...p}><path d="M6.5 9V3.5h11V9" /><path d="M6.5 17H4.5A1.5 1.5 0 0 1 3 15.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-2" /><rect x="6.5" y="13.5" width="11" height="7" rx="1" /></svg>
);
export const IconColumns = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15" /><path d="M14.5 4.5v15" /></svg>
);
export const IconSliders = (p) => (
  <svg {...base} {...p}><path d="M4 6h9" /><path d="M17 6h3" /><circle cx="15" cy="6" r="2" /><path d="M4 12h3" /><path d="M11 12h9" /><circle cx="9" cy="12" r="2" /><path d="M4 18h11" /><path d="M19 18h1" /><circle cx="17" cy="18" r="2" /></svg>
);
export const IconMegaphone = (p) => (
  <svg {...base} {...p}><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" /><path d="M16.5 9a3.5 3.5 0 0 1 0 6" /></svg>
);
export const IconLock = (p) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconTrend = (p) => (
  <svg {...base} {...p}><path d="M4 19.5h16" /><path d="m5 15 4-4 3 3 6-6" /><path d="M15 8h3v3" /></svg>
);
export const IconList = (p) => (
  <svg {...base} {...p}><rect x="5.5" y="4.5" width="13" height="16" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6" /><path d="M9 14h6" /><path d="M9 18h3" /></svg>
);
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></svg>
);
export const IconSave = (p) => (
  <svg {...base} {...p}><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" /><path d="M8 4v5h7V4" /><path d="M8 20v-6h8v6" /></svg>
);
export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
export const IconEdit = (p) => (
  <svg {...base} {...p}><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></svg>
);
export const IconChat = (p) => (
  <svg {...base} {...p}><path d="M5 19V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H8.5Z" /></svg>
);
export const IconKey = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="15" r="3.5" /><path d="M10.5 12.5 19 4" /><path d="m16 7 2.5 2.5" /><path d="m13.5 9.5 2 2" /></svg>
);
export const IconAlert = (p) => (
  <svg {...base} {...p}><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4" /><circle cx="12" cy="16.8" r=".6" fill="currentColor" /></svg>
);
export const IconTrophy = (p) => (
  <svg {...base} {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4" /><path d="M16 6h2.5a2.5 2.5 0 0 1-2.6 4" /><path d="M12 13v4" /><path d="M8.5 20.5h7" /><path d="M10 17h4v3.5h-4z" /></svg>
);
export const IconFlag = (p) => (
  <svg {...base} {...p}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
);
export const IconGradCap = (p) => (
  <svg {...base} {...p}><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5Z" /><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11" /><path d="M21.5 9v5" /></svg>
);
export const IconStar = (p) => (
  <svg {...base} {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></svg>
);
export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconCopy = (p) => (
  <svg {...base} {...p}><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
);
export const IconVolume = (p) => (
  <svg {...base} {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconVolumeOff = (p) => (
  <svg {...base} {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="m16 9.5 5 5" /><path d="m21 9.5-5 5" /></svg>
);
export const IconExpand = (p) => (
  <svg {...base} {...p}><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></svg>
);
export const IconShuffle = (p) => (
  <svg {...base} {...p}><path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1.1 1.7 2.3 2.7 4.3 2.7H21" /><path d="M3 17h3.5c1.4 0 2.4-.5 3.2-1.4" /><path d="M13.3 8.4c.8-.9 1.8-1.4 3.2-1.4H21" /><path d="m18.5 4.5 2.5 2.5-2.5 2.5" /><path d="m18.5 14.5 2.5 2.5-2.5 2.5" /></svg>
);
