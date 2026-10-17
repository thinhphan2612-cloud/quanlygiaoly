import { useEffect, useRef, useState } from 'react';
import { registerConfirmHost } from '../lib/confirm';

// Tách câu hỏi thành tiêu đề + phần giải thích (theo dòng trống, xuống dòng, hoặc dấu "?" đầu tiên).
function split(message = '') {
  const m = String(message);
  for (const sep of ['\n\n', '\n']) {
    const i = m.indexOf(sep);
    if (i > 0) return [m.slice(0, i), m.slice(i + sep.length)];
  }
  const q = m.indexOf('? ');
  if (q > 0) return [m.slice(0, q + 1), m.slice(q + 2)];
  return [m, ''];
}

// Hiển thị hộp xác nhận từ confirmDialog() (lib/confirm). Gắn một lần ở gốc App.
export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const okRef = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => registerConfirmHost(setReq), []);

  const [title, body] = split(req?.message);
  const verb = (/^(Xóa|Xoá|XÓA|Hủy|Huỷ|Gỡ)/.exec(title.trim()) || [])[1];
  const danger = req?.danger ?? !!verb;
  const okText = req?.okText || (verb ? ({ Xoá: 'Xóa', XÓA: 'Xóa', Huỷ: 'Đồng ý hủy', Hủy: 'Đồng ý hủy' }[verb] || verb) : 'Đồng ý');

  function close(v) { req?.resolve(v); setReq(null); }

  useEffect(() => {
    if (!req) return undefined;
    // Thao tác nguy hiểm: để sẵn ở "Quay lại" cho khỏi lỡ tay bấm Enter.
    (danger ? cancelRef : okRef).current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return null;
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={() => close(false)}>
      <div className="modal confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className={danger ? 'danger' : ''}>{title}</h2>
        {body && <p className="confirm-body">{body}</p>}
        <div className="modal-actions">
          <button ref={cancelRef} className="btn ghost" onClick={() => close(false)}>Quay lại</button>
          <button ref={okRef} className={`btn ${danger ? 'btn-danger-solid' : ''}`} onClick={() => close(true)}>{okText}</button>
        </div>
      </div>
    </div>
  );
}
