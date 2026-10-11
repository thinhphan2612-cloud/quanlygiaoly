import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { viError } from '../lib/viError';
import { useAuth } from '../auth.jsx';
import { isSuperAdmin } from '../lib/superadmin';
import { supabase } from '../supabase';
import { exportXlsx } from '../lib/exportUtils';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '-');
const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const METHODS = { bank: 'Chuyển khoản', vietqr: 'VietQR', cash: 'Tiền mặt', other: 'Khác' };
const DAY = 86400000;
const daysTo = (s) => Math.ceil((new Date(s).getTime() - Date.now()) / DAY);
const errMsg = (e, fallback) => e?.response?.data?.error || e?.message || fallback;
// Tên bậc trong DB còn dạng "Giáo xứ nhỏ — tối đa 5 lớp": hiển thị bằng dấu phẩy.
const tierLabel = (s) => (s || '').replace(/\s*—\s*/g, ', ');
// Đơn liên hệ cần admin làm gì đó: liên hệ chưa xử lý, hoặc đăng ký tự động chưa gửi được mời.
const leadNeedsAction = (l) => (l.kind === 'register' ? ['rate', 'error'].includes(l.status) : l.status === 'new');
// Gợi ý hạn: 31/07 của niên khóa hiện tại (nếu đã qua tháng 7 thì sang năm sau)
function suggestExpiry() {
  const now = new Date();
  const y = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-07-31`;
}
// Chu kỳ mới 1 năm (365 ngày) tính từ hôm nay — kiểu Apple.
function freshExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 365);
  return d.toISOString().slice(0, 10);
}
// Niên khóa bắt đầu 01/08. offset = 0: niên khóa hiện tại, -1: niên khóa trước.
function schoolYearRange(offset = 0) {
  const now = new Date();
  const y = (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1) + offset;
  return { from: new Date(y, 7, 1), to: new Date(y + 1, 7, 1), label: `${y}-${y + 1}` };
}

const PAGE_SIZE = 5;
// Phân trang phía client: trả về các dòng của trang hiện tại và thanh chuyển trang.
// resetKey đổi (vd ô tìm kiếm) thì quay về trang 1.
function usePaged(list, resetKey) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages); // xóa dòng làm giảm số trang thì tự lùi về trang cuối
  const items = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const pager = pages > 1 && (
    <div className="pager">
      <button className="btn ghost sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>← Trước</button>
      <span className="muted" style={{ fontSize: 13 }}>Trang {cur}/{pages} · {list.length} dòng</span>
      <button className="btn ghost sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Sau →</button>
    </div>
  );
  return [items, pager];
}

// Khóa nút trong lúc gọi server: bấm 2 lần không ghi trùng thanh toán / gửi trùng email.
function useBusy() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(fn) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } finally { lock.current = false; setBusy(false); }
  }
  return [busy, run];
}

// Khung modal dùng chung: bấm ra ngoài KHÔNG đóng (tránh mất dữ liệu đang nhập).
// Esc để đóng; nếu form đã có thay đổi thì hỏi lại trước.
function Modal({ onClose, dirty, wide, style, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && (!dirty || confirm('Bỏ thông tin đang nhập?'))) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dirty]);
  return (
    <div className="modal-backdrop">
      <div className={`modal${wide ? ' wide' : ''}`} style={style}>{children}</div>
    </div>
  );
}

// Ô số liệu bấm được (dùng cho "Việc cần xử lý" và KPI).
function Tile({ className, onClick, children }) {
  return (
    <div className={`panel ${className}`} role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {children}
    </div>
  );
}

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Admin() {
  const { user } = useAuth();
  if (!isSuperAdmin(user)) return <Navigate to="/" replace />;

  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErr, setLoadErr] = useState({});         // lỗi tải theo từng nguồn dữ liệu
  const [qText, setQText] = useState('');
  const [planFilter, setPlanFilter] = useState('all'); // lọc giáo xứ theo gói / bậc
  const [parishSort, setParishSort] = useState('newest');
  const [leadSort, setLeadSort] = useState('newest');
  const [leadView, setLeadView] = useState('all');     // all | todo
  const [leadQ, setLeadQ] = useState('');
  const [payPeriod, setPayPeriod] = useState('all');   // all | sy | prevsy | month
  const [payQ, setPayQ] = useState('');
  const [editing, setEditing] = useState(null);     // giáo xứ đang kích hoạt/gia hạn Pro
  const [editParish, setEditParish] = useState(null); // giáo xứ đang sửa tên/giáo phận
  const [deleting, setDeleting] = useState(null);     // { parish, purge } đang chờ xác nhận xóa
  const [payParish, setPayParish] = useState(null);   // ghi thanh toán rời cho giáo xứ
  const [orders, setOrders] = useState([]);           // đơn chờ thanh toán
  const [codes, setCodes] = useState([]);             // mã giảm giá
  const [tiers, setTiers] = useState([]);             // bảng giá
  const [payingOrder, setPayingOrder] = useState(null); // đơn đang đánh dấu đã trả
  const [editCode, setEditCode] = useState(null);     // mã đang tạo/sửa
  const [leads, setLeads] = useState([]);             // đơn liên hệ / đăng ký
  const [grantLead, setGrantLead] = useState(null);   // lead đang cấp tài khoản
  const [tanthu, setTanthu] = useState(false);        // modal chương trình Tân thủ
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  function notify(text, kind = 'ok') {
    clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = setTimeout(() => setToast(null), kind === 'err' ? 7000 : 3500);
  }

  const SOURCES = {
    parishes: ['/admin/parishes', setRows],
    payments: ['/admin/payments', setPayments],
    orders: ['/admin/orders?status=pending', setOrders],
    codes: ['/admin/codes', setCodes],
    tiers: ['/upgrade/tiers', setTiers],
    leads: ['/admin/leads', setLeads],
  };
  // Tải lại các nguồn (mặc định tất cả). Bảng đang hiện giữ nguyên trong lúc tải nên trang không bị nhảy.
  function refresh(...keys) {
    const list = keys.length ? keys : Object.keys(SOURCES);
    setRefreshing(true);
    return Promise.all(list.map((k) => api.get(SOURCES[k][0])
      .then((r) => { SOURCES[k][1](r.data); setLoadErr((m) => ({ ...m, [k]: '' })); })
      .catch((e) => setLoadErr((m) => ({ ...m, [k]: errMsg(e, 'Không tải được dữ liệu') })))))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const errBox = (k) => loadErr[k] && (
    <div className="error" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      Không tải được dữ liệu: {loadErr[k]}
      <button className="btn ghost sm" onClick={() => refresh(k)}>Thử lại</button>
    </div>
  );

  const overdue = useMemo(() =>
    rows.filter((p) => p.plan === 'pro' && p.plan_expires_at && (Date.now() - new Date(p.plan_expires_at).getTime()) > 30 * DAY)
      .map((p) => ({ ...p, overdays: Math.floor((Date.now() - new Date(p.plan_expires_at).getTime()) / DAY) }))
      .sort((a, b) => b.overdays - a.overdays)
  , [rows]);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    let list = !t ? rows : rows.filter((p) =>
      [p.name, p.diocese, p.admin_email, p.admin_name].some((x) => (x || '').toLowerCase().includes(t)));
    if (planFilter !== 'all') {
      list = list.filter((p) => {
        const max = p.plan_max_classes;
        if (planFilter === 'free') return p.plan !== 'pro';
        if (p.plan !== 'pro') return false;
        const d = p.plan_expires_at ? daysTo(p.plan_expires_at) : null;
        if (planFilter === 'proActive') return d === null || d >= 0;
        if (planFilter === 'proExpired') return d !== null && d < 0;
        if (planFilter === 'expiring') return d !== null && d >= 0 && d <= 30;
        if (planFilter === 'pro5') return max != null && max <= 5;
        if (planFilter === 'pro12') return max != null && max > 5 && max <= 12;
        if (planFilter === 'pro20') return max != null && max > 12 && max <= 20;
        if (planFilter === 'proXL') return max == null || max > 20;
        return true; // 'pro'
      });
    }
    // API đã trả theo ngày tạo mới nhất; sort ổn định nên các giáo xứ bằng nhau vẫn giữ thứ tự đó.
    const by = { classesDesc: (a, b) => b.classes - a.classes, classesAsc: (a, b) => a.classes - b.classes,
      studentsDesc: (a, b) => b.students - a.students, studentsAsc: (a, b) => a.students - b.students }[parishSort];
    return by ? [...list].sort(by) : list;
  }, [rows, qText, planFilter, parishSort]);
  const parishFiltered = qText.trim() !== '' || planFilter !== 'all';

  const now = Date.now();
  const daysLeft = (p) => (p.plan_expires_at ? Math.ceil((new Date(p.plan_expires_at).getTime() - now) / DAY) : null);

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

  // Bấm KPI: áp bộ lọc tương ứng xuống bảng giáo xứ.
  function showParishes(filter) {
    setQText(''); setPlanFilter(filter);
    scrollTo('sec-parishes');
  }

  async function setPlan(parish, plan, plan_expires_at, payment, plan_max_classes) {
    try {
      await api.post('/admin/set-plan', { parish_id: parish.id, plan, plan_expires_at, plan_max_classes: plan_max_classes ?? null });
    } catch (e) { notify(errMsg(e, 'Thao tác thất bại'), 'err'); return; }
    setEditing(null);
    let payNote = '';
    if (payment && Number(payment.amount) > 0) {
      // Gói đã đổi xong; lỗi ghi sổ thì báo riêng để ghi lại bằng "Ghi TT", không mở lại modal (tránh gửi email kích hoạt lần 2).
      try { await api.post('/admin/payment', { parish_id: parish.id, ...payment }); payNote = `, đã ghi ${fmtVnd(payment.amount)} vào sổ thu`; }
      catch (e) {
        notify(`Đã kích hoạt Pro cho ${parish.name} nhưng CHƯA ghi được thanh toán (${errMsg(e, 'lỗi')}). Bấm "Ghi TT" để ghi lại.`, 'err');
        refresh('parishes', 'payments'); return;
      }
    }
    notify(plan === 'pro'
      ? `Đã kích hoạt Pro cho ${parish.name}${plan_expires_at ? ' đến ' + fmtDate(plan_expires_at) : ' (không thời hạn)'}${payNote}.`
      : `Đã hủy Pro của ${parish.name}.`);
    refresh('parishes', 'payments');
  }

  async function cancelPro(parish) {
    if (!confirm(`Hủy Pro của "${parish.name}"?\n\nGiáo xứ về gói Khởi động ngay. Dữ liệu không bị xóa.`)) return;
    await setPlan(parish, 'free');
  }

  async function saveParish(parish, patch) {
    try {
      await api.post('/admin/update-parish', { parish_id: parish.id, ...patch });
      setEditParish(null); notify(`Đã lưu giáo xứ ${patch.name}.`); refresh('parishes');
    } catch (e) { notify(errMsg(e, 'Lưu thất bại'), 'err'); }
  }

  async function deleteParish(parish) {
    try {
      await api.post('/admin/delete-parish', { parish_id: parish.id });
      setDeleting(null); notify(`Đã xóa giáo xứ ${parish.name}.`); refresh();
    } catch (e) { notify(errMsg(e, 'Xóa thất bại'), 'err'); }
  }

  async function addPayment(parish, payment) {
    try {
      await api.post('/admin/payment', { parish_id: parish.id, ...payment });
      setPayParish(null); notify(`Đã ghi ${fmtVnd(payment.amount)} cho ${parish.name}.`); refresh('payments');
    } catch (e) { notify(errMsg(e, 'Ghi thất bại'), 'err'); }
  }

  async function removePayment(p) {
    if (!confirm(`Xóa khoản thu ${fmtVnd(p.amount)} của "${p.parish_name}" ngày ${fmtDate(p.paid_at)}?\n\nTổng thu sẽ giảm tương ứng. Không thể hoàn tác.`)) return;
    try {
      await api.post('/admin/payment-delete', { id: p.id });
      setPayments((ps) => ps.filter((x) => x.id !== p.id)); notify('Đã xóa khoản thu.');
    } catch (e) { notify(errMsg(e, 'Xóa thất bại'), 'err'); }
  }

  async function markOrderPaid(order, plan_expires_at) {
    try {
      await api.post('/admin/order-paid', { id: order.id, plan_expires_at });
      setPayingOrder(null); notify(`Đã kích hoạt Pro cho ${order.parish_name} (đơn ${order.order_code}).`); refresh();
    } catch (e) { notify(errMsg(e, 'Thất bại'), 'err'); }
  }
  async function cancelOrder(order) {
    if (!confirm(`Hủy đơn ${order.order_code} của "${order.parish_name}" (${fmtVnd(order.final_amount)})?`)) return;
    try { await api.post('/admin/order-cancel', { id: order.id }); notify(`Đã hủy đơn ${order.order_code}.`); refresh('orders'); }
    catch (e) { notify(errMsg(e, 'Thất bại'), 'err'); }
  }
  async function saveCode(c) {
    try { await api.post('/admin/code', c); setEditCode(null); notify(`Đã lưu mã ${c.code}.`); refresh('codes'); }
    catch (e) { notify(errMsg(e, 'Lưu mã thất bại'), 'err'); }
  }
  async function deleteCode(code) {
    if (!confirm(`Xóa mã "${code}"?`)) return;
    try { await api.post('/admin/code-delete', { code }); setCodes((cs) => cs.filter((x) => x.code !== code)); notify(`Đã xóa mã ${code}.`); }
    catch (e) { notify(errMsg(e, 'Xóa thất bại'), 'err'); }
  }
  async function saveTier(id, patch) {
    try { await api.post('/admin/tier', { id, ...patch }); notify('Đã lưu bảng giá.'); await refresh('tiers'); }
    catch (e) { notify(errMsg(e, 'Lưu giá thất bại'), 'err'); }
  }
  async function grantAccount(lead, form) {
    try {
      await api.post('/admin/grant-account', { lead_id: lead.id, email: form.email, full_name: form.full_name, parish_name: form.parish_name, diocese: form.diocese });
      setGrantLead(null); refresh('leads', 'parishes');
      notify(`Đã gửi email mời tới ${form.email}. Người dùng bấm link trong email để đặt mật khẩu và đăng nhập.`);
    } catch (e) { notify(errMsg(e, 'Cấp tài khoản thất bại'), 'err'); }
  }
  async function markLeadDone(lead) {
    try { await api.post('/admin/lead-status', { id: lead.id, status: 'archived' }); notify('Đã đánh dấu đã xử lý.'); refresh('leads'); }
    catch (e) { notify(errMsg(e, 'Thất bại'), 'err'); }
  }
  async function deleteLead(lead) {
    if (!confirm(`Xóa đơn của "${lead.name || lead.email || 'không tên'}"?`)) return;
    try { await api.post('/admin/lead-delete', { id: lead.id }); setLeads((ls) => ls.filter((x) => x.id !== lead.id)); notify('Đã xóa đơn.'); }
    catch (e) { notify(errMsg(e, 'Xóa thất bại'), 'err'); }
  }

  const leadTodo = leads.filter(leadNeedsAction).length;
  const leadsShown = useMemo(() => {
    const t = leadQ.trim().toLowerCase();
    const list = leads.filter((l) => (leadView !== 'todo' || leadNeedsAction(l))
      && (!t || [l.name, l.email, l.phone, l.parish_name].some((x) => (x || '').toLowerCase().includes(t))));
    return list.sort((a, b) => {
      const c = String(a.created_at).localeCompare(String(b.created_at));
      return leadSort === 'oldest' ? c : -c;
    });
  }, [leads, leadView, leadQ, leadSort]);

  const paymentsShown = useMemo(() => {
    const t = payQ.trim().toLowerCase();
    let range = null;
    if (payPeriod === 'sy') range = schoolYearRange(0);
    if (payPeriod === 'prevsy') range = schoolYearRange(-1);
    if (payPeriod === 'month') { const d = new Date(); range = { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) }; }
    return payments.filter((p) => {
      if (t && !(p.parish_name || '').toLowerCase().includes(t)) return false;
      if (!range) return true;
      const d = new Date(p.paid_at);
      return d >= range.from && d < range.to;
    });
  }, [payments, payPeriod, payQ]);
  const totalRevenue = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const shownRevenue = paymentsShown.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const payFiltered = payPeriod !== 'all' || payQ.trim() !== '';

  function exportPayments() {
    const PERIOD = { all: 'Toàn thời gian', sy: `Niên khóa ${schoolYearRange(0).label}`, prevsy: `Niên khóa ${schoolYearRange(-1).label}`, month: 'Tháng này' };
    exportXlsx({
      filename: `so-thanh-toan-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Sổ thanh toán',
      title: 'SỔ THANH TOÁN',
      subtitle: [PERIOD[payPeriod] + (payQ.trim() ? ` · lọc: ${payQ.trim()}` : ''), `Xuất ngày ${fmtDate(new Date())}`],
      columns: [
        { label: 'Ngày', get: (p) => fmtDate(p.paid_at), width: 12 },
        { label: 'Giáo xứ', get: (p) => p.parish_name || '', width: 32 },
        { label: 'Số tiền (đ)', get: (p) => Number(p.amount) || 0, width: 14 },
        { label: 'Phương thức', get: (p) => METHODS[p.method] || p.method || '', width: 14 },
        { label: 'Mã giảm giá', get: (p) => p.discount_code || '', width: 14 },
        { label: 'Ghi chú', get: (p) => p.note || '', width: 40 },
      ],
      rows: paymentsShown,
      totalsRow: ['Tổng', '', shownRevenue],
    });
  }

  const [expiringPage, expiringPager] = usePaged(expiring);
  const [leadsPage, leadsPager] = usePaged(leadsShown, `${leadView}|${leadQ}|${leadSort}`);
  const [parishPage, parishPager] = usePaged(filtered, `${qText}|${planFilter}|${parishSort}`);
  const [overduePage, overduePager] = usePaged(overdue);
  const [ordersPage, ordersPager] = usePaged(orders);
  const [paymentsPage, paymentsPager] = usePaged(paymentsShown, `${payPeriod}|${payQ}`);
  const [codesPage, codesPager] = usePaged(codes);

  const todo = [
    { n: orders.length, l: 'Đơn chờ thanh toán', go: () => scrollTo('sec-orders') },
    { n: leadTodo, l: 'Đơn liên hệ cần xử lý', go: () => { setLeadView('todo'); scrollTo('sec-leads'); } },
    { n: expiring.length, l: 'Pro sắp / đã hết hạn', go: () => scrollTo('sec-expiring') },
    { n: overdue.length, l: 'Quá hạn trên 30 ngày', go: () => scrollTo('sec-purge') },
  ];

  return (
    <div className="admin-page">
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Quản trị hệ thống</h1>
        <button className="btn ghost" onClick={() => refresh()} disabled={refreshing}>{refreshing ? 'Đang tải…' : '↻ Tải lại'}</button>
      </div>

      <div className="admin-strip">
        <LoadMonitor />
        <div className="panel mini-card tanthu" id="sec-tanthu">
          <div className="mini-head">
            <b>Chương trình Tân thủ</b>
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setTanthu(true)}>Xem &amp; kích hoạt</button>
          </div>
          <div className="mini-sub">Tặng Pro 12 tháng cho giáo xứ mới. Xem trước danh sách rồi mới áp dụng.</div>
        </div>
      </div>

      <div id="sec-todo">
        <div className="admin-todo">
          {todo.map((t) => (
            <Tile key={t.l} className={`todo-tile${t.n > 0 ? ' hot' : ''}`} onClick={t.go}>
              <div className="n">{t.n}</div><div className="l">{t.l}</div>
            </Tile>
          ))}
        </div>
      </div>

      <div className="admin-kpis" id="sec-overview">
        <Tile className="kpi click" onClick={() => showParishes('all')}><div className="n">{stats.total}</div><div className="l">Giáo xứ</div></Tile>
        <Tile className="kpi click" onClick={() => showParishes('proActive')}><div className="n" style={{ color: '#15803d' }}>{stats.proActive}</div><div className="l">Pro còn hạn</div></Tile>
        <Tile className="kpi click" onClick={() => showParishes('free')}><div className="n">{stats.free}</div><div className="l">Khởi động</div></Tile>
        <div className="panel kpi"><div className="n">{stats.teachers}</div><div className="l">Giáo lý viên</div></div>
        <div className="panel kpi"><div className="n">{stats.students}</div><div className="l">Học viên</div></div>
        <div className="panel kpi"><div className="n">{stats.classes}</div><div className="l">Lớp học</div></div>
      </div>

      <div className="panel" id="sec-orders">
        <div className="card-head"><h2 style={{ margin: 0 }}>Đơn chờ thanh toán ({orders.length})</h2></div>
        {errBox('orders')}
        {orders.length === 0 ? (!loadErr.orders && <p className="muted">Không có đơn nào đang chờ.</p>) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Mã đơn</th><th>Giáo xứ</th><th>Gói</th><th>Mã GG</th><th style={{ textAlign: 'right' }}>Số tiền</th><th>Ngày</th><th></th></tr></thead>
              <tbody>
                {ordersPage.map((o) => {
                  const age = Math.floor((Date.now() - new Date(o.created_at).getTime()) / DAY);
                  return (
                    <tr key={o.id}>
                      <td data-label="Mã đơn" style={{ fontWeight: 600 }}>{o.order_code}</td>
                      <td data-label="Giáo xứ">{o.parish_name}</td>
                      <td data-label="Gói" className="muted" style={{ fontSize: 12 }}>{tierLabel(o.tier_label)}</td>
                      <td data-label="Mã GG">{o.discount_code || '-'}</td>
                      <td data-label="Số tiền" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtVnd(o.final_amount)}</td>
                      <td data-label="Ngày" className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(o.created_at)}
                        <div>{age <= 0 ? 'hôm nay' : `${age} ngày trước`}</div>
                      </td>
                      <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button className="btn sm" onClick={() => setPayingOrder(o)}>Đã trả → Kích hoạt</button>
                        <div className="row-links"><button className="danger" onClick={() => cancelOrder(o)}>Hủy đơn</button></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ordersPager}
          </div>
        )}
      </div>

      <div className="panel expiry-panel" id="sec-expiring">
        <div className="card-head"><h2 style={{ margin: 0 }}>Pro sắp / đã hết hạn ({expiring.length})</h2></div>
        {errBox('parishes')}
        {expiring.length === 0 ? (!loadErr.parishes && <p className="muted">Không có giáo xứ Pro nào hết hạn trong 30 ngày tới.</p>) : (
          <>
            <div className="stack" style={{ gap: 8 }}>
              {expiringPage.map((p) => (
                <div key={p.id} className="expiry-row">
                  <div style={{ flex: 1, minWidth: 160 }}><b>{p.name}</b>{p.diocese && <span className="muted" style={{ fontSize: 12 }}> · {p.diocese}</span>}</div>
                  <div style={{ fontSize: 13 }}>
                    {p.dleft < 0
                      ? <span style={{ color: '#b91c1c' }}>Đã hết hạn {fmtDate(p.plan_expires_at)} ({-p.dleft} ngày trước)</span>
                      : <span style={{ color: '#a8641b' }}>Còn {p.dleft} ngày · đến {fmtDate(p.plan_expires_at)}</span>}
                  </div>
                  <button className="btn ghost sm" onClick={() => setEditing(p)}>Gia hạn</button>
                </div>
              ))}
            </div>
            {expiringPager}
          </>
        )}
      </div>

      <div className="panel" id="sec-leads">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Đơn liên hệ &amp; đăng ký dùng thử{leadTodo > 0 ? ` (${leadTodo} cần xử lý)` : ''}</h2>
          <input placeholder="Tìm tên, email, SĐT, giáo xứ…" value={leadQ} onChange={(e) => setLeadQ(e.target.value)} style={{ marginLeft: 'auto', minWidth: 200 }} />
          <select value={leadView} onChange={(e) => setLeadView(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Tất cả</option>
            <option value="todo">Cần xử lý</option>
          </select>
          <select value={leadSort} onChange={(e) => setLeadSort(e.target.value)} style={{ width: 'auto' }}>
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
        {errBox('leads')}
        {leadsShown.length === 0 ? (!loadErr.leads && <p className="muted">{leads.length === 0 ? 'Chưa có đơn nào.' : 'Không có đơn nào khớp bộ lọc.'}</p>) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Ngày</th><th>Loại</th><th>Người gửi</th><th>Giáo xứ</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {leadsPage.map((l) => (
                  <tr key={l.id} style={leadNeedsAction(l) ? { background: 'rgba(180,129,60,.05)' } : undefined}>
                    <td data-label="Ngày" className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                    <td data-label="Loại">{l.kind === 'register' ? <span className="plan-badge pro">Đăng ký</span> : <span className="plan-badge free">Liên hệ</span>}</td>
                    <td data-label="Người gửi">
                      <div style={{ fontWeight: 600 }}>{l.name || '-'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{l.email || ''}{l.phone ? ' · ' + l.phone : ''}</div>
                    </td>
                    <td data-label="Giáo xứ">{l.parish_name || '-'}</td>
                    <td data-label="Nội dung" className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{l.note || ''}</td>
                    <td data-label="Trạng thái">{l.status === 'archived' ? <span className="muted" style={{ fontSize: 12 }}>Đã xử lý</span>
                      : l.kind === 'register'
                        ? (l.status === 'duplicate'
                          ? <span style={{ color: '#b45309', fontSize: 12 }}>Email đã đăng ký (không gửi lại)</span>
                          : l.status === 'rate'
                            ? <span style={{ color: '#b91c1c', fontSize: 12 }}>Bị giới hạn tần suất, chưa gửi mời (mời tay)</span>
                            : l.status === 'error'
                              ? <span style={{ color: '#b91c1c', fontSize: 12 }}>Chưa gửi được mời, cần xử lý tay</span>
                              : <span style={{ color: '#15803d', fontSize: 12 }}>Đã gửi email mời (tự động) ✓</span>)
                        : l.status === 'granted' ? <span style={{ color: '#15803d', fontSize: 12 }}>Đã cấp ✓</span>
                          : <span style={{ color: '#a8641b', fontSize: 12 }}>Mới</span>}</td>
                    <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {l.kind !== 'register' && l.status !== 'granted' && <button className="btn sm" disabled={!l.email} onClick={() => setGrantLead(l)}>Cấp tài khoản</button>}
                      <div className="row-links">
                        {leadNeedsAction(l) && <button onClick={() => markLeadDone(l)}>Đã xử lý</button>}
                        <button className="danger" onClick={() => deleteLead(l)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leadsPager}
          </div>
        )}
      </div>

      <div className="panel" id="sec-parishes">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Danh sách giáo xứ{parishFiltered ? ` (${filtered.length}/${rows.length})` : ` (${rows.length})`}</h2>
          <input
            placeholder="Tìm theo tên giáo xứ / email admin…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            style={{ marginLeft: 'auto', minWidth: 240 }}
          />
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Tất cả gói</option>
            <option value="free">Khởi động</option>
            <option value="pro">Pro (mọi bậc)</option>
            <option value="proActive">Pro còn hạn</option>
            <option value="proExpired">Pro đã hết hạn</option>
            <option value="expiring">Pro sắp hết hạn (30 ngày)</option>
            <optgroup label="Theo bậc Pro">
              <option value="pro5">Pro nhỏ (tối đa 5 lớp)</option>
              <option value="pro12">Pro vừa (6 đến 12 lớp)</option>
              <option value="pro20">Pro lớn (13 đến 20 lớp)</option>
              <option value="proXL">Pro rất lớn (trên 20 lớp)</option>
            </optgroup>
          </select>
          <select value={parishSort} onChange={(e) => setParishSort(e.target.value)} style={{ width: 'auto' }}>
            <option value="newest">Mới đăng ký nhất</option>
            <option value="classesDesc">Nhiều lớp nhất</option>
            <option value="classesAsc">Ít lớp nhất</option>
            <option value="studentsDesc">Nhiều học viên nhất</option>
            <option value="studentsAsc">Ít học viên nhất</option>
          </select>
        </div>

        {errBox('parishes')}
        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : filtered.length === 0 ? (
          !loadErr.parishes && (
            <p className="muted">
              {parishFiltered ? 'Không có giáo xứ nào khớp bộ lọc. ' : 'Chưa có giáo xứ nào.'}
              {parishFiltered && <button className="btn ghost sm" onClick={() => { setQText(''); setPlanFilter('all'); }}>Bỏ lọc</button>}
            </p>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
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
                {parishPage.map((p) => {
                  const expired = p.plan === 'pro' && p.plan_expires_at && new Date(p.plan_expires_at) < new Date();
                  return (
                    <tr key={p.id}>
                      <td data-label="Giáo xứ">
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.diocese && <div className="muted" style={{ fontSize: 12 }}>{p.diocese}</div>}
                      </td>
                      <td data-label="Quản trị viên">
                        <div>{p.admin_name || '-'}</div>
                        {p.admin_email && <div className="muted" style={{ fontSize: 12 }}>{p.admin_email}</div>}
                      </td>
                      <td data-label="Lớp" style={{ textAlign: 'center' }}>{p.classes}</td>
                      <td data-label="Học viên" style={{ textAlign: 'center' }}>{p.students}</td>
                      <td data-label="GLV" style={{ textAlign: 'center' }}>{p.teachers}</td>
                      <td data-label="Tạo" className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                      <td data-label="Gói" style={{ whiteSpace: 'nowrap' }}>
                        {p.plan === 'pro' ? (
                          <>
                            <span className={`plan-badge ${expired ? 'expired' : 'pro'}`}>{expired ? 'Pro hết hạn' : 'PRO'}</span>
                            <div className="muted" style={{ fontSize: 11 }}>{p.plan_expires_at ? `đến ${fmtDate(p.plan_expires_at)}` : 'không thời hạn'}</div>
                            <div className="muted" style={{ fontSize: 11 }}>{p.plan_max_classes ? `tối đa ${p.plan_max_classes} lớp` : 'không giới hạn lớp'}</div>
                          </>
                        ) : (
                          <span className="plan-badge free">Khởi động</span>
                        )}
                      </td>
                      <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {p.plan === 'pro'
                          ? <button className="btn ghost sm" onClick={() => setEditing(p)}>Gia hạn</button>
                          : <button className="btn sm" onClick={() => setEditing(p)}>Kích hoạt Pro</button>}
                        <div className="row-links">
                          <button onClick={() => setPayParish(p)}>Ghi TT</button>
                          <button onClick={() => setEditParish(p)}>Sửa</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parishPager}
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Thanh toán qua chuyển khoản / VietQR. Sau khi nhận đủ tiền, bấm <b>Kích hoạt Pro</b> và chọn hạn. Hủy Pro nằm trong cửa sổ Gia hạn, xóa giáo xứ nằm trong cửa sổ Sửa.
        </p>
      </div>

      <div className="panel" id="sec-payments">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Sổ thanh toán</h2>
          <input placeholder="Lọc theo giáo xứ…" value={payQ} onChange={(e) => setPayQ(e.target.value)} style={{ marginLeft: 'auto', minWidth: 180 }} />
          <select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Toàn thời gian</option>
            <option value="sy">Niên khóa {schoolYearRange(0).label}</option>
            <option value="prevsy">Niên khóa {schoolYearRange(-1).label}</option>
            <option value="month">Tháng này</option>
          </select>
          <button className="btn ghost sm" disabled={paymentsShown.length === 0} onClick={exportPayments}>Xuất Excel</button>
        </div>
        <p style={{ margin: '0 0 8px' }}>
          {payFiltered
            ? <>Tổng thu (đang lọc, {paymentsShown.length} khoản): <b style={{ color: '#15803d' }}>{fmtVnd(shownRevenue)}</b> <span className="muted" style={{ fontSize: 13 }}>· toàn thời gian {fmtVnd(totalRevenue)}</span></>
            : <>Tổng thu ({payments.length} khoản): <b style={{ color: '#15803d' }}>{fmtVnd(totalRevenue)}</b></>}
        </p>
        {errBox('payments')}
        {paymentsShown.length === 0 ? (
          !loadErr.payments && <p className="muted">{payments.length === 0 ? <>Chưa có khoản thu nào. Bấm <b>Ghi TT</b> ở một giáo xứ để thêm.</> : 'Không có khoản thu nào trong khoảng đang lọc.'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ngày</th><th>Giáo xứ</th><th style={{ textAlign: 'right' }}>Số tiền</th>
                  <th>Phương thức</th><th>Mã GG</th><th>Ghi chú</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paymentsPage.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Ngày" className="muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(p.paid_at)}</td>
                    <td data-label="Giáo xứ">{p.parish_name}</td>
                    <td data-label="Số tiền" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtVnd(p.amount)}</td>
                    <td data-label="Phương thức">{METHODS[p.method] || p.method || '-'}</td>
                    <td data-label="Mã GG">{p.discount_code || '-'}</td>
                    <td data-label="Ghi chú" className="muted" style={{ fontSize: 12 }}>{p.note || ''}</td>
                    <td data-label="" style={{ textAlign: 'right' }}><div className="row-links"><button className="danger" onClick={() => removePayment(p)}>Xóa</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paymentsPager}
          </div>
        )}
      </div>

      <div className="panel" id="sec-codes">
        <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Mã giảm giá</h2>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setEditCode({ code: '', kind: 'percent', value: '', free_months: 3, tier_id: '', expires_at: '', max_uses: '', active: true, note: '' })}>+ Tạo mã</button>
        </div>
        {errBox('codes')}
        {codes.length === 0 ? (!loadErr.codes && <p className="muted">Chưa có mã giảm giá.</p>) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Mã</th><th>Giảm</th><th>Hạn</th><th style={{ textAlign: 'center' }}>Đã dùng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {codesPage.map((c) => (
                  <tr key={c.code}>
                    <td data-label="Mã" style={{ fontWeight: 600 }}>{c.code}</td>
                    <td data-label="Giảm">{c.kind === 'pro_free' ? `Pro ${c.free_months || 3} tháng` : c.kind === 'percent' ? c.value + '%' : fmtVnd(c.value)}</td>
                    <td data-label="Hạn" className="muted" style={{ fontSize: 12 }}>{c.expires_at ? fmtDate(c.expires_at) : 'Không hạn'}</td>
                    <td data-label="Đã dùng" style={{ textAlign: 'center' }}>{c.used_count}{c.max_uses ? ' / ' + c.max_uses : ''}</td>
                    <td data-label="Trạng thái">{c.active ? <span className="plan-badge pro">Bật</span> : <span className="plan-badge free">Tắt</span>}</td>
                    <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => setEditCode({ ...c, expires_at: c.expires_at || '', max_uses: c.max_uses ?? '' })}>Sửa</button>
                      <div className="row-links"><button className="danger" onClick={() => deleteCode(c.code)}>Xóa</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {codesPager}
          </div>
        )}
      </div>

      <div className="panel" id="sec-tiers">
        <div className="card-head"><h2 style={{ margin: 0 }}>Bảng giá gói Pro</h2></div>
        {errBox('tiers')}
        <div className="stack" style={{ gap: 10 }}>
          {tiers.map((t) => <TierRow key={t.id} tier={t} onSave={(patch) => saveTier(t.id, patch)} />)}
          {tiers.length === 0 && !loadErr.tiers && <p className="muted">Chưa có bậc giá nào.</p>}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Để trống ô giá = "Liên hệ" (không tạo QR).</p>
      </div>

      <div className="panel" id="sec-growth">
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

      <DefaultGamesManager />

      <div className="panel" id="sec-purge">
        <div className="card-head"><h2 style={{ margin: 0 }}>Dọn dữ liệu giáo xứ quá hạn ({overdue.length})</h2></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Giáo xứ gói Pro đã hết hạn <b>quá 30 ngày</b>, đủ điều kiện xóa dữ liệu theo chính sách. Duyệt từng giáo xứ rồi xóa thủ công (không tự động). Thao tác <b>không thể hoàn tác</b>.
        </p>
        {overdue.length === 0 ? <p className="muted">Không có giáo xứ nào quá hạn trên 30 ngày.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Giáo xứ</th><th>Quản trị</th><th>Hết hạn</th><th>Quá hạn</th><th>Quy mô</th><th></th></tr></thead>
              <tbody>
                {overduePage.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Giáo xứ">{p.name}</td>
                    <td data-label="Quản trị" className="muted" style={{ fontSize: 12 }}>{p.admin_email || '-'}</td>
                    <td data-label="Hết hạn">{fmtDate(p.plan_expires_at)}</td>
                    <td data-label="Quá hạn"><span style={{ color: '#b91c1c', fontWeight: 600 }}>{p.overdays} ngày</span></td>
                    <td data-label="Quy mô" className="muted" style={{ fontSize: 12 }}>{p.classes || 0} lớp · {p.students || 0} HV · {p.teachers || 0} GLV</td>
                    <td data-label="" style={{ textAlign: 'right' }}><button className="btn danger sm" onClick={() => setDeleting({ parish: p, purge: true })}>Xóa dữ liệu…</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overduePager}
          </div>
        )}
      </div>

      {editing && <ActivateModal parish={editing} tiers={tiers} onClose={() => setEditing(null)}
        onConfirm={(exp, payment, maxCls) => setPlan(editing, 'pro', exp, payment, maxCls)}
        onCancelPro={() => cancelPro(editing)} />}
      {editParish && <EditParishModal parish={editParish} onClose={() => setEditParish(null)} onSave={(patch) => saveParish(editParish, patch)}
        onDelete={() => { setDeleting({ parish: editParish, purge: false }); setEditParish(null); }} />}
      {deleting && <DeleteParishModal parish={deleting.parish} purge={deleting.purge} onClose={() => setDeleting(null)} onConfirm={() => deleteParish(deleting.parish)} />}
      {payParish && <PaymentModal parish={payParish} onClose={() => setPayParish(null)} onSave={(payment) => addPayment(payParish, payment)} />}
      {payingOrder && <OrderPaidModal order={payingOrder} onClose={() => setPayingOrder(null)} onConfirm={(exp) => markOrderPaid(payingOrder, exp)} />}
      {editCode && <CodeModal code={editCode} tiers={tiers} onClose={() => setEditCode(null)} onSave={saveCode} />}
      {grantLead && <GrantModal lead={grantLead} onClose={() => setGrantLead(null)} onConfirm={(form) => grantAccount(grantLead, form)} />}
      {tanthu && <TanThuModal onClose={() => { setTanthu(false); refresh(); }} />}
      {toast && <div className={`admin-toast ${toast.kind}`} role="status" onClick={() => setToast(null)}>{toast.text}</div>}
    </div>
  );
}

// Theo dõi form đã sửa chưa (so với giá trị lúc mở modal) để hỏi lại khi đóng bằng Esc.
function useDirty(value) {
  const [init] = useState(() => JSON.stringify(value));
  return JSON.stringify(value) !== init;
}

function GrantModal({ lead, onClose, onConfirm }) {
  const [f, setF] = useState({ email: lead.email || '', full_name: lead.name || '', parish_name: lead.parish_name || '', diocese: '' });
  const dirty = useDirty(f);
  const [busy, run] = useBusy();
  const ok = f.email.trim() && f.parish_name.trim();
  return (
    <Modal onClose={onClose} dirty={dirty} wide>
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
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" disabled={!ok || busy} onClick={() => run(() => onConfirm(f))}>{busy ? 'Đang gửi…' : 'Gửi lời mời'}</button>
      </div>
    </Modal>
  );
}

function TierRow({ tier, onSave }) {
  const [label, setLabel] = useState(tier.label || '');
  const [price, setPrice] = useState(tier.price ?? '');
  const [maxCls, setMaxCls] = useState(tier.max_classes ?? '');
  const [busy, run] = useBusy();
  const dirty = label !== (tier.label || '') || String(price) !== String(tier.price ?? '') || String(maxCls) !== String(tier.max_classes ?? '');
  return (
    <div className="tier-row">
      <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Liên hệ" style={{ width: 130 }} />
      <span className="muted" style={{ fontSize: 12 }}>đ/niên khóa</span>
      <input type="number" min="1" value={maxCls} onChange={(e) => setMaxCls(e.target.value)} placeholder="∞" title="Số lớp tối đa (để trống = không giới hạn)" style={{ width: 80 }} />
      <span className="muted" style={{ fontSize: 12 }}>lớp tối đa</span>
      <button className="btn sm" disabled={!dirty || busy} onClick={() => run(() => onSave({ label: label.trim(), price: price === '' ? null : Number(price), max_classes: maxCls === '' ? null : Number(maxCls) }))}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
    </div>
  );
}

function OrderPaidModal({ order, onClose, onConfirm }) {
  const [exp, setExp] = useState(''); // để trống = 365 ngày từ hôm nay (server tự tính)
  const [busy, run] = useBusy();
  return (
    <Modal onClose={onClose} dirty={exp !== ''}>
      <h2 style={{ marginTop: 0 }}>Xác nhận đã thanh toán</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Đơn <b>{order.order_code}</b> · {order.parish_name} · {tierLabel(order.tier_label)} · <b>{fmtVnd(order.final_amount)}</b>{order.discount_code ? ` · mã ${order.discount_code}` : ''}.
        Kích hoạt Pro cho giáo xứ + ghi vào sổ thu + gửi email báo khách.
      </p>
      <div className="field"><label>Hạn gói (để trống = 365 ngày từ hôm nay)</label><input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" disabled={busy} onClick={() => run(() => onConfirm(exp || null))}>{busy ? 'Đang kích hoạt…' : 'Kích hoạt Pro'}</button>
      </div>
    </Modal>
  );
}

function CodeModal({ code, tiers, onClose, onSave }) {
  const [c, setC] = useState(code);
  const dirty = useDirty(c);
  const [busy, run] = useBusy();
  const isNew = !code.code;
  return (
    <Modal onClose={onClose} dirty={dirty} wide>
      <h2 style={{ marginTop: 0 }}>{isNew ? 'Tạo mã khuyến mãi' : `Sửa mã ${code.code}`}</h2>
      <div className="row">
        <div className="field" style={{ flex: 1 }}><label>Mã</label>
          <input value={c.code} disabled={!isNew} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="VD: BACKTOSCHOOL" /></div>
        <div className="field"><label>Kiểu</label>
          <select value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value })}>
            <option value="percent">Giảm %</option><option value="amount">Giảm số tiền</option><option value="pro_free">Miễn phí Pro (tháng)</option>
          </select></div>
        {c.kind === 'pro_free' ? (
          <>
            <div className="field"><label>Số tháng miễn phí</label>
              <input type="number" min="1" value={c.free_months ?? 3} onChange={(e) => setC({ ...c, free_months: e.target.value })} placeholder="3" /></div>
            <div className="field"><label>Mức Pro áp dụng</label>
              <select value={c.tier_id ?? ''} onChange={(e) => setC({ ...c, tier_id: e.target.value })}>
                <option value="">Chọn mức</option>
                {(tiers || []).map((t) => <option key={t.id} value={t.id}>{tierLabel(t.label)}</option>)}
              </select></div>
          </>
        ) : (
          <div className="field"><label>Giá trị</label>
            <input type="number" value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} placeholder={c.kind === 'percent' ? '10' : '200000'} /></div>
        )}
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
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" disabled={!c.code.trim() || busy} onClick={() => run(() => onSave(c))}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Modal>
  );
}

// Ô nhập thông tin thanh toán (dùng chung khi kích hoạt Pro và khi ghi TT rời)
function PaymentFields({ pay, set, optional }) {
  return (
    <>
      <div className="row">
        <div className="field"><label>Số tiền (VND)</label>
          <input type="number" value={pay.amount} onChange={(e) => set({ ...pay, amount: e.target.value })} placeholder={optional ? 'Để trống nếu không ghi' : 'VD: 1500000'} /></div>
        <div className="field"><label>Phương thức</label>
          <select value={pay.method} onChange={(e) => set({ ...pay, method: e.target.value })}>
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
      <div className="row">
        <div className="field"><label>Ngày nhận</label>
          <input type="date" value={pay.paid_at} onChange={(e) => set({ ...pay, paid_at: e.target.value })} /></div>
        <div className="field"><label>Mã giảm giá (nếu có)</label>
          <input value={pay.discount_code} onChange={(e) => set({ ...pay, discount_code: e.target.value })} placeholder="Không có" /></div>
      </div>
      <div className="field"><label>Ghi chú</label>
        <input value={pay.note} onChange={(e) => set({ ...pay, note: e.target.value })} /></div>
    </>
  );
}

const emptyPay = () => ({ amount: '', method: 'bank', paid_at: new Date().toISOString().slice(0, 10), discount_code: '', note: '' });

function TanThuModal({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [excl, setExcl] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.post('/admin/tanthu-preview', {})
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Không tải được danh sách'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (email) => setExcl((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const willCount = data ? data.eligible.length - excl.size : 0;

  async function apply() {
    if (!willCount || busy) return;
    if (!confirm(`Nâng Pro 12 tháng và gửi email cho ${willCount} giáo xứ? Thao tác này là thật và không hoàn tác.`)) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post('/admin/tanthu-apply', { exclude: [...excl] });
      setResult(r.data);
    } catch (e) { setErr(e.response?.data?.error || 'Áp dụng thất bại'); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} dirty={excl.size > 0 && !result} style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Kích hoạt gói Tân thủ</h2>
      {loading ? <p className="muted">Đang tải danh sách…</p>
        : result ? (
          <div>
            <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 6 }}>✓ Hoàn tất</div>
            <p style={{ margin: '4px 0' }}>Đã nâng <b>{result.upgraded}</b> giáo xứ · gửi <b>{result.sent}</b> email · hạn mới <b>{result.new_expiry}</b>.</p>
            {result.failed_update?.length ? <p className="error">Lỗi cập nhật: {result.failed_update.join(', ')}</p> : null}
            {result.failed_mail?.length ? <p className="error">Email chưa gửi được: {result.failed_mail.join(', ')}</p> : null}
            <div className="modal-actions"><button className="btn" onClick={onClose}>Xong</button></div>
          </div>
        ) : data ? (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Đủ điều kiện: <b>{data.eligible_count}</b> · Bỏ qua: <b>{data.skipped_count}</b> · Hạn mới nếu áp dụng: <b>{data.new_expiry}</b>.
              Bỏ tick giáo xứ nào nếu không muốn nâng (ví dụ tài khoản thử).
            </p>
            {data.eligible.length === 0 ? <p className="muted">Hiện không có giáo xứ mới nào cần nâng.</p> : (
              <div className="table-scroll" style={{ maxHeight: 280 }}>
                <table>
                  <thead><tr><th></th><th>Giáo xứ</th><th>Hiện tại</th><th>Bậc mới</th><th>Email</th></tr></thead>
                  <tbody>
                    {data.eligible.map((e) => (
                      <tr key={e.to}>
                        <td><input type="checkbox" checked={!excl.has(e.to)} onChange={() => toggle(e.to)} /></td>
                        <td>{e.name}</td><td>{e.from}</td><td>{e.new_tier}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{e.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.skipped?.length ? (
              <details style={{ marginTop: 8 }}>
                <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>Xem {data.skipped.length} giáo xứ bị bỏ qua</summary>
                <ul style={{ fontSize: 12.5, color: '#555', marginTop: 6 }}>
                  {data.skipped.map((s, i) => <li key={i}>{s.name}: {s.reason}</li>)}
                </ul>
              </details>
            ) : null}
            {err && <div className="error">{err}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
              <button className="btn" disabled={busy || willCount === 0} onClick={apply}>{busy ? 'Đang áp dụng…' : `Áp dụng cho ${willCount} giáo xứ`}</button>
            </div>
          </>
        ) : (
          <>
            <div className="error">{err || 'Không tải được'}</div>
            <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
          </>
        )}
    </Modal>
  );
}

// Dự phòng khi chưa tải được plan_tiers (khớp migration_plan_tier_limit.sql).
const FALLBACK_TIERS = [
  { id: 1, label: 'Giáo xứ nhỏ, tối đa 5 lớp', max_classes: 5, price: null },
  { id: 2, label: 'Giáo xứ vừa, 6 đến 12 lớp', max_classes: 12, price: null },
  { id: 3, label: 'Giáo xứ lớn, 13 đến 20 lớp', max_classes: 20, price: null },
  { id: 4, label: 'Giáo xứ rất lớn, trên 20 lớp', max_classes: null, price: null },
];

function ActivateModal({ parish, tiers, onClose, onConfirm, onCancelPro }) {
  const isPro = parish.plan === 'pro';
  // Mức đọc từ bảng giá (plan_tiers.max_classes). value = số lớp tối đa ('' = không giới hạn).
  const tierOpts = tiers && tiers.length ? tiers : FALLBACK_TIERS;
  const optVal = (t) => (t.max_classes == null ? '' : String(t.max_classes));
  // Gia hạn: giữ đúng bậc hiện tại. Kích hoạt mới: bậc nhỏ nhất. KHÔNG để rỗng vì '' = không giới hạn lớp.
  const [maxCls, setMaxCls] = useState(() => (isPro
    ? (parish.plan_max_classes == null ? '' : String(parish.plan_max_classes))
    : optVal(tierOpts.find((t) => t.max_classes != null) || tierOpts[0])));
  const [exp, setExp] = useState(freshExpiry());
  const [pay, setPay] = useState(emptyPay());
  const dirty = useDirty({ maxCls, exp, pay });
  const [busy, run] = useBusy();

  const tier = tierOpts.find((t) => optVal(t) === maxCls);
  const left = isPro && parish.plan_expires_at ? daysTo(parish.plan_expires_at) : null;
  const limit = maxCls === '' ? null : Number(maxCls);
  const over = limit != null && (parish.classes || 0) > limit;

  return (
    <Modal onClose={onClose} dirty={dirty} wide>
      <h2 style={{ marginTop: 0 }}>{isPro ? 'Gia hạn Pro' : 'Kích hoạt Pro'}: {parish.name}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Hiện tại: {isPro
          ? <>gói <b>Pro</b>, {parish.plan_max_classes ? `tối đa ${parish.plan_max_classes} lớp` : 'không giới hạn lớp'}, {parish.plan_expires_at
            ? (left < 0 ? <>đã hết hạn {fmtDate(parish.plan_expires_at)} ({-left} ngày trước)</> : <>hạn đến {fmtDate(parish.plan_expires_at)} (còn {left} ngày)</>)
            : 'không thời hạn'}</>
          : <>gói <b>Khởi động</b></>}. Đang dùng {parish.classes || 0} lớp.
      </p>
      <div className="row">
        <div className="field" style={{ flex: '0 0 200px' }}>
          <label>Hạn gói (đến hết ngày)</label>
          <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Mức gói (giới hạn số lớp)</label>
          <select value={maxCls} onChange={(e) => setMaxCls(e.target.value)}>
            {!tier && <option value={maxCls}>Giữ mức hiện tại: {maxCls ? `tối đa ${maxCls} lớp` : 'không giới hạn'}</option>}
            {tierOpts.map((t) => <option key={t.id} value={optVal(t)}>{tierLabel(t.label)}</option>)}
          </select>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        Hạn mới tính 365 ngày từ hôm nay{left > 0 ? `, phần còn lại của chu kỳ cũ (${left} ngày) không cộng dồn` : ''}. Để trống hạn = Pro không giới hạn thời gian.
      </p>
      {over && <p className="error" style={{ fontSize: 13 }}>Bậc này cho tối đa {limit} lớp nhưng giáo xứ đang có {parish.classes} lớp: sẽ không tạo thêm lớp được.</p>}
      <div className="form-section">Ghi nhận thanh toán (nhập số tiền để lưu vào sổ; để trống nếu không ghi)</div>
      {tier?.price ? (
        <p className="muted" style={{ fontSize: 12, margin: '6px 0' }}>
          Giá bậc này: <b>{fmtVnd(tier.price)}</b>/niên khóa.{' '}
          {String(pay.amount) !== String(tier.price) && <button className="btn ghost sm" onClick={() => setPay({ ...pay, amount: String(tier.price) })}>Điền số tiền này</button>}
        </p>
      ) : null}
      <PaymentFields pay={pay} set={setPay} optional />
      <div className="modal-actions">
        {isPro && (
          <div className="row-links modal-side-link" style={{ marginRight: 'auto', marginTop: 0, alignSelf: 'center' }}>
            <button className="danger" disabled={busy} onClick={() => run(onCancelPro)}>Hủy Pro (về Khởi động)</button>
          </div>
        )}
        <button className="btn ghost" onClick={onClose} disabled={busy}>Đóng</button>
        <button className="btn" disabled={busy} onClick={() => run(() => onConfirm(exp || null, pay, maxCls === '' ? null : Number(maxCls)))}>
          {busy ? 'Đang xử lý…' : (isPro ? 'Gia hạn Pro' : 'Kích hoạt Pro')}
        </button>
      </div>
    </Modal>
  );
}

function EditParishModal({ parish, onClose, onSave, onDelete }) {
  const [name, setName] = useState(parish.name || '');
  const [diocese, setDiocese] = useState(parish.diocese || '');
  const dirty = useDirty({ name, diocese });
  const [busy, run] = useBusy();
  return (
    <Modal onClose={onClose} dirty={dirty}>
      <h2 style={{ marginTop: 0 }}>Sửa giáo xứ</h2>
      <div className="field"><label>Tên giáo xứ</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Giáo phận</label><input value={diocese} onChange={(e) => setDiocese(e.target.value)} /></div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" disabled={!name.trim() || !dirty || busy} onClick={() => run(() => onSave({ name: name.trim(), diocese: diocese.trim() }))}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
      <div className="danger-zone">
        <div>
          <b>Xóa giáo xứ</b>
          <div className="muted" style={{ fontSize: 12 }}>Xóa vĩnh viễn toàn bộ lớp, học viên, tài khoản GLV của giáo xứ. Không thể hoàn tác.</div>
        </div>
        <button className="btn danger sm" disabled={busy} onClick={onDelete}>Xóa giáo xứ…</button>
      </div>
    </Modal>
  );
}

// Xác nhận xóa giáo xứ: phải gõ lại đúng tên mới bấm được (dùng cho cả xóa thường và dọn dữ liệu quá hạn).
function DeleteParishModal({ parish, purge, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  const [busy, run] = useBusy();
  const ok = typed.trim() === (parish.name || '').trim();
  const overdays = parish.plan_expires_at ? -daysTo(parish.plan_expires_at) : 0;
  return (
    <Modal onClose={busy ? () => {} : onClose} dirty={false}>
      <h2 style={{ marginTop: 0, color: '#b91c1c' }}>{purge ? 'Xóa dữ liệu giáo xứ quá hạn' : 'Xóa giáo xứ'}</h2>
      {purge && <p style={{ margin: '4px 0' }}>Đã quá hạn <b>{overdays} ngày</b> (hết hạn {fmtDate(parish.plan_expires_at)}).</p>}
      <p style={{ margin: '4px 0' }}>
        Sẽ xóa <b>{parish.classes || 0} lớp, {parish.students || 0} học viên, {parish.teachers || 0} GLV</b> và toàn bộ dữ liệu liên quan của giáo xứ <b>{parish.name}</b>.
      </p>
      <p style={{ margin: '4px 0', color: '#b91c1c' }}>Không thể hoàn tác. Chỉ xóa khi đã chắc chắn (và đã sao lưu nếu cần).</p>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Gõ lại đúng tên giáo xứ để xác nhận</label>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={parish.name} autoFocus />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn danger" disabled={!ok || busy} onClick={() => run(onConfirm)}>{busy ? 'Đang xóa…' : 'Xóa vĩnh viễn'}</button>
      </div>
    </Modal>
  );
}

function PaymentModal({ parish, onClose, onSave }) {
  const [pay, setPay] = useState(emptyPay());
  const dirty = useDirty(pay);
  const [busy, run] = useBusy();
  return (
    <Modal onClose={onClose} dirty={dirty} wide>
      <h2 style={{ marginTop: 0 }}>Ghi thanh toán: {parish.name}</h2>
      <PaymentFields pay={pay} set={setPay} />
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn" disabled={!(Number(pay.amount) > 0) || busy} onClick={() => run(() => onSave(pay))}>{busy ? 'Đang ghi…' : 'Lưu'}</button>
      </div>
    </Modal>
  );
}

/* ---------------- Giám sát tải hệ thống (đèn báo sớm) ---------------- */
// Ngưỡng vàng/đỏ — CHỈNH theo compute Supabase đang dùng.
const MON = { takersWarn: 400, takersRed: 600, latWarn: 300, latRed: 800, pollMs: 30000 };
const LVL_COLOR = ['#15803d', '#a8641b', '#b91c1c'];
const LVL_TEXT = ['Ổn định', 'Tải cao', 'Nguy cơ quá tải'];

function LoadMonitor() {
  const [s, setS] = useState(null);
  const [lat, setLat] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const t0 = performance.now();
      const { data, error } = await supabase.rpc('load_stats');
      const ms = Math.round(performance.now() - t0);
      if (!live) return;
      if (error) { setErr(error.message ? viError(error.message) : 'Không đọc được chỉ số'); }
      else { setErr(''); setS(data); setLat(ms); }
    };
    tick();
    const id = setInterval(() => { if (document.visibilityState === 'visible') tick(); }, MON.pollMs);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const taking = s?.taking || 0;
  const lvlT = taking >= MON.takersRed ? 2 : taking >= MON.takersWarn ? 1 : 0;
  const lvlL = lat == null ? 0 : lat >= MON.latRed ? 2 : lat >= MON.latWarn ? 1 : 0;
  const lvl = Math.max(lvlT, lvlL);
  const color = LVL_COLOR[lvl];

  if (err && /function .*load_stats.* does not exist|Could not find the function/i.test(err)) {
    return (
      <div className="panel mini-card" id="sec-load" style={{ borderLeftColor: '#a8641b' }}>
        <div className="mini-head"><b>Giám sát thi online</b></div>
        <div className="mini-sub">Chưa cài. Chạy <code>supabase/migration_load_monitor.sql</code> để bật đèn báo.</div>
      </div>
    );
  }

  return (
    <div className="panel mini-card" id="sec-load" style={{ borderLeftColor: color }}
      title={`Ngưỡng: vàng ${MON.takersWarn} / đỏ ${MON.takersRed} em, độ trễ vàng ${MON.latWarn}ms / đỏ ${MON.latRed}ms. Cảnh báo nền tự gửi qua chuông khi vượt ngưỡng đỏ.`}>
      <div className="mini-head">
        <span className="mini-dot" style={{ background: color }} />
        <b>Giám sát thi online</b>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 13, color }}>{LVL_TEXT[lvl]}</span>
      </div>
      <div className="mini-stats">
        <span><b style={{ color: LVL_COLOR[lvlT] }}>{taking}</b> đang thi</span>
        <span><b>{s?.waiting ?? '-'}</b> chờ mở</span>
        <span><b>{s?.open_exams ?? '-'}</b> đề mở</span>
        <span><b style={{ color: LVL_COLOR[lvlL] }}>{lat == null ? '-' : lat + 'ms'}</b> độ trễ</span>
      </div>
      {lvl >= 1 && (
        <div className="mini-sub" style={{ color, fontWeight: 600 }}>
          {lvl === 2
            ? '⚠ Nguy cơ quá tải: nâng compute Supabase (Small → Medium) ngay hoặc giãn lịch thi.'
            : 'Tải cao: theo dõi sát, cân nhắc nâng compute trước buổi thi.'}
        </div>
      )}
    </div>
  );
}

/* ---------------- Game mặc định toàn dự án (super-admin tải zip) ---------------- */
const MIME = {
  html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript',
  css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', ico: 'image/x-icon', txt: 'text/plain',
};
const mimeOf = (p) => MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || ('game-' + Date.now());

function DefaultGamesManager() {
  const [games, setGames] = useState([]);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎮');
  const [file, setFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const [gamesPage, gamesPager] = usePaged(games);
  function load() { api.get('/default-games').then((r) => setGames(r.data)).catch(() => setGames([])); }
  useEffect(() => { load(); }, []);

  async function rmDir(prefix) {
    const { data } = await supabase.storage.from('default-games').list(prefix, { limit: 1000 });
    if (!data) return;
    const files = [], dirs = [];
    for (const it of data) { (it.id === null ? dirs : files).push(prefix + '/' + it.name); }
    if (files.length) await supabase.storage.from('default-games').remove(files);
    for (const d of dirs) await rmDir(d);
  }

  async function upload() {
    setErr('');
    if (!title.trim()) { setErr('Nhập tên game'); return; }
    if (!file) { setErr('Chọn file .zip của game'); return; }
    try {
      setBusy('Đang giải nén…');
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const htmls = Object.keys(zip.files).filter((p) => /(^|\/)index\.html$/i.test(p) && !zip.files[p].dir);
      if (!htmls.length) throw new Error('Zip phải có file index.html (điểm vào của game).');
      htmls.sort((a, b) => a.split('/').length - b.split('/').length);
      const indexPath = htmls[0];
      const baseDir = indexPath.slice(0, indexPath.toLowerCase().lastIndexOf('index.html'));
      const slug = slugify(title);
      const entries = Object.keys(zip.files).filter((p) => p.startsWith(baseDir) && !zip.files[p].dir);
      // Gọi thẳng REST Storage để TỰ đặt Content-Type (supabase-js .upload bỏ qua
      // header này -> file bị lưu text/plain, .html/.css/.js không chạy trong iframe).
      const SB_URL = import.meta.env.VITE_SUPABASE_URL;
      const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || SB_ANON;
      // Mỗi lần tải lên vào 1 thư mục phiên bản riêng -> URL đổi theo mỗi bản, tránh
      // trình duyệt chạy bản cũ đã cache khi nâng cấp game. (Xóa game xóa cả slug.)
      const ver = Date.now().toString(36);
      let done = 0;
      for (const p of entries) {
        const rel = p.slice(baseDir.length);
        const ab = await zip.files[p].async('arraybuffer');
        const dest = `${slug}/${ver}/${rel}`.split('/').map(encodeURIComponent).join('/');
        const res = await fetch(`${SB_URL}/storage/v1/object/default-games/${dest}`, {
          method: 'POST',
          headers: {
            apikey: SB_ANON,
            Authorization: `Bearer ${token}`,
            'x-upsert': 'true',
            'content-type': mimeOf(rel),
            'cache-control': 'max-age=3600',
          },
          body: ab,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`Tải lên Storage lỗi ${res.status}: ${t} (đã tạo bucket default-games + policy chưa?)`);
        }
        done++; setBusy(`Đang tải lên… ${done}/${entries.length}`);
      }
      const { data: pub } = supabase.storage.from('default-games').getPublicUrl(`${slug}/${ver}/index.html`);
      let thumbUrl = null;
      if (thumbFile) {
        setBusy('Đang tải thumbnail…');
        const ext = (thumbFile.name.split('.').pop() || 'jpg').toLowerCase();
        const dest = `${slug}/__thumb.${ext}`;
        const { error: te } = await supabase.storage.from('default-games').upload(dest, thumbFile, { upsert: true, contentType: thumbFile.type || mimeOf(dest) });
        if (te) throw new Error('Tải thumbnail lỗi: ' + te.message);
        thumbUrl = supabase.storage.from('default-games').getPublicUrl(dest).data.publicUrl;
      }
      await api.post('/default-games', { key: slug, title: title.trim(), icon: icon || '🎮', play_url: pub.publicUrl, thumb_url: thumbUrl, source: 'upload' });
      setBusy(''); setTitle(''); setIcon('🎮'); setFile(null); setThumbFile(null);
      document.getElementById('dg-file') && (document.getElementById('dg-file').value = '');
      document.getElementById('dg-thumb') && (document.getElementById('dg-thumb').value = '');
      load();
    } catch (e) { setBusy(''); setErr(e.message ? viError(e.message) : 'Tải lên thất bại'); }
  }

  async function del(g) {
    if (!confirm(`Xóa game mặc định "${g.title}"? (gỡ khỏi mọi tài khoản)`)) return;
    try {
      if (g.source === 'upload') await rmDir(g.key);
      await api.delete(`/default-games/${g.id}`);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message || 'Thất bại'); }
  }

  return (
    <div className="panel" id="sec-default-games">
      <div className="card-head"><h2 style={{ margin: 0 }}>Game mặc định (toàn dự án)</h2></div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Tải lên file <b>.zip</b> của game web (phải có <code>index.html</code>). Game sẽ có mặc định cho <b>mọi tài khoản</b> trong mục Game. Có thể thêm nhiều game.
      </p>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 2 }}><label>Tên game *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Ai Là Triệu Phú" /></div>
        <div className="field" style={{ flex: '0 0 90px' }}><label>Icon</label><input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎮" /></div>
        <div className="field" style={{ flex: 2 }}><label>File .zip</label><input id="dg-file" type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        <div className="field" style={{ flex: 2 }}><label>Thumbnail (tùy chọn)</label><input id="dg-thumb" type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} /></div>
        <div className="field" style={{ flex: '0 0 auto' }}><button className="btn" onClick={upload} disabled={!!busy}>{busy || 'Tải lên'}</button></div>
      </div>
      {err && <div className="error">{err}</div>}

      <table className="admin-table" style={{ marginTop: 10 }}>
        <thead><tr><th></th><th>Tên</th><th>Nguồn</th><th>Link</th><th></th></tr></thead>
        <tbody>
          {gamesPage.map((g) => (
            <tr key={g.id}>
              <td data-label="" style={{ fontSize: 20 }}>{g.icon}</td>
              <td data-label="Tên">{g.title}</td>
              <td data-label="Nguồn" className="muted">{g.source === 'builtin' ? 'Bundle sẵn' : 'Tải lên'}</td>
              <td data-label="Link" className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.play_url}</td>
              <td data-label=""><button className="btn danger sm" onClick={() => del(g)}>Xóa</button></td>
            </tr>
          ))}
          {games.length === 0 && <tr><td colSpan={5} className="muted">Chưa có game mặc định</td></tr>}
        </tbody>
      </table>
      {gamesPager}
    </div>
  );
}
