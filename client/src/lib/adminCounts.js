import { useEffect, useState } from 'react';

// Số việc cần xử lý của trang Quản trị, để menu bên trái hiện badge cạnh từng mục.
let counts = {};
const subs = new Set();

export function setAdminCounts(next) {
  counts = next;
  subs.forEach((fn) => fn(next));
}

export function useAdminCounts() {
  const [c, setC] = useState(counts);
  useEffect(() => { subs.add(setC); setC(counts); return () => { subs.delete(setC); }; }, []);
  return c;
}
