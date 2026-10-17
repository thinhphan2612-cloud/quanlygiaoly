import { useEffect, useState } from 'react';
import { getPref, setPref } from './prefs';

// Trạng thái bài tập hướng dẫn đang chạy: { id, step }. Lưu sessionStorage để tải lại trang vẫn tiếp tục.
const KEY = 'tour_active';
function readActive() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
}
let active = readActive();
const subs = new Set();
function emit(next) {
  active = next;
  try { if (next) sessionStorage.setItem(KEY, JSON.stringify(next)); else sessionStorage.removeItem(KEY); } catch { /* bỏ qua */ }
  subs.forEach((fn) => fn(next));
}

export const startTour = (id) => emit({ id, step: 0 });
export const goStep = (step) => { if (active) emit({ ...active, step }); };
export const stopTour = () => emit(null);

export function useActiveTour() {
  const [s, setS] = useState(active);
  useEffect(() => { subs.add(setS); setS(active); return () => { subs.delete(setS); }; }, []);
  return s;
}

// Bài đã hoàn thành: lưu ở tài khoản (user_metadata.prefs.tours_done, đồng bộ giữa các máy).
// localStorage chỉ là bản tạm để mở trang hiện ngay; luôn lấy theo tài khoản khi tải xong.
const DONE_KEY = 'tours_done';
let done = (() => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || []; } catch { return []; } })();
const doneInSession = new Set();
const doneSubs = new Set();
function setDone(list) {
  done = list;
  try { localStorage.setItem(DONE_KEY, JSON.stringify(list)); } catch { /* bỏ qua */ }
  doneSubs.forEach((fn) => fn(list));
}

export function markTourDone(id) {
  doneInSession.add(id);
  if (done.includes(id)) return;
  const list = [...done, id];
  setDone(list);
  setPref('tours_done', list).catch(() => {});
}

export function useToursDone() {
  const [d, setD] = useState(done);
  useEffect(() => {
    doneSubs.add(setD);
    getPref('tours_done').then((v) => {
      setDone([...new Set([...(Array.isArray(v) ? v : []), ...doneInSession])]);
    }).catch(() => {});
    return () => { doneSubs.delete(setD); };
  }, []);
  return d;
}
