import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { exportXlsx, exportPdf, STT_COL, fileSlug } from '../lib/exportUtils';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN');

export default function Audit() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({ content: '', type: 'thu', amount: '', date: today(), class_id: '' });
  const [error, setError] = useState('');

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  function load() { api.get('/transactions').then((r) => setRows(r.data)).catch((e) => setError(e.response?.data?.error || 'Không tải được')); }
  useEffect(() => { load(); }, []);

  // GLV: mặc định lớp mình (lớp đầu trong danh sách đã scope)
  useEffect(() => {
    if (!isAdmin && classes.length && !form.class_id) setForm((f) => ({ ...f, class_id: classes[0].id }));
  }, [classes, isAdmin]);

  const shown = filterClass
    ? (filterClass === 'chung' ? rows.filter((r) => !r.class_id) : rows.filter((r) => r.class_id === filterClass))
    : rows;
  const thu = shown.filter((r) => r.type === 'thu').reduce((s, r) => s + Number(r.amount), 0);
  const chi = shown.filter((r) => r.type === 'chi').reduce((s, r) => s + Number(r.amount), 0);
  const balance = thu - chi;

  // Admin: thống kê thu chi TỪNG LỚP + khoản chung
  const perClass = isAdmin ? (() => {
    const groups = {};
    rows.forEach((r) => {
      const key = r.class_id || 'chung';
      const name = r.class_name || 'Chung (giáo xứ)';
      const g = groups[key] || (groups[key] = { name, thu: 0, chi: 0 });
      if (r.type === 'thu') g.thu += Number(r.amount); else g.chi += Number(r.amount);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  })() : [];

  async function add() {
    setError('');
    if (!form.content.trim() || form.amount === '') { setError('Nhập nội dung và số tiền'); return; }
    // Admin chỉ ghi khoản chung (class_id null); GLV ghi cho lớp mình
    const class_id = isAdmin ? null : form.class_id;
    try {
      await api.post('/transactions', { ...form, class_id, amount: Number(form.amount) });
      setForm({ ...form, content: '', amount: '' });
      load();
    } catch (e) { setError(e.response?.data?.error || 'Lưu thất bại'); }
  }
  async function remove(t) {
    if (!confirm('Xóa khoản này?')) return;
    try { await api.delete(`/transactions/${t.id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Không xóa được (khoản của lớp, admin chỉ xem).'); }
  }
  // Admin không sửa/xóa khoản thuộc lớp
  const canDelete = (t) => !isAdmin || !t.class_id;

  const cols = [
    STT_COL,
    { label: 'Ngày', get: (r) => r.date, width: 12 },
    { label: 'Nội dung', get: (r) => r.content, width: 30 },
    { label: 'Lớp', get: (r) => r.class_name || 'Chung', width: 14 },
    { label: 'Thu', get: (r) => (r.type === 'thu' ? fmt(r.amount) : ''), width: 12 },
    { label: 'Chi', get: (r) => (r.type === 'chi' ? fmt(r.amount) : ''), width: 12 },
  ];
  const totalsRow = ['', '', 'TỔNG CỘNG', '', fmt(thu), fmt(chi)];
  const summary = `Cân đối: ${balance >= 0 ? '+' : ''}${fmt(balance)}đ  (${balance >= 0 ? 'Dư' : 'Thiếu'})`;
  const subLabel = filterClass === 'chung' ? 'Khoản chung' : (filterClass ? `Lớp: ${classes.find((c) => c.id === filterClass)?.name || ''}` : (isAdmin ? 'Toàn giáo xứ' : 'Lớp của tôi'));
  const meta = { title: 'Bảng thu chi', subtitle: subLabel, columns: cols, rows: shown, totalsRow, summary, align: 'center' };

  return (
    <div>
      <h1>{isAdmin ? 'Thu chi giáo xứ' : 'Thu chi lớp'}</h1>

      <div className="audit-summary">
        <div className="audit-card thu"><div className="lbl">Tổng thu</div><div className="num">{fmt(thu)}đ</div></div>
        <div className="audit-card chi"><div className="lbl">Tổng chi</div><div className="num">{fmt(chi)}đ</div></div>
        <div className={`audit-card ${balance >= 0 ? 'duong' : 'am'}`}>
          <div className="lbl">Cân đối</div>
          <div className="num">{balance >= 0 ? '+' : ''}{fmt(balance)}đ</div>
          <div className="tag">{balance >= 0 ? 'Đang dương' : 'Đang âm'}</div>
        </div>
      </div>

      {/* Admin: thống kê từng lớp */}
      {isAdmin && perClass.length > 0 && (
        <div className="panel">
          <div className="card-head"><h2>Thu chi từng lớp</h2></div>
          <table>
            <thead><tr><th>Lớp</th><th style={{ textAlign: 'right' }}>Thu</th><th style={{ textAlign: 'right' }}>Chi</th><th style={{ textAlign: 'right' }}>Cân đối</th></tr></thead>
            <tbody>
              {perClass.map((g) => {
                const bal = g.thu - g.chi;
                return (
                  <tr key={g.name}>
                    <td>{g.name}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(g.thu)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(g.chi)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: bal >= 0 ? 'var(--success)' : 'var(--danger)' }}>{bal >= 0 ? '+' : ''}{fmt(bal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form nhập: GLV ghi lớp mình; admin ghi khoản chung */}
      <div className="panel">
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label>Nội dung {isAdmin && <span className="muted">(khoản chung của giáo xứ)</span>}</label>
            <input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="VD: Thu quỹ lớp, Mua quà..." />
          </div>
          <div className="field" style={{ flex: '0 0 120px' }}>
            <label>Loại</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="thu">Thu</option><option value="chi">Chi</option></select>
          </div>
          <div className="field" style={{ flex: '0 0 140px' }}>
            <label>Số tiền (đ)</label>
            <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '0 0 150px' }}>
            <label>Ngày</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          {!isAdmin && classes.length > 1 && (
            <div className="field" style={{ flex: '0 0 160px' }}>
              <label>Lớp</label>
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ flex: '0 0 auto' }}><button className="btn" onClick={add}>+ Thêm</button></div>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {/* Danh sách */}
      <div className="panel">
        <div className="toolbar" style={{ marginTop: 0 }}>
          {isAdmin && (
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: 220 }}>
              <option value="">Tất cả</option>
              <option value="chung">Khoản chung (giáo xứ)</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button className="btn ghost" disabled={shown.length === 0} onClick={() => exportXlsx({ filename: `thu-chi-${fileSlug(subLabel)}.xlsx`, sheetName: 'Thu chi', ...meta })}>⬇ Excel</button>
          <button className="btn ghost" disabled={shown.length === 0} onClick={() => exportPdf(meta)}>🖨 PDF</button>
        </div>
        <table>
          <thead><tr><th>Ngày</th><th>Nội dung</th><th>Lớp</th><th style={{ textAlign: 'right' }}>Thu</th><th style={{ textAlign: 'right' }}>Chi</th><th></th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.content}{t.note ? <span className="muted"> · {t.note}</span> : ''}</td>
                <td>{t.class_name || <span className="muted">Chung</span>}</td>
                <td style={{ textAlign: 'right', color: 'var(--success)' }}>{t.type === 'thu' ? fmt(t.amount) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{t.type === 'chi' ? fmt(t.amount) : ''}</td>
                <td style={{ textAlign: 'right' }}>{canDelete(t) ? <button className="btn danger sm" onClick={() => remove(t)}>Xóa</button> : <span className="muted" style={{ fontSize: 12 }}>chỉ xem</span>}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="muted">Chưa có khoản thu chi nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
