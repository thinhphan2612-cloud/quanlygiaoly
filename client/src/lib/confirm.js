// Hộp xác nhận của ứng dụng, thay cho confirm() của trình duyệt.
// Dùng: if (!(await confirmDialog('Xóa lớp "A"? Học viên sẽ về "chưa xếp lớp".'))) return;
// Có thể truyền object: { message, okText, cancelText, danger }.
let push = null;

export function confirmDialog(opts) {
  const o = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise((resolve) => {
    if (!push) { resolve(window.confirm(o.message)); return; } // dự phòng khi chưa gắn ConfirmHost
    push({ ...o, resolve });
  });
}

// ConfirmHost gọi để nhận yêu cầu hiển thị.
export function registerConfirmHost(fn) {
  push = fn;
  return () => { if (push === fn) push = null; };
}
