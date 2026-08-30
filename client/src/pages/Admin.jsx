import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { isSuperAdmin } from '../lib/superadmin';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—');
const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const METHODS = { bank: 'Chuyển khoản', vietqr: 'VietQR', cash: 'Tiền mặt', other: 'Khác' };
// Gợi ý hạn: 31/07 của niên khóa hiện tại (nếu đã qua tháng 7 thì sang năm sau)
function suggestExpiry() {
  const now = new Date();
  const y = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-07-31`;
}

export default function Admin() {
  const { user } = useAuth();
  if (!isSuperAdmin(user)) return <Navigate to="/" replace />;

  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [qText, setQText] = useState('');
  const [editing, setEditing] = useState(null);     // giáo xứ đang kích hoạt/gia hạn Pro
  const [editParish, setEditParish] = useState(null); // giáo xứ đang sửa tên/giáo phận
  const [payParish, setPayParish] = useState(null);   // ghi thanh toán rời cho giáo xứ
  const [orders, setOrders] = useState([]);           // đơn chờ thanh toán
  const [codes, setCodes] = useState([]);             // mã giảm giá
  const [tiers, setTiers] = useState([]);             // bảng giá
  const [payingOrder, setPayingOrder] = useState(null); // đơn đang đánh dấu đã trả
  const [editCode, setEditCode] = useState(null);     // mã đang tạo/sửa
  const [leads, setLeads] = useState([]);             // đơn liên hệ / đăng ký
  const [grantLead, setGrantLead] = useState(null);   // lead đang cấp tài khoản

  function load() {
    setLoading(true); setErr('');
    api.get('/admin/parishes')
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
    api.get('/admin/payments').then((r) => setPayments(r.data)).catch(() => {});
    api.get('/admin/orders?status=pending').then((r) => setOrders(r.data)).catch(() => {});
    api.get('/admin/codes').then((r) => setCodes(r.data)).catch(() => {});
    api.get('/upgrade/tiers').then((r) => setTiers(r.data)).catch(() => {});
    api.get('/admin/leads').then((r) => setLeads(r.data)).catch(() => {});
  }
  function loadLeads() { api.get('/admin/leads').then((r) => setLeads(r.data)).catch(() => {}); }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((p) =>
      [p.name, p.diocese, p.admin_email, p.admin_name].some((x) => (x || '').toLowerCase().includes(t)));
  }, [rows, qText]);

  const now = Date.now();
  const daysLeft = (p) => (p.plan_expires_at ? Math.ceil((new Date(p.plan_expires_at).getTime() - now) / 86400000) : null);

  const stats = useMemo(() => {
    const pro = rows.filter((p) => p.plan === 'pro');
    const proActive = pro.filter((p) => !p.plan_expires_at || new Date(p.plan_expires_at).getTime() >= now);
    const sum = (k) => rows.reduce((a, p) => a + (p[k] || 0), 0);
    // đăng ký 6 tháng gần nhất
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: `${m.getMonth() + 1}/${String(m.getFullYear()).slice(2)}`, count: 0 });
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    rows.forEach((p) => { const k = String(p.created_at || '').slice(0, 7); if (k in idx) months[idx[k]].count += 1; });
    return {
      total: rows.length, proActive: proActive.length, free: rows.length - pro.length,
      students: sum('students'), teachers: sum('teachers'), classes: sum('classes'), months,
    };
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pro sắp hết hạn (<=30 ngày) hoặc đã hết hạn — để nhắc gia hạn
  const expiring = useMemo(() =>
    rows.filter((p) => p.plan === 'pro' && p.plan_expires_at)
      .map((p) => ({ ...p, dleft: daysLeft(p) }))
      .filter((p) => p.dleft !== null && p.dleft <= 30)
      .sort((a, b) => a.dleft - b.dleft),
    [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setPlan(parish, plan, plan_expires_at, payment) {
    try {
      await api.post('/admin/set-plan', { parish_id: parish.id, plan, plan_expires_at });
      if (payment && Number(payment.amount) > 0) {
        await api.post('/admin/payment', { parish_id: parish.id, ...payment });
      }
      setEditing(null);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Thao tác thất bại');
    }
  }

  async function saveParish(parish, patch) {
    try {
      await api.post('/admin/update-parish', { parish_id: parish.id, ...patch });
      setEditParish(null); load();
    } catch (e) { alert(e.response?.data?.error || 'Lưu thất bại'); }
  }

  async function removeParish(parish) {
    if (!confirm(`XOÁ giáo xứ "${parish.name}"?\nToàn bộ lớp, học viên, tài khoản GLV của giáo xứ này sẽ bị xoá theo. Không thể hoàn tác.`)) return;
    try { await api.post('/admin/delete-parish', { parish_id: parish.id }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Xoá thất bại'); }
  }

  async function addPayment(parish, payment) {
    try {
      await api.post('/admin/payment', { parish_id: parish.id, ...payment });
      setPayParish(null);
      api.get('/admin/payments').then((r) => setPayments(r.data)).catch(() => {});
    } catch (e) { alert(e.response?.data?.error || 'Ghi thất bại'); }
  }

  async function removePayment(id) {
    if (!confirm('Xoá dòng thanh toán này?')) return;
    try {
      await api.post('/admin/payment-delete', { id });
      setPayments((ps) => ps.filter((p) => p.id !== id));
    } catch (e) { alert(e.response?.data?.error || 'Xoá thất bại'); }
  }

  const totalRevenue = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);

  async function markOrderPaid(order, plan_expires_at) {
    try {
      await api.post('/admin/order-paid', { id: order.id, plan_expires_at });
      setPayingOrder(null); load();
    } catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }
  async function cancelOrder(order) {
    if (!confirm(`Huỷ đơn ${order.order_code}?`)) return;
    try { await api.post('/admin/order-cancel', { id: order.id }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }
  async function saveCode(c) {
    try { await api.post('/admin/code', c); setEditCode(null); api.get('/admin/codes').then((r) => setCodes(r.data)); }
    catch (e) { alert(e.response?.data?.error || 'Lưu mã thất bại'); }
  }
  async function deleteCode(code) {
    if (!confirm(`Xoá mã "${code}"?`)) return;
    try { await api.post('/admin/code-delete', { code }); setCodes((cs) => cs.filter((x) => x.code !== code)); }
    catch (e) { alert(e.response?.data?.error || 'Xoá thất bại'); }
  }
  async function saveTier(id, patch) {
    try { await api.post('/admin/tier', { id, ...patch }); api.get('/upgrade/tiers').then((r) => setTiers(r.data)); }
    catch (e) { alert(e.response?.data?.error || 'Lưu giá thất bại'); }
  }
  async function grantAccount(lead, form) {
    try {
      await api.post('/admin/grant-account', { lead_id: lead.id, email: form.email, full_name: form.full_name, parish_name: form.parish_name, diocese: form.diocese });
      setGrantLead(null); loadLeads();
      alert('Đã gửi email mời tới ' + form.email + '. Người dùng bấm link trong email để đặt mật khẩu và đăng nhập.');
    } catch (e) { alert(e.response?.data?.error || 'Cấp tài khoản thất bại'); }
  }
  async function setLeadStatus(lead, status) {
    try { await api.post('/admin/lead-status', { id: lead.id, status }); loadLeads(); }
    catch (e) { alert(e.response?.data?.error || 'Thất bại'); }
  }
  async function deleteLead(lead) {
    if (!confirm('Xoá đơn này?')) return;
    try { await api.post('/admin/lead-delete', { id: lead.id }); setLeads((ls) => ls.filter((x) => x.id !== lead.id)); }
    catch (e) { alert(e.response?.data?.error || 'Xoá thất bại'); }
  }
  const newLeads = leads.filter((l) => l.status === 'new').length;

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Quản trị hệ thống</h1>
        <button className="btn ghost" onClick={load}>↻ Tải lại</button>
      </div>

      <div className="admin-kpis" id="sec-overview">
        <div className="panel kpi"><div className="n">{stats.total}</div><div className="l">Giáo xứ</div></div>
        <div className="panel kpi"><div className="n" style={{ color: '#15803d' }}>{stats.proActive}</div><div className="l">Pro còn hạn</div></div>
        <div className="panel kpi"><div className="n">{stats.free}</div><div className="l">Khởi động</div></div>
        <div className="panel kpi"><div className="n">{stats.teachers}</div><div className="l">Giáo lý viên</div></div>
        <div className="panel kpi"><div className="n">{stats.students}</div><div className="l">Học viên</div></div>
        <div className="panel kpi"><div className="n">{stats.classes}</div><div className="l">Lớp học</div></div>
      </div>

      <div className="panel">
        <div className="card-head"><h2 style={{ margin: 0 }}>Đăng ký 6 tháng gần nhất</h2></div>
        <div className="growth-chart">
          {stats.months.map((m) => {
            const max = Math.max(1, ...stats.months.map((x) => x.count));
            return (
              <div className="gc-col" key={m.key}>
                <div className="gc-n">{m.count}</div>
                <div className="gc-bar-wrap"><div className="gc-bar" style={{ height: `${(m.count / max) * 100}%` }} /></div>
                <div className="gc-l">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="panel expiry-panel">
          <div className="card-head"><h2 style={{ margin: 0 }}>⏰ Pro sắp / đã hết hạn ({expiring.length})</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            {expiring.map((p) => (
              <div key={p.id} className="expiry-row">
                <div style={{ flex: 1, minWidth: 160 }}><b>{p.name}</b>{p.diocese && <span className="muted" style={{ fontSize: 12 }}> · {p.diocese}</span>}</div>
                <div style={{ fontSize: 13 }}>
                  {p.dleft < 0
                    ? <span style={{ color: '#b91c1c' }}>Đã hết hạn {fmtDate(p.plan_expires_at)}</span>
                    : <span style={{ color: '#a8641b' }}>Còn {p.dleft} ngày · đến {fmtDate(p.plan_expires_at)}</span>}
                </div>
                <button className="btn ghost sm" onClick={() => setEditing(p)}>Gia hạn</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel" id="sec-leads">
        <div className="card-head"><h2 style={{ margin: 0 }}>Đơn liên hệ &amp; đăng ký dùng thử{newLeads > 0 ? ` (${newLeads} mới)` : ''}</h2></div>
        {leads.length === 0 ? <p className="muted">Chưa có đơn nào.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Ngày</th><th>Loại</th><th>Người gửi</th><th>Giáo xứ</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} style={l.status === 'new' ? { background: 'rgba(180,129,60,.05)' } : undefined}>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                    <td>{l.kind === 'register' ? <span className="plan-badge pro">Đăng ký</span> : <span className="plan-badge free">Liên hệ</span>}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.name || '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{l.email || ''}{l.phone ? ' · ' + l.phone : ''}</div>
                    </td>
                    <td>{l.parish_name || '—'}</td>
                    <td className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{l.note || ''}</td>
                    <td>{l.status === 'granted' ? <span style={{ color: '#15803d', fontSize: 12 }}>Đã cấp ✓</span> : l.status === 'archived' ? <span className="muted" style={{ fontSize: 12 }}>Đã lưu</span> : <span style={{ color: '#a8641b', fontSize: 12 }}>Mới</span>}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {l.status !== 'granted' && <button className="btn sm" disabled={!l.email} onClick={() => setGrantLead(l)}>Cấp tài khoản</button>}
                      <div className="row-links">
                        {l.status === 'new' && <button onClick={() => setLeadStatus(l, 'archived')}>Lưu</button>}
                        <button className="danger" onClick={() => deleteLead(l)}>Xoá</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" id="sec-parishes">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Danh sách giáo xứ</h2>
          <input
            placeholder="Tìm theo tên giáo xứ / email admin…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            style={{ marginLeft: 'auto', minWidth: 240 }}
          />
        </div>

        {err && <div className="error">{err}</div>}
        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">Không có giáo xứ nào.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Giáo xứ</th>
                  <th>Quản trị viên</th>
                  <th style={{ textAlign: 'center' }}>Lớp</th>
                  <th style={{ textAlign: 'center' }}>Học viên</th>
                  <th style={{ textAlign: 'center' }}>GLV</th>
                  <th>Tạo</th>
                  <th>Gói</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const expired = p.plan === 'pro' && p.plan_expires_at && new Date(p.plan_expires_at) < new Date();
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.diocese && <div className="muted" style={{ fontSize: 12 }}>{p.diocese}</div>}
                      </td>
                      <td>
                        <div>{p.admin_name || '—'}</div>
                        {p.admin_email && <div className="muted" style={{ fontSize: 12 }}>{p.admin_email}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{p.classes}</td>
                      <td style={{ textAlign: 'center' }}>{p.students}</td>
                      <td style={{ textAlign: 'center' }}>{p.teachers}</td>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.plan === 'pro' ? (
                          <>
                            <span className={`plan-badge ${expired ? 'expired' : 'pro'}`}>{expired ? 'Pro hết hạn' : 'PRO'}</span>
                            <div className="muted" style={{ fontSize: 11 }}>đến {fmtDate(p.plan_expires_at)}</div>
                          </>
                        ) : (
                          <span className="plan-badge free">Khởi động</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {p.plan === 'pro' ? (
                          <>
                            <button className="btn ghost sm" onClick={() => setEditing(p)}>Gia hạn</button>{' '}
                            <button className="btn danger sm" onClick={() => { if (confirm(`Hủy Pro của "${p.name}"?`)) setPlan(p, 'free'); }}>Hủy Pro</button>
                          </>
                        ) : (
                          <button className="btn sm" onClick={() => setEditing(p)}>Kích hoạt Pro</button>
                        )}
                        <div className="row-links">
                          <button onClick={() => setPayParish(p)}>Ghi TT</button>
                          <button onClick={() => setEditParish(p)}>Sửa</button>
                          <button className="danger" onClick={() => removeParish(p)}>Xoá</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Thanh toán qua chuyển khoản / VietQR. Sau khi nhận đủ tiền, bấm <b>Kích hoạt Pro</b> và chọn hạn (cuối niên khóa).
        </p>
      </div>

      <div className="panel" id="sec-orders">
        <div className="card-head"><h2 style={{ margin: 0 }}>🧾 Đơn chờ thanh toán ({orders.length})</h2></div>
        {orders.length === 0 ? <p className="muted">Không có đơn nào đang chờ.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Mã đơn</th><th>Giáo xứ</th><th>Gói</th><th>Mã GG</th><th style={{ textAlign: 'right' }}>Số tiền</th><th>Ngày</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.order_code}</td>
                    <td>{o.parish_name}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{o.tier_label}</td>
                    <td>{o.discount_code || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtVnd(o.final_amount)}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn sm" onClick={() => setPayingOrder(o)}>Đã trả → Kích hoạt</button>
                      <div className="row-links"><button className="danger" onClick={() => cancelOrder(o)}>Huỷ đơn</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" id="sec-payments">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Sổ thanh toán</h2>
          <span className="muted" style={{ marginLeft: 'auto' }}>Tổng thu: <b style={{ color: '#15803d' }}>{fmtVnd(totalRevenue)}</b></span>
        </div>
        {payments.length === 0 ? (
          <p className="muted">Chưa có khoản thu nào. Bấm <b>Ghi TT</b> ở một giáo xứ để thêm.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Ngày</th><th>Giáo xứ</th><th style={{ textAlign: 'right' }}>Số tiền</th>
                  <th>Phương thức</th><th>Mã GG</th><th>Ghi chú</th><th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(p.paid_at)}</td>
                    <td>{p.parish_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtVnd(p.amount)}</td>
                    <td>{METHODS[p.method] || p.method || '—'}</td>
                    <td>{p.discount_code || '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{p.note || ''}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn danger sm" onClick={() => removePayment(p.id)}>Xoá</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" id="sec-codes">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Mã giảm giá</h2>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setEditCode({ code: '', kind: 'percent', value: '', expires_at: '', max_uses: '', active: true, note: '' })}>+ Tạo mã</button>
        </div>
        {codes.length === 0 ? <p className="muted">Chưa có mã giảm giá.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Mã</th><th>Giảm</th><th>Hạn</th><th style={{ textAlign: 'center' }}>Đã dùng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code}>
                    <td style={{ fontWeight: 600 }}>{c.code}</td>
                    <td>{c.kind === 'percent' ? c.value + '%' : fmtVnd(c.value)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{c.expires_at ? fmtDate(c.expires_at) : 'Không hạn'}</td>
                    <td style={{ textAlign: 'center' }}>{c.used_count}{c.max_uses ? ' / ' + c.max_uses : ''}</td>
                    <td>{c.active ? <span className="plan-badge pro">Bật</span> : <span className="plan-badge free">Tắt</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => setEditCode({ ...c, expires_at: c.expires_at || '', max_uses: c.max_uses ?? '' })}>Sửa</button>{' '}
                      <button className="btn danger sm" onClick={() => deleteCode(c.code)}>Xoá</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" id="sec-tiers">
        <div className="card-head"><h2 style={{ margin: 0 }}>Bảng giá gói Pro</h2></div>
        <div className="stack" style={{ gap: 10 }}>
          {tiers.map((t) => <TierRow key={t.id} tier={t} onSave={(patch) => saveTier(t.id, patch)} />)}
          {tiers.length === 0 && <p className="muted">Chưa tải được bảng giá.</p>}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Để trống ô giá = "Liên hệ" (không tạo QR).</p>
      </div>

      {editing && <ActivateModal parish={editing} onClose={() => setEditing(null)} onConfirm={(exp, payment) => setPlan(editing, 'pro', exp, payment)} />}
      {editParish && <EditParishModal parish={editParish} onClose={() => setEditParish(null)} onSave={(patch) => saveParish(editParish, patch)} />}
      {payParish && <PaymentModal parish={payParish} onClose={() => setPayParish(null)} onSave={(payment) => addPayment(payParish, payment)} />}
      {payingOrder && <OrderPaidModal order={payingOrder} onClose={() => setPayingOrder(null)} onConfirm={(exp) => markOrderPaid(payingOrder, exp)} />}
      {editCode && <CodeModal code={editCode} onClose={() => setEditCode(null)} onSave={saveCode} />}
      {grantLead && <GrantModal lead={grantLead} onClose={() => setGrantLead(null)} onConfirm={(form) => grantAccount(grantLead, form)} />}
    </div>
  );
}

function GrantModal({ lead, onClose, onConfirm }) {
  const [f, setF] = useState({ email: lead.email || '', full_name: lead.name || '', parish_name: lead.parish_name || '', diocese: '' });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Cấp tài khoản dùng thử</h2>
        <p className="muted" style={{ marginTop: 0 }}>Tạo giáo xứ + tài khoản quản trị theo email này, rồi gửi email mời để người dùng tự đặt mật khẩu và đăng nhập.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label>Email *</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field" style={{ flex: 2 }}><label>Họ tên quản trị</label><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label>Tên giáo xứ *</label><input value={f.parish_name} onChange={(e) => setF({ ...f, parish_name: e.target.value })} placeholder="VD: Giáo xứ Tân Định" /></div>
          <div className="field" style={{ flex: 1 }}><label>Giáo phận</label><input value={f.diocese} onChange={(e) => setF({ ...f, diocese: e.target.value })} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" onClick={() => (f.email.trim() && f.parish_name.trim() ? onConfirm(f) : alert('Cần email và tên giáo xứ'))}>Gửi lời mời</button>
        </div>
      </div>
    </div>
  );
}

function TierRow({ tier, onSave }) {
  const [label, setLabel] = useState(tier.label || '');
  const [price, setPrice] = useState(tier.price ?? '');
  const dirty = label !== (tier.label || '') || String(price) !== String(tier.price ?? '');
  return (
    <div className="tier-row">
      <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Liên hệ" style={{ width: 130 }} />
      <span className="muted" style={{ fontSize: 12 }}>đ/niên khóa</span>
      <button className="btn sm" disabled={!dirty} onClick={() => onSave({ label: label.trim(), price: price === '' ? null : Number(price) })}>Lưu</button>
    </div>
  );
}

function OrderPaidModal({ order, onClose, onConfirm }) {
  const [exp, setExp] = useState(suggestExpiry());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Xác nhận đã thanh toán</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Đơn <b>{order.order_code}</b> · {order.parish_name} · <b>{fmtVnd(order.final_amount)}</b>{order.discount_code ? ` · mã ${order.discount_code}` : ''}.
          Kích hoạt Pro cho giáo xứ + ghi vào sổ thu.
        </p>
        <div className="field"><label>Hạn gói (đến hết ngày)</label><input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" onClick={() => onConfirm(exp || null)}>Kích hoạt Pro</button>
        </div>
      </div>
    </div>
  );
}

function CodeModal({ code, onClose, onSave }) {
  const [c, setC] = useState(code);
  const isNew = !code.code;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{isNew ? 'Tạo mã giảm giá' : `Sửa mã ${code.code}`}</h2>
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Mã</label>
            <input value={c.code} disabled={!isNew} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="VD: HE2026" /></div>
          <div className="field"><label>Kiểu</label>
            <select value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value })}>
              <option value="percent">Giảm %</option><option value="amount">Giảm số tiền</option>
            </select></div>
          <div className="field"><label>Giá trị</label>
            <input type="number" value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} placeholder={c.kind === 'percent' ? '10' : '200000'} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Hạn dùng (để trống = không hạn)</label>
            <input type="date" value={c.expires_at} onChange={(e) => setC({ ...c, expires_at: e.target.value })} /></div>
          <div className="field"><label>Số lần dùng tối đa</label>
            <input type="number" value={c.max_uses} onChange={(e) => setC({ ...c, max_uses: e.target.value })} placeholder="Không giới hạn" /></div>
          <div className="field"><label>Trạng thái</label>
            <select value={c.active ? '1' : '0'} onChange={(e) => setC({ ...c, active: e.target.value === '1' })}>
              <option value="1">Bật</option><option value="0">Tắt</option>
            </select></div>
        </div>
        <div className="field"><label>Ghi chú</label><input value={c.note || ''} onChange={(e) => setC({ ...c, note: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <button className="btn" onClick={() => (c.code.trim() ? onSave(c) : alert('Nhập mã'))}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

// Ô nhập thông tin thanh toán (dùng chung khi kích hoạt Pro và khi ghi TT rời)
function PaymentFields({ pay, set }) {
  return (
    <>
      <div className="row">
        <div className="field"><label>Số tiền (VND)</label>
          <input type="number" value={pay.amount} onChange={(e) => set({ ...pay, amount: e.target.value })} placeholder="1500000" /></div>
        <div className="field"><label>Phương thức</label>
          <select value={pay.method} onChange={(e) => set({ ...pay, method: e.target.value })}>
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
      <div className="row">
        <div className="field"><label>Ngày nhận</label>
          <input type="date" value={pay.paid_at} onChange={(e) => set({ ...pay, paid_at: e.target.value })} /></div>
        <div className="field"><label>Mã giảm giá (nếu có)</label>
          <input value={pay.discount_code} onChange={(e) => set({ ...pay, discount_code: e.target.value })} placeholder="—" /></div>
      </div>
      <div className="field"><label>Ghi chú</label>
        <input value={pay.note} onChange={(e) => set({ ...pay, note: e.target.value })} /></div>
    </>
  );
}

const emptyPay = () => ({ amount: '', method: 'bank', paid_at: new Date().toISOString().slice(0, 10), discount_code: '', note: '' });

function ActivateModal({ parish, onClose, onConfirm }) {
  const [exp, setExp] = useState(parish.plan_expires_at ? parish.plan_expires_at.slice(0, 10) : suggestExpiry());
  const [pay, setPay] = useState(emptyPay());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Kích hoạt / gia hạn Pro — {parish.name}</h2>
        <div className="field">
          <label>Hạn gói (đến hết ngày)</label>
          <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Để trống nếu muốn Pro không giới hạn thời gian.</p>
        </div>
        <div className="form-section">Ghi nhận thanh toán (nhập số tiền để lưu vào sổ; để trống nếu không ghi)</div>
        <PaymentFields pay={pay} set={setPay} />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn" onClick={() => onConfirm(exp || null, pay)}>Kích hoạt Pro</button>
        </div>
      </div>
    </div>
  );
}

function EditParishModal({ parish, onClose, onSave }) {
  const [name, setName] = useState(parish.name || '');
  const [diocese, setDiocese] = useState(parish.diocese || '');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Sửa giáo xứ</h2>
        <div className="field"><label>Tên giáo xứ</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Giáo phận</label><input value={diocese} onChange={(e) => setDiocese(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn" onClick={() => name.trim() && onSave({ name: name.trim(), diocese: diocese.trim() })}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ parish, onClose, onSave }) {
  const [pay, setPay] = useState(emptyPay());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Ghi thanh toán — {parish.name}</h2>
        <PaymentFields pay={pay} set={setPay} />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn" onClick={() => (Number(pay.amount) > 0 ? onSave(pay) : alert('Nhập số tiền'))}>Lưu</button>
        </div>
      </div>
    </div>
  );
}
