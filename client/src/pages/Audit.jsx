import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { exportXlsx, exportPdf, STT_COL, fileSlug } from '../lib/exportUtils';
import { IconDownload, IconPrinter } from '../components/Icons.jsx';
import { viDate } from '../lib/date';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';

const p2 = (n) => String(n).padStart(2, '0');
// Ngày theo giờ máy (Việt Nam), không dùng toISOString (giờ UTC, trước 7 giờ sáng bị lùi một ngày)
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const today = () => ymd(new Date());
const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN');
const signed = (n) => `${n >= 0 ? '+' : ''}${fmt(n)}`;
// Bỏ dấu để tìm kiếm
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const monthLabel = (date) => { const [y, m] = String(date).split('-'); return `Tháng ${Number(m)}/${y}`; };
// Lỗi RLS / không có dòng nào -> câu dễ hiểu
const txErr = (e, fallback) => {
  const m = e?.response?.data?.error || '';
  if (/row-level security|violates|quyền/i.test(m)) return m.includes('quyền') ? m : 'Bạn không có quyền với khoản này. Giáo lý viên ghi cho lớp mình phụ trách, quản trị viên ghi khoản chung của giáo xứ.';
  return m || fallback;
};
const PERIODS = [
  { k: 'month', l: 'Tháng này' }, { k: 'quarter', l: '3 tháng' }, { k: 'year', l: 'Năm nay' }, { k: 'all', l: 'Tất cả' }, { k: 'range', l: 'Khoảng ngày' },
];
function periodRange(k, from, to) {
  const d = new Date();
  if (k === 'month') return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ''];
  if (k === 'quarter') return [ymd(new Date(d.getFullYear(), d.getMonth() - 2, 1)), ''];
  if (k === 'year') return [`${d.getFullYear()}-01-01`, ''];
  if (k === 'range') return [from || '', to || ''];
  return ['', ''];
}

/* Ô tiền Việt: gõ 500000 hay 500.000 đều ra 500.000; chỉ nhận chữ số */
function MoneyInput({ value, onChange, onEnter, autoFocus }) {
  return (
    <div className="aux-money">
      <input inputMode="numeric" autoFocus={autoFocus} value={value ? fmt(value) : ''} placeholder="0"
        onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '').slice(0, 13)); onChange(n || ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }} aria-label="Số tiền" />
      <span>đ</span>
    </div>
  );
}
function TypeSwitch({ value, onChange }) {
  return (
    <div className="aux-type" role="radiogroup" aria-label="Loại">
      <button type="button" role="radio" aria-checked={value === 'thu'} className={value === 'thu' ? 'on thu' : ''} onClick={() => onChange('thu')}>Thu</button>
      <button type="button" role="radio" aria-checked={value === 'chi'} className={value === 'chi' ? 'on chi' : ''} onClick={() => onChange('chi')}>Chi</button>
    </div>
  );
}

export default function Audit() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [classes, setClasses] = useState([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fType, setFType] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ content: '', type: 'thu', amount: '', date: today(), class_id: '', note: '' });
  const [adding, setAdding] = useState(false);
  const busy = useRef(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)).catch(() => {}).finally(() => setClassesLoaded(true)); }, []);
  function load() { api.get('/transactions').then((r) => setRows(r.data)).catch((e) => toast.err(txErr(e, 'Không tải được danh sách thu chi'))).finally(() => setLoaded(true)); }
  useEffect(() => { load(); }, []);
  // GLV: mặc định lớp đầu tiên mình phụ trách
  useEffect(() => {
    if (!isAdmin && classes.length && !form.class_id) setForm((f) => ({ ...f, class_id: classes[0].id }));
  }, [classes, isAdmin]); // eslint-disable-line

  const className = (id) => classes.find((c) => c.id === id)?.name || '';
  // Phạm vi theo lớp (dùng để tính số dư); kỳ / loại / tìm kiếm chỉ lọc phần hiển thị
  const scope = useMemo(() => (filterClass
    ? (filterClass === 'chung' ? rows.filter((r) => !r.class_id) : rows.filter((r) => r.class_id === filterClass))
    : rows), [rows, filterClass]);
  // Số dư sau mỗi khoản: cộng dồn theo thứ tự thời gian trong phạm vi lớp
  const runBal = useMemo(() => {
    const asc = [...scope].sort((a, b) => (a.date === b.date ? String(a.created_at).localeCompare(String(b.created_at)) : String(a.date).localeCompare(String(b.date))));
    const m = {}; let b = 0;
    asc.forEach((r) => { b += r.type === 'thu' ? Number(r.amount) : -Number(r.amount); m[r.id] = b; });
    return m;
  }, [scope]);
  const [pFrom, pTo] = periodRange(period, from, to);
  const inPeriod = (r) => (!pFrom || r.date >= pFrom) && (!pTo || r.date <= pTo);
  const periodRows = scope.filter(inPeriod);
  const fq = fold(q.trim());
  const shown = periodRows.filter((r) => (!fType || r.type === fType) && (!fq || fold(`${r.content} ${r.note || ''}`).includes(fq)));
  const sum = (list, t) => list.filter((r) => r.type === t).reduce((s, r) => s + Number(r.amount), 0);
  const thu = sum(periodRows, 'thu');
  const chi = sum(periodRows, 'chi');
  const before = scope.filter((r) => pFrom && r.date < pFrom);
  const openBal = sum(before, 'thu') - sum(before, 'chi');
  const closeBal = openBal + thu - chi;

  // Admin: thu chi từng lớp trong kỳ đang chọn; bấm vào để lọc lớp đó
  const perClass = isAdmin ? (() => {
    const groups = {};
    rows.filter(inPeriod).forEach((r) => {
      const key = r.class_id || 'chung';
      const g = groups[key] || (groups[key] = { key, name: r.class_name || 'Chung (giáo xứ)', thu: 0, chi: 0 });
      if (r.type === 'thu') g.thu += Number(r.amount); else g.chi += Number(r.amount);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  })() : [];

  // Nhóm danh sách theo tháng (đã sắp mới nhất trước)
  const byMonth = [];
  shown.forEach((r) => {
    const k = String(r.date).slice(0, 7);
    let g = byMonth[byMonth.length - 1];
    if (!g || g.k !== k) { g = { k, label: monthLabel(r.date), items: [] }; byMonth.push(g); }
    g.items.push(r);
  });

  async function add() {
    if (busy.current) return;
    if (!form.content.trim()) { toast.err('Nhập nội dung khoản thu chi'); return; }
    if (!(Number(form.amount) > 0)) { toast.err('Nhập số tiền lớn hơn 0'); return; }
    if (!form.date) { toast.err('Chọn ngày'); return; }
    // Admin chỉ ghi khoản chung (class_id null); GLV ghi cho lớp mình
    const class_id = isAdmin ? null : form.class_id;
    busy.current = true; setAdding(true);
    try {
      await api.post('/transactions', { ...form, content: form.content.trim(), note: form.note.trim(), class_id, amount: Number(form.amount) });
      toast(`Đã ghi ${form.type === 'thu' ? 'khoản thu' : 'khoản chi'} ${fmt(form.amount)}đ`);
      setForm((f) => ({ ...f, content: '', amount: '', note: '' })); // giữ loại, ngày, lớp để ghi tiếp
      load();
    } catch (e) { toast.err(txErr(e, 'Lưu thất bại')); }
    finally { busy.current = false; setAdding(false); }
  }
  async function remove(t) {
    if (!await confirmDialog(`Xóa khoản ${t.type === 'thu' ? 'thu' : 'chi'} "${t.content}"?\n\n${viDate(t.date)} · ${fmt(t.amount)}đ${t.class_name ? ` · ${t.class_name}` : ''}`)) return;
    try { await api.delete(`/transactions/${t.id}`); toast('Đã xóa khoản thu chi'); load(); }
    catch (e) { toast.err(txErr(e, 'Không xóa được')); }
  }
  // Admin chỉ xem khoản của lớp; GLV sửa/xóa khoản lớp mình
  const canEdit = (t) => !isAdmin || !t.class_id;

  const cols = [
    STT_COL,
    { label: 'Ngày', get: (r) => viDate(r.date), width: 12 },
    { label: 'Nội dung', get: (r) => r.content, width: 30 },
    { label: 'Ghi chú', get: (r) => r.note || '', width: 20 },
    { label: 'Lớp', get: (r) => r.class_name || 'Chung', width: 14 },
    { label: 'Thu', get: (r) => (r.type === 'thu' ? fmt(r.amount) : ''), width: 12 },
    { label: 'Chi', get: (r) => (r.type === 'chi' ? fmt(r.amount) : ''), width: 12 },
    { label: 'Số dư', get: (r) => fmt(runBal[r.id]), width: 13 },
  ];
  const totalsRow = ['', '', 'TỔNG CỘNG', '', '', fmt(sum(shown, 'thu')), fmt(sum(shown, 'chi')), ''];
  const periodLabel = period === 'all' ? 'Từ trước tới nay' : period === 'range' ? `Từ ${pFrom ? viDate(pFrom) : '...'} đến ${pTo ? viDate(pTo) : 'nay'}` : `${PERIODS.find((x) => x.k === period).l} (từ ${viDate(pFrom)})`;
  const scopeLabel = filterClass === 'chung' ? 'Khoản chung' : (filterClass ? `Lớp: ${className(filterClass)}` : (isAdmin ? 'Toàn giáo xứ' : 'Lớp của tôi'));
  const summary = `${pFrom ? `Số dư đầu kỳ: ${fmt(openBal)}đ · ` : ''}Thu ${fmt(thu)}đ · Chi ${fmt(chi)}đ · Số dư cuối kỳ: ${fmt(closeBal)}đ`;
  const meta = { title: 'Bảng thu chi', subtitle: `${scopeLabel} · ${periodLabel}`, columns: cols, rows: shown, totalsRow, summary, align: 'center' };
  const noClass = !isAdmin && classesLoaded && classes.length === 0;
  const showClassFilter = isAdmin || classes.length > 1;

  return (
    <div>
      <PageHeader title={isAdmin ? 'Thu chi giáo xứ' : 'Thu chi lớp'} subtitle={isAdmin ? 'Theo dõi các khoản thu, chi của giáo xứ và từng lớp.' : 'Theo dõi các khoản thu, chi của lớp bạn phụ trách.'} />

      <div className="aux-filters">
        <div className="aux-chips">
          {PERIODS.map((p) => <button key={p.k} type="button" className={`aux-chip${period === p.k ? ' on' : ''}`} onClick={() => setPeriod(p.k)}>{p.l}</button>)}
        </div>
        {period === 'range' && (
          <div className="aux-range">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" />
            <span>đến</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" />
          </div>
        )}
        {showClassFilter && (
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} aria-label="Lọc theo lớp">
            <option value="">{isAdmin ? 'Toàn giáo xứ' : 'Tất cả lớp của tôi'}</option>
            {isAdmin && <option value="chung">Khoản chung (giáo xứ)</option>}
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="audit-summary">
        <div className="audit-card thu"><div className="lbl">Tổng thu</div><div className="num">{fmt(thu)}đ</div></div>
        <div className="audit-card chi"><div className="lbl">Tổng chi</div><div className="num">{fmt(chi)}đ</div></div>
        <div className={`audit-card ${closeBal >= 0 ? 'duong' : 'am'}`}>
          <div className="lbl">{pFrom ? 'Số dư cuối kỳ' : 'Số dư quỹ'}</div>
          <div className="num">{signed(closeBal)}đ</div>
          <div className="tag">{pFrom ? `Đầu kỳ ${signed(openBal)}đ · trong kỳ ${signed(thu - chi)}đ` : (closeBal >= 0 ? 'Đang dương' : 'Đang âm')}</div>
        </div>
      </div>

      {/* Admin: thống kê từng lớp */}
      {isAdmin && perClass.length > 0 && (
        <div className="panel">
          <div className="card-head"><h2>Thu chi từng lớp</h2><span className="muted aux-hint">Bấm vào một dòng để xem chi tiết</span></div>
          <table className="aux-perclass">
            <thead><tr><th>Lớp</th><th className="num">Thu</th><th className="num">Chi</th><th className="num">Chênh lệch</th></tr></thead>
            <tbody>
              {perClass.map((g) => {
                const bal = g.thu - g.chi;
                return (
                  <tr key={g.key} className={`click-row${filterClass === g.key ? ' aux-sel' : ''}`} onClick={() => setFilterClass(filterClass === g.key ? '' : g.key)}>
                    <td>{g.name}</td>
                    <td className="num aux-thu">{fmt(g.thu)}</td>
                    <td className="num aux-chi">{fmt(g.chi)}</td>
                    <td className={`num aux-bal ${bal >= 0 ? 'aux-thu' : 'aux-chi'}`}>{signed(bal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form nhập: GLV ghi lớp mình; admin ghi khoản chung */}
      {noClass ? (
        <div className="panel"><p className="muted" style={{ margin: 0 }}>Bạn chưa được phân công lớp nào nên chưa ghi thu chi được. Nhờ quản trị viên phân lớp ở trang Lớp học.</p></div>
      ) : (
        <div className="panel">
          <h2 className="aux-h">Ghi khoản mới {isAdmin && <span className="muted">(khoản chung của giáo xứ)</span>}</h2>
          <div className="aux-form">
            <div className="field aux-f-type"><label>Loại</label><TypeSwitch value={form.type} onChange={(v) => setForm({ ...form, type: v })} /></div>
            <div className="field aux-f-content"><label>Nội dung</label>
              <input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={form.type === 'thu' ? 'VD: Thu quỹ lớp tháng 10' : 'VD: Mua quà Giáng Sinh'} maxLength={200} />
            </div>
            <div className="field aux-f-amount"><label>Số tiền</label><MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} onEnter={add} /></div>
            <div className="field aux-f-date"><label>Ngày</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            {!isAdmin && classes.length > 1 && (
              <div className="field aux-f-class"><label>Lớp</label>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="field aux-f-note"><label>Ghi chú <span className="muted">(tùy chọn)</span></label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="VD: 25 em nộp, còn 3 em chưa nộp" maxLength={300} />
            </div>
            <div className="field aux-f-btn"><button className={`btn ${form.type === 'chi' ? 'aux-btn-chi' : ''}`} onClick={add} disabled={adding}>{adding ? 'Đang ghi…' : form.type === 'thu' ? '+ Ghi khoản thu' : '+ Ghi khoản chi'}</button></div>
          </div>
        </div>
      )}

      {/* Danh sách */}
      <div className="panel">
        <div className="aux-listbar">
          <input type="search" className="aux-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nội dung, ghi chú…" aria-label="Tìm khoản thu chi" />
          <div className="aux-chips">
            {[['', 'Thu và chi'], ['thu', 'Chỉ thu'], ['chi', 'Chỉ chi']].map(([k, l]) => <button key={k} type="button" className={`aux-chip${fType === k ? ' on' : ''}`} onClick={() => setFType(k)}>{l}</button>)}
          </div>
          <span className="aux-spacer" />
          <button className="btn ghost sm" disabled={shown.length === 0} onClick={() => exportXlsx({ filename: `thu-chi-${fileSlug(scopeLabel)}.xlsx`, sheetName: 'Thu chi', ...meta })}><IconDownload className="bi" />Excel</button>
          <button className="btn ghost sm" disabled={shown.length === 0} onClick={() => exportPdf(meta)}><IconPrinter className="bi" />PDF</button>
        </div>
        <table className="aux-table">
          <thead><tr><th>Ngày</th><th>Nội dung</th>{(isAdmin || classes.length > 1) && <th>Lớp</th>}<th className="num">Thu</th><th className="num">Chi</th><th className="num">Số dư</th><th></th></tr></thead>
          <tbody>
            {!loaded && <tr><td colSpan={7} className="muted">Đang tải…</td></tr>}
            {byMonth.map((g) => (
              <MonthGroup key={g.k} g={g} showClass={isAdmin || classes.length > 1} runBal={runBal} canEdit={canEdit} onEdit={setEditing} onRemove={remove} sum={sum} />
            ))}
            {loaded && shown.length === 0 && <tr className="aux-empty"><td colSpan={7} className="muted">{rows.length ? 'Không có khoản nào khớp bộ lọc.' : 'Chưa có khoản thu chi nào.'}</td></tr>}
          </tbody>
        </table>
        {filterClass === '' && isAdmin && <p className="muted aux-hint">Cột "Số dư" cộng dồn toàn giáo xứ. Chọn một lớp để xem số dư quỹ riêng của lớp đó.</p>}
      </div>

      {editing && <EditModal tx={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function MonthGroup({ g, showClass, runBal, canEdit, onEdit, onRemove, sum }) {
  return (
    <>
      <tr className="aux-month">
        <td colSpan={showClass ? 3 : 2}>{g.label}</td>
        <td className="num aux-thu">{sum(g.items, 'thu') ? fmt(sum(g.items, 'thu')) : ''}</td>
        <td className="num aux-chi">{sum(g.items, 'chi') ? fmt(sum(g.items, 'chi')) : ''}</td>
        <td colSpan={2} />
      </tr>
      {g.items.map((t) => (
        <tr key={t.id} className="aux-row">
          <td className="aux-c-date">{viDate(t.date)}</td>
          <td className="aux-c-content">{t.content}{t.note && <small className="muted">{t.note}</small>}</td>
          {showClass && <td data-label="Lớp">{t.class_name || <span className="muted">Chung</span>}</td>}
          <td className="num aux-thu" data-label="Thu">{t.type === 'thu' ? fmt(t.amount) : ''}</td>
          <td className="num aux-chi" data-label="Chi">{t.type === 'chi' ? fmt(t.amount) : ''}</td>
          <td className="num aux-bal" data-label="Số dư">{fmt(runBal[t.id])}</td>
          <td className="aux-c-act">
            {canEdit(t)
              ? <span className="row-links"><button onClick={() => onEdit(t)}>Sửa</button><button className="danger" onClick={() => onRemove(t)}>Xóa</button></span>
              : <span className="muted aux-hint" title="Khoản của lớp do giáo lý viên lớp đó quản lý">chỉ xem</span>}
          </td>
        </tr>
      ))}
    </>
  );
}

function EditModal({ tx, onClose, onSaved }) {
  const init = { content: tx.content, type: tx.type, amount: Number(tx.amount), date: tx.date, note: tx.note || '' };
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  async function close() {
    if (busy.current) return;
    if (dirty && !(await confirmDialog('Bỏ các thay đổi chưa lưu?'))) return;
    onClose();
  }
  async function save() {
    if (busy.current) return;
    if (!f.content.trim()) { toast.err('Nhập nội dung'); return; }
    if (!(Number(f.amount) > 0)) { toast.err('Nhập số tiền lớn hơn 0'); return; }
    busy.current = true; setSaving(true);
    try { await api.put(`/transactions/${tx.id}`, { ...f, content: f.content.trim(), note: f.note.trim() }); toast('Đã lưu khoản thu chi'); onSaved(); }
    catch (e) { toast.err(txErr(e, 'Lưu thất bại')); }
    finally { busy.current = false; setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="auxEditT">
        <h2 id="auxEditT">Sửa khoản thu chi</h2>
        {tx.class_name && <p className="muted" style={{ marginTop: -6 }}>Lớp: <b>{tx.class_name}</b></p>}
        <div className="field"><label>Loại</label><TypeSwitch value={f.type} onChange={(v) => setF({ ...f, type: v })} /></div>
        <div className="field"><label>Nội dung</label><input value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} maxLength={200} /></div>
        <div className="aux-grid2">
          <div className="field"><label>Số tiền</label><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} onEnter={save} /></div>
          <div className="field"><label>Ngày</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        </div>
        <div className="field"><label>Ghi chú</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={close} disabled={saving}>Hủy</button>
          <button className="btn" onClick={save} disabled={saving || !dirty}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}
