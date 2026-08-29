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

  const proCount = rows.filter((p) => p.plan === 'pro').length;

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

      <div className="admin-stats">
        <div className="panel stat"><div className="n">{rows.length}</div><div className="l">Giáo xứ</div></div>
        <div className="panel stat"><div className="n">{proCount}</div><div className="l">Đang Pro</div></div>
        <div className="panel stat"><div className="n">{rows.length - proCount}</div><div className="l">Khởi động</div></div>
      </div>

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
