import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import { COLUMNS, parseStudents, parseAoa, templateAoa } from '../lib/parseStudents';

export default function BulkImport({ classes, onClose, onDone }) {
  const [text, setText] = useState('');
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const validCount = rows.filter((r) => r._valid).length;

  function previewText(t) {
    setText(t);
    setError('');
    setRows(parseStudents(t));
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
          setText('');
          setRows(parseAoa(aoa));
          if (!aoa.length) setError('File Excel trống');
        } catch {
          setError('Không đọc được file Excel. Vui lòng dùng đúng form mẫu.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => previewText(String(reader.result || ''));
      reader.readAsText(file, 'utf-8');
    }
    e.target.value = '';
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet(templateAoa());
    ws['!cols'] = COLUMNS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Học viên');
    XLSX.writeFile(wb, 'mau-nhap-hoc-vien.xlsx');
  }

  async function doImport() {
    setError('');
    if (validCount === 0) { setError('Không có dòng hợp lệ để nhập'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/students/bulk', {
        class_id: classId || null,
        students: rows.filter((r) => r._valid),
      });
      onDone(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Nhập thất bại');
    } finally {
      setSaving(false);
    }
  }

  const dad = (r) => [r.father_saint, r.father_name].filter(Boolean).join(' ');
  const mom = (r) => [r.mother_saint, r.mother_name].filter(Boolean).join(' ');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 820 }} onClick={(e) => e.stopPropagation()}>
        <h2>Nhập học viên hàng loạt</h2>

        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Cách nhanh nhất: bấm <b>Tải form mẫu (Excel)</b>, điền vào file rồi <b>Tải lên</b>. Hoặc dán trực tiếp từ Excel (mỗi dòng một học viên) theo đúng thứ tự cột:
        </p>
        <div style={{ fontSize: 12.5, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
          {COLUMNS.join('  •  ')}
        </div>

        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button className="btn ghost" onClick={downloadTemplate}>⬇ Tải form mẫu (Excel)</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>📄 Tải lên Excel / CSV</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          <div className="grow" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 200 }}>
            <option value="">Xếp vào lớp... (tùy chọn)</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <textarea
          rows={5}
          value={text}
          onChange={(e) => previewText(e.target.value)}
          placeholder={'Dán từ Excel hoặc gõ trực tiếp, ví dụ:\nPhêrô Nguyễn Văn An, 26/12/2015, Nam, Giuse Nguyễn Văn Bố, 0901234567, Maria Trần Thị Mẹ, 0908765432, , , 20/01/2016, , , 123 Đường ABC, Ghi chú'}
        />

        {rows.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              Xem trước: <b>{validCount}</b> hợp lệ
              {rows.length - validCount > 0 && (
                <span style={{ color: 'var(--danger)' }}> · {rows.length - validCount} dòng thiếu họ tên sẽ bị bỏ qua</span>
              )}
            </div>
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table>
                <thead>
                  <tr><th>Tên thánh</th><th>Họ tên</th><th>Ngày sinh</th><th>GT</th><th>Cha</th><th>Mẹ</th><th>SĐT</th><th>Bí tích (RT/RL/TS)</th><th>Địa chỉ</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ opacity: r._valid ? 1 : 0.45 }}>
                      <td>{r.saint_name || '—'}</td>
                      <td>{r.full_name || <span style={{ color: 'var(--danger)' }}>(thiếu)</span>}</td>
                      <td>{r.birth_date || '—'}</td>
                      <td>{r.gender || '—'}</td>
                      <td>{dad(r) || '—'}</td>
                      <td>{mom(r) || '—'}</td>
                      <td>{r.father_phone || r.mother_phone || r.student_phone || '—'}</td>
                      <td>{[r.baptism_date, r.first_communion_date, r.confirmation_date].map((d) => d || '–').join(' / ')}</td>
                      <td>{r.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn" onClick={doImport} disabled={saving || validCount === 0}>
            {saving ? 'Đang nhập...' : `Nhập ${validCount} học viên`}
          </button>
        </div>
      </div>
    </div>
  );
}
