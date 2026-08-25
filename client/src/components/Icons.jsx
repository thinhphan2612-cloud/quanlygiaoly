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
// Icon "sửa ảnh": khung ảnh + bút chì
export const IconEditImage = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11.5V6.5A2.5 2.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H12" />
    <circle cx="8.6" cy="8.6" r="1.7" />
    <path d="M4.4 16.8l3.5-3 2.4 2 2.7-3" />
    <path d="M19 13.4l2.2 1.4-4.4 6.5-2.4.5.3-2.4z" />
  </svg>
);
