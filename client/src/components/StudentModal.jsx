import { useEffect, useRef, useState } from 'react';
import api from '../api';
import StudentForm, { validateStudent } from './StudentForm.jsx';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';

// Hộp Thêm/Sửa học viên dùng chung (trang Học viên và Hồ sơ):
// không mất dữ liệu khi lỡ bấm ra ngoài, khóa nút khi đang lưu, kiểm tra trước khi lưu.
export default function StudentModal({ initial, classes, requireClass, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const start = useRef(JSON.stringify(initial));
  const busy = useRef(false); // chặn bấm Lưu 2 lần liền (state chưa kịp cập nhật)
  const dirty = JSON.stringify(form) !== start.current;
  const isNew = !initial.id;

  async function close() {
    if (saving) return;
    if (dirty && !(await confirmDialog('Bỏ các thông tin vừa nhập?\n\nNhững gì chưa lưu sẽ mất.'))) return;
    onClose();
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.cf-backdrop, .confirm-backdrop')) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // luôn dùng bản close mới nhất (biết dirty hiện tại)

  async function save() {
    if (busy.current) return;
    const msg = validateStudent(form, { requireClass });
    if (msg) { setError(msg); toast.err(msg); return; }
    busy.current = true; setError(''); setSaving(true);
    try {
      const r = isNew ? await api.post('/students', form) : await api.put(`/students/${form.id}`, form);
      toast(isNew ? `Đã thêm học viên ${form.full_name.trim()}` : 'Đã lưu thông tin học viên');
      onSaved(r?.data);
    } catch (e) {
      const m = e.response?.data?.error || 'Lưu thất bại, vui lòng thử lại.';
      setError(m); toast.err(m);
    } finally { busy.current = false; setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal wide hvx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="hvxModalT">
        <div className="hvx-mhead">
          <h2 id="hvxModalT">{isNew ? 'Thêm học viên' : `Sửa thông tin: ${initial.full_name}`}</h2>
          <button type="button" className="hvx-x" onClick={close} aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="hvx-mbody">
          <StudentForm form={form} setForm={setForm} classes={classes} />
        </div>
        <div className="hvx-mfoot">
          <span className={error ? 'hvx-ferr' : 'hvx-fnote'}>{error || (dirty ? 'Có thay đổi chưa lưu' : '')}</span>
          <button className="btn ghost" onClick={close} disabled={saving}>Hủy</button>
          <button className="btn" onClick={save} disabled={saving || (!isNew && !dirty)}>{saving ? 'Đang lưu…' : isNew ? 'Thêm học viên' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}
