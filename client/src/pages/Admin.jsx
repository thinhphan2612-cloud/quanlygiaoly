import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { isSuperAdmin } from '../lib/superadmin';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—');
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [qText, setQText] = useState('');
  const [editing, setEditing] = useState(null); // giáo xứ đang kích hoạt Pro

  function load() {
    setLoading(true); setErr('');
    api.get('/admin/parishes')
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }
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

  async function setPlan(parish, plan, plan_expires_at) {
    try {
      await api.post('/admin/set-plan', { parish_id: parish.id, plan, plan_expires_at });
      setEditing(null);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Thao tác thất bại');
    }
  }

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Quản trị hệ thống</h1>
        <button className="btn ghost" onClick={load}>↻ Tải lại</button>
      </div>

      <div className="admin-kpis">
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

      <div className="panel">
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

      {editing && <ActivateModal parish={editing} onClose={() => setEditing(null)} onConfirm={(exp) => setPlan(editing, 'pro', exp)} />}
    </div>
  );
}

function ActivateModal({ parish, onClose, onConfirm }) {
  const [exp, setExp] = useState(parish.plan_expires_at ? parish.plan_expires_at.slice(0, 10) : suggestExpiry());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Kích hoạt Pro — {parish.name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>Chỉ bấm sau khi đã xác nhận nhận được thanh toán.</p>
        <div className="field">
          <label>Hạn gói (đến hết ngày)</label>
          <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Để trống nếu muốn Pro không giới hạn thời gian.</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Hủy</button>
          <button className="btn" onClick={() => onConfirm(exp || null)}>Kích hoạt Pro</button>
        </div>
      </div>
    </div>
  );
}
