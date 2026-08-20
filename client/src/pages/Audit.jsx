import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { exportXlsx, exportPdf, STT_COL, fileSlug } from '../lib/exportUtils';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN');
const empty = { content: '', type: 'thu', amount: '', date: today(), class_id: '' };

export default function Audit() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  function load() {
    const q = filterClass ? `?class_id=${filterClass}` : '';
    api.get(`/transactions${q}`).then((r) => setRows(r.data)).catch((e) => setError(e.response?.data?.error || 'Không tải được (đã tạo bảng transactions chưa?)'));
  }
  useEffect(() => { load(); }, [filterClass]);

  if (user?.role !== 'admin') return <div className="muted">Chỉ quản trị viên xem kiểm toán.</div>;

  const thu = rows.filter((r) => r.type === 'thu').reduce((s, r) => s + Number(r.amount), 0);
  const chi = rows.filter((r) => r.type === 'chi').reduce((s, r) => s + Number(r.amount), 0);
  const balance = thu - chi;

  async function add() {
    setError('');
    if (!form.content.trim() || form.amount === '') { setError('Nhập nội dung và số tiền'); return; }
    try {
      await api.post('/transactions', { ...form, amount: Number(form.amount) });
      setForm({ ...empty, class_id: form.class_id });
      load();
    } catch (e) { setError(e.response?.data?.error || 'Lưu thất bại'); }
  }
  async function remove(t) {
    if (!confirm('Xóa khoản này?')) return;
    await api.delete(`/transactions/${t.id}`); load();
  }

  const cols = [
    STT_COL,
    { label: 'Ngày', get: (r) => r.date, width: 12 },
    { label: 'Nội dung', get: (r) => r.content, width: 30 },
    { label: 'Lớp', get: (r) => r.class_name || '', width: 14 },
    { label: 'Thu', get: (r) => (r.type === 'thu' ? fmt(r.amount) : ''), width: 12 },
    { label: 'Chi', get: (r) => (r.type === 'chi' ? fmt(r.amount) : ''), width: 12 },
  ];
  const meta = { title: 'Bảng thu chi', subtitle: filterClass ? `Lớp: ${classes.find((c) => c.id === filterClass)?.name || ''}` : 'Toàn giáo xứ', columns: cols, rows };

  return (
    <div>
      <h1>Kiểm toán thu chi</h1>

      <div className="audit-summary">
        <div className="audit-card thu"><div className="lbl">Tổng thu</div><div className="num">{fmt(thu)}đ</div></div>
        <div className="audit-card chi"><div className="lbl">Tổng chi</div><div className="num">{fmt(chi)}đ</div></div>
        <div className={`audit-card ${balance >= 0 ? 'duong' : 'am'}`}>
          <div className="lbl">Cân đối</div>
          <div className="num">{balance >= 0 ? '+' : ''}{fmt(balance)}đ</div>
          <div className="tag">{balance >= 0 ? 'Đang dương' : 'Đang âm'}</div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Nội dung</label>
            <input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="VD: Thu quỹ lớp, Mua quà Noel..." />
          </div>
          <div className="field" style={{ flex: '0 0 120px' }}>
            <label>Loại</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="thu">Thu</option>
              <option value="chi">Chi</option>
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 140px' }}>
            <label>Số tiền (đ)</label>
            <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '0 0 150px' }}>
            <label>Ngày</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '0 0 160px' }}>
            <label>Lớp (tùy chọn)</label>
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              <option value="">— Chung —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}><button className="btn" onClick={add}>+ Thêm</button></div>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="panel">
        <div className="toolbar" style={{ marginTop: 0 }}>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: 200 }}>
            <option value="">Tất cả lớp / chung</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn ghost" disabled={rows.length === 0} onClick={() => exportXlsx({ filename: `thu-chi-${fileSlug(meta.subtitle)}.xlsx`, sheetName: 'Thu chi', ...meta })}>⬇ Excel</button>
          <button className="btn ghost" disabled={rows.length === 0} onClick={() => exportPdf(meta)}>🖨 PDF</button>
        </div>
        <table>
          <thead><tr><th>Ngày</th><th>Nội dung</th><th>Lớp</th><th style={{ textAlign: 'right' }}>Thu</th><th style={{ textAlign: 'right' }}>Chi</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.content}{t.note ? <span className="muted"> — {t.note}</span> : ''}</td>
                <td>{t.class_name || <span className="muted">Chung</span>}</td>
                <td style={{ textAlign: 'right', color: 'var(--success)' }}>{t.type === 'thu' ? fmt(t.amount) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{t.type === 'chi' ? fmt(t.amount) : ''}</td>
                <td style={{ textAlign: 'right' }}><button className="btn danger sm" onClick={() => remove(t)}>Xóa</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Chưa có khoản thu chi nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
