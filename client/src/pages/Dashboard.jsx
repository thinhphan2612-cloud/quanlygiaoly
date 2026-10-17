import { useEffect, useState, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useParish } from '../parish.jsx';
import { useRealtime } from '../realtime.jsx';
import { LeaderboardTable } from '../components/Leaderboard.jsx';
import { IconAlert, IconCheck, IconClass, IconDice, IconFlag, IconGradCap, IconGrades, IconList, IconStudents, IconTeacher, IconTrophy } from '../components/Icons.jsx';
import { toast } from '../lib/toast';
import { SkeletonDashboard } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import { rememberClass } from '../lib/lastClass';

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];

function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}

// Biểu đồ cột tỷ lệ điểm danh theo tuần
function WeeklyChart({ data }) {
  if (!data.length) return <p className="muted" style={{ margin: 0 }}>Chưa có dữ liệu điểm danh.</p>;
  const W = 420, H = 200, pad = 26, bw = (W - pad * 2) / data.length;
  const x = (i) => pad + i * bw + bw / 2;
  const y = (r) => H - pad - (r / 100) * (H - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.rate)}`).join(' ');
  const barW = Math.min(bw * 0.56, 40); // ít tuần thì cột vẫn gọn
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="week-chart" style={{ width: '100%' }} role="img" aria-label="Tỷ lệ có mặt theo tuần">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth="1" />
            <text x={4} y={y(g) + 4} fontSize="10" fill="var(--muted)">{g}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - barW / 2} y={y(d.rate)} width={barW} height={H - pad - y(d.rate)} rx="4" fill="var(--primary)" opacity="0.18" />
            <text x={x(i)} y={y(d.rate) - 6} fontSize="11" fill="var(--primary)" textAnchor="middle" fontWeight="600">{d.rate}%</text>
            <text x={x(i)} y={H - pad + 15} fontSize="10" fill="var(--muted)" textAnchor="middle">{d.label}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.rate)} r="3.5" fill="var(--primary)" />)}
      </svg>
    </div>
  );
}

// Mục duyệt cuối năm: các lớp GLV đã chốt chờ Admin duyệt (#5)
const DEC_LABEL = { advance: 'Lên lớp', stay: 'Ở lại', pass: 'Đậu', fail: 'Không đạt' };
const DEC_OK = { advance: true, pass: true }; // quyết định "tích cực"

function ReviewDetail({ r }) {
  const ids = Object.keys(r.decisions || {});
  if (!ids.length) return <span className="muted" style={{ fontSize: 13 }}>Không có học viên.</span>;
  const det = r.details || {};
  const list = ids.map((id) => ({
    id, dec: r.decisions[id],
    name: det[id]?.name || 'HV', score: det[id]?.score, reason: det[id]?.reason || '',
  })).sort((a, b) => (DEC_OK[a.dec] ? 1 : 0) - (DEC_OK[b.dec] ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));
  return (
    <table>
      <thead><tr><th>Học viên</th><th style={{ width: 90 }}>Điểm cuối kỳ</th><th style={{ width: 110 }}>Kết quả</th><th>Lý do</th></tr></thead>
      <tbody>
        {list.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            <td>{s.score != null ? s.score : '–'}</td>
            <td><span className={`rv-tag ${DEC_OK[s.dec] ? 'ok' : 'bad'}`}>{DEC_LABEL[s.dec] || s.dec}</span></td>
            <td className="muted">{s.reason || (DEC_OK[s.dec] ? '' : '–')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClassReviews() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState({});
  const [revising, setRevising] = useState(null); // lớp đang soạn ghi chú trả lại
  const load = () => api.get('/reviews-pending').then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const rev = useRealtime(['class_reviews', 'classes']);
  useEffect(() => { if (rev) load(); }, [rev]);
  if (!rows) return null; // chưa tải xong -> không render (tránh null.filter)
  const cat = rows.filter((r) => r.kind !== 'external');            // lớp giáo lý trong năm -> cổng cuối năm
  const ext = rows.filter((r) => r.kind === 'external' && r.status !== 'none'); // lớp ngoài -> duyệt riêng
  const catActive = cat.some((r) => r.status !== 'none');
  // Chỉ hiện khi đã có ít nhất 1 lớp được GLV chốt.
  if (!catActive && ext.length === 0) return null;
  const approved = cat.filter((r) => r.status === 'approved').length;
  const total = cat.length;
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  async function approve(r) {
    if (!await confirmDialog(`Duyệt lớp "${r.class_name}"?` + (r.kind === 'external' ? '\nLớp giáo lý ngoại thường sẽ được đóng & chuyển vào Lưu trữ ngay.' : ''))) return;
    try { await api.post('/review-approve', { id: r.review_id }); load(); }
    catch (e) { toast.err(e.response?.data?.error || 'Thất bại'); }
  }
  async function revise(r, note) {
    try { await api.post('/review-revision', { id: r.review_id, note }); toast(`Đã trả lại lớp "${r.class_name}" cho giáo lý viên`); setRevising(null); load(); }
    catch (e) { toast.err(e.response?.data?.error || 'Thất bại'); }
  }
  const renderRows = (list) => list.map((r) => {
    const d = Object.values(r.decisions || {});
    const has = r.status !== 'none';
    let summary;
    if (!has) summary = <span className="muted">–</span>;
    else if (r.kind === 'external') { const p = d.filter((v) => v === 'pass').length; summary = `Đậu ${p} · Không đạt ${d.length - p}`; }
    else { const a = d.filter((v) => v === 'advance').length; summary = `Lên lớp ${a} · Ở lại ${d.length - a}`; }
    return (
      <Fragment key={r.class_id}>
        <tr>
          <td>
            {has ? (
              <span className="link-name" onClick={() => toggle(r.class_id)}>{open[r.class_id] ? '▾ ' : '▸ '}{r.class_name}</span>
            ) : r.class_name}
            {r.is_graduation && <IconGradCap className="bi" style={{ width: 14, height: 14, marginLeft: 4 }} />}
          </td>
          <td className="muted">{r.kind === 'external' ? 'Ngoại thường' : 'Trong năm'}</td>
          <td>{has ? <span className="link" onClick={() => toggle(r.class_id)}>{summary}</span> : summary}</td>
          <td className="muted">{r.submitted_by_name || '–'}</td>
          <td style={{ whiteSpace: 'nowrap' }}>
            {r.status === 'submitted' && (
              <>
                <button className="btn sm" onClick={() => approve(r)}>Duyệt</button>{' '}
                <button className="btn ghost sm" onClick={() => setRevising(r)}>Yêu cầu xem lại</button>
              </>
            )}
            {r.status === 'approved' && <span className="tag-chip tone-green">✓ Đã duyệt</span>}
            {r.status === 'revision' && <span className="tag-chip tone-red">Đã trả lại GLV</span>}
            {r.status === 'none' && <span className="muted" style={{ fontSize: 12 }}>Chờ GLV gửi</span>}
          </td>
        </tr>
        {has && open[r.class_id] && (
          <tr className="rv-detail"><td colSpan={5}><ReviewDetail r={r} /></td></tr>
        )}
      </Fragment>
    );
  });
  const renderTable = (list) => (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Lớp</th><th>Loại</th><th>Kết quả</th><th>GLV gửi</th><th></th></tr></thead>
        <tbody>{renderRows(list)}</tbody>
      </table>
    </div>
  );
  return (
    <div data-tour="dash-reviews" className="panel" style={{ marginBottom: 18 }}>
      {catActive && (
        <>
          <div className="card-head">
            <h2><IconList className="h-ic" />Lớp giáo lý trong năm chờ duyệt (cuối năm)</h2>
            <span className="muted" style={{ fontSize: 13 }}>{approved}/{total} lớp đã duyệt</span>
          </div>
          {renderTable(cat)}
          {approved === total && total > 0 && (
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>✓ Tất cả lớp giáo lý trong năm đã được duyệt, có thể "Kết thúc năm học & lên lớp" ở mục Cài đặt.</p>
          )}
        </>
      )}
      {ext.length > 0 && (
        <div style={{ marginTop: catActive ? 20 : 0 }}>
          <div className="card-head">
            <h2><IconGradCap className="h-ic" />Lớp giáo lý ngoại thường chờ duyệt</h2>
            <span className="muted" style={{ fontSize: 13 }}>Duyệt riêng · không ảnh hưởng kết thúc năm học</span>
          </div>
          {renderTable(ext)}
        </div>
      )}
      {revising && <RevisionModal r={revising} onClose={() => setRevising(null)} onSend={(note) => revise(revising, note)} />}
    </div>
  );
}

function RevisionModal({ r, onClose, onSend }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (busy) return;
    if (!note.trim()) { toast.err('Ghi rõ cần chỉnh gì để giáo lý viên biết'); return; }
    setBusy(true);
    try { await onSend(note.trim()); } finally { setBusy(false); }
  }
  async function close() {
    if (note.trim() && !(await confirmDialog('Bỏ ghi chú đang viết?'))) return;
    onClose();
  }
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="dbxRevT">
        <h2 id="dbxRevT">Trả lại lớp "{r.class_name}"</h2>
        <p className="muted" style={{ marginTop: -4 }}>Giáo lý viên{r.submitted_by_name ? ` ${r.submitted_by_name}` : ''} sẽ thấy ghi chú này trên trang Tổng quan và gửi lại sau khi sửa.</p>
        <div className="field"><label>Cần chỉnh gì</label>
          <textarea rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="VD: Em Giuse Hà đủ điều kiện lên lớp, vui lòng xem lại." />
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={close} disabled={busy}>Hủy</button>
          <button className="btn" onClick={send} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi lại cho giáo lý viên'}</button>
        </div>
      </div>
    </div>
  );
}

// GLV: trạng thái chốt lớp của CÁC LỚP MÌNH — nhắc khi cổng mở + báo duyệt / cần xem lại.
function ClassReviewsGLV() {
  const { parish } = useParish();
  const promotionOpen = !!parish?.settings?.promotion_open;
  const [rows, setRows] = useState(null);
  const load = () => api.get('/reviews-pending').then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const rev = useRealtime(['class_reviews', 'classes']);
  useEffect(() => { if (rev) load(); }, [rev]); // eslint-disable-line
  if (!rows) return null;
  const relevant = (rows || []).filter((r) =>
    r.status === 'submitted' || r.status === 'approved' || r.status === 'revision'
    || (r.status === 'none' && (r.kind === 'external' || promotionOpen)));
  if (relevant.length === 0) return null;
  const statusChip = (r) => {
    if (r.status === 'submitted') return <span className="tag-chip tone-yellow">Chờ Admin duyệt</span>;
    if (r.status === 'approved') return <span className="tag-chip tone-green">✓ Đã duyệt</span>;
    if (r.status === 'revision') return <span className="tag-chip tone-red">Cần xem lại</span>;
    return <span className="muted" style={{ fontSize: 12 }}>Chưa gửi</span>;
  };
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="card-head"><h2><IconFlag className="h-ic" />Chốt lớp cuối năm</h2></div>
      {promotionOpen && (
        <div className="info-box" style={{ marginBottom: 10 }}>
          Ban giáo lý đã <b>mở kỳ xét lên lớp</b>. Vào <b>Lớp học</b> → bấm <b>Kết thúc lớp</b> để gửi kết quả (lên lớp / ở lại) cho từng lớp giáo lý trong năm của bạn.
        </div>
      )}
      <div className="table-scroll"><table>
        <thead><tr><th>Lớp</th><th>Loại</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {relevant.map((r) => (
            <Fragment key={r.class_id}>
              <tr>
                <td>{r.class_name}{r.is_graduation && <IconGradCap className="bi" style={{ width: 14, height: 14, marginLeft: 4 }} />}</td>
                <td className="muted">{r.kind === 'external' ? 'Ngoại thường' : 'Trong năm'}</td>
                <td>{statusChip(r)}</td>
              </tr>
              {r.status === 'revision' && r.admin_note && (
                <tr><td colSpan={3}><div className="note-box err" style={{ margin: '2px 0 6px' }}>Admin yêu cầu xem lại: {r.admin_note}</div></td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

const NA = <span className="muted">–</span>;
const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const WD = ['CN', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7'];
const wdOf = (s) => WD[new Date(s + 'T00:00:00').getDay()];

// Khối "Cần chú ý": lớp chưa điểm danh buổi gần nhất, học viên vắng liền, lớp chưa có cột điểm.
// Mặc định thu gọn, chỉ hiện con số theo từng loại; bấm để xổ xuống (nhớ trên máy này).
function Attention({ att, navigate }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('dash_attention_open') === '1'; } catch { return false; } });
  const [more, setMore] = useState(false);
  if (!att) return null;
  const { notMarked = [], absentStreak = [], noColumns = [] } = att;
  const total = notMarked.length + absentStreak.length + noColumns.length;
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem('dash_attention_open', v ? '1' : '0'); } catch { /* noop */ } };
  const goAtt = (cid, date) => { rememberClass(cid); navigate(`/attendance${date ? `?date=${date}` : ''}`); };
  const shownAbs = more ? absentStreak : absentStreak.slice(0, 5);
  const groups = [
    notMarked.length && { k: 'm', tone: 'warn', label: `${notMarked.length} lớp chưa điểm danh` },
    absentStreak.length && { k: 'a', tone: 'bad', label: `${absentStreak.length} em vắng liền từ 3 buổi` },
    noColumns.length && { k: 'g', tone: 'info', label: `${noColumns.length} lớp chưa có cột điểm` },
  ].filter(Boolean);
  if (total === 0) {
    return <div className="panel dbx-att dbx-att-ok" data-tour="dash-attention"><p className="dbx-ok"><IconCheck className="bi" />Mọi việc đều ổn: các lớp đã điểm danh buổi gần nhất, không em nào vắng liền 3 buổi.</p></div>;
  }
  return (
    <div className={`panel dbx-att${open ? ' open' : ''}`} data-tour="dash-attention">
      <button type="button" className="dbx-att-head" onClick={toggle} aria-expanded={open}>
        <IconAlert className="h-ic" />
        <span className="dbx-att-title">Cần chú ý</span>
        <span className="dbx-count">{total}</span>
        <span className="dbx-att-sum">{groups.map((g) => <span key={g.k} className={`dbx-tag ${g.tone}`}>{g.label}</span>)}</span>
        <span className="dbx-att-tog">{open ? 'Thu gọn' : 'Xem'}<svg className="dbx-chev" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </button>
      {open && (
        <div className="dbx-att-list">
          {notMarked.length > 0 && <div className="dbx-sec">Điểm danh ({notMarked.length})</div>}
          {notMarked.map((c) => (
            <div key={'m' + c.class_id} className="dbx-item">
              <span className="dbx-text"><b>{c.name}</b>{c.never ? ' chưa điểm danh buổi nào' : <> chưa điểm danh buổi {c.today ? 'hôm nay' : `${wdOf(c.expected)} ${dm(c.expected)}`} <span className="muted">(lần gần nhất {dm(c.last)})</span></>}</span>
              <button className="btn ghost sm" onClick={() => goAtt(c.class_id, c.never ? '' : c.expected)}>Điểm danh</button>
            </div>
          ))}
          {absentStreak.length > 0 && <div className="dbx-sec">Vắng liền từ 3 buổi ({absentStreak.length})</div>}
          {shownAbs.map((s) => (
            <div key={'a' + s.id} className="dbx-item">
              <span className="dbx-text"><span className="link-name" onClick={() => navigate(`/students/${s.id}`)}>{s.name}</span> <span className="muted">· {s.class_name} · vắng {s.streak} buổi liền từ {dm(s.since)}</span></span>
              {s.phone ? <a className="btn ghost sm" href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>Gọi {s.phone}</a> : <span className="muted dbx-nophone">Chưa có SĐT phụ huynh</span>}
            </div>
          ))}
          {absentStreak.length > 5 && <button type="button" className="dbx-more" onClick={() => setMore(!more)}>{more ? 'Thu gọn' : `Xem thêm ${absentStreak.length - 5} em vắng liền`}</button>}
          {noColumns.length > 0 && <div className="dbx-sec">Điểm số ({noColumns.length})</div>}
          {noColumns.map((c) => (
            <div key={'g' + c.class_id} className="dbx-item">
              <span className="dbx-text"><b>{c.name}</b> chưa có cột điểm nào</span>
              <button className="btn ghost sm" onClick={() => navigate(`/grades?class=${c.class_id}`)}>Thêm cột điểm</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [year, setYear] = useState('');
  const [switching, setSwitching] = useState(false);
  const [lbClasses, setLbClasses] = useState([]);
  const [lbClass, setLbClass] = useState('');
  const [lbPeriod, setLbPeriod] = useState('all');

  function loadDash(y) {
    setSwitching(true);
    api.get('/dashboard' + (y ? `?year=${encodeURIComponent(y)}` : '')).then((r) => {
      setData(r.data);
      const yr = r.data.year || '';
      setYear(yr);
      // danh sách lớp cho bảng thi đua theo năm được xem
      const url = (!yr || yr === r.data.currentYear) ? '/classes' : `/archive-classes?year=${encodeURIComponent(yr)}`;
      api.get(url).then((cr) => {
        setLbClasses(cr.data);
        const hasStu = new Set((r.data.classAverages || []).filter((c) => c.count > 0).map((c) => c.id));
        setLbClass((prev) => (cr.data.some((c) => c.id === prev) ? prev : ((cr.data.find((c) => hasStu.has(c.id)) || cr.data[0])?.id || '')));
      }).catch(() => { setLbClasses([]); setLbClass(''); });
    }).catch(() => toast.err('Không tải được số liệu tổng quan')).finally(() => setSwitching(false));
  }
  const [searchParams] = useSearchParams();
  // ?year= (từ trang Lưu trữ: xem Tổng quan của năm đó)
  useEffect(() => { loadDash(searchParams.get('year') || undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rev = useRealtime(['grades', 'attendance', 'students', 'classes', 'class_teachers']);
  useEffect(() => { if (rev) loadDash(year); }, [rev]);

  if (!data) return <SkeletonDashboard />;

  const { counts, classAverages, attendanceByWeek = [] } = data;
  const isCurrent = !data.currentYear || year === data.currentYear;
  const now = new Date();
  const _today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const lbRange = (isCurrent && lbPeriod === 'month') ? { from: _today.slice(0, 8) + '01', to: _today } : { from: '2000-01-01', to: _today };

  return (
    <div className={switching ? 'dbx-loading' : ''}>
      <PageHeader title="Tổng quan" subtitle={isCurrent ? (isAdmin ? 'Tình hình các lớp giáo lý của giáo xứ trong năm học.' : 'Tình hình các lớp bạn phụ trách trong năm học.') : `Đang xem lại dữ liệu năm học ${year} (đã lưu trữ).`}>
        {data.years?.length > 1 && (
          <select value={year} onChange={(e) => loadDash(e.target.value)} style={{ width: 190 }} disabled={switching}>
            {data.years.map((y) => <option key={y} value={y}>Năm học {y}{y === data.currentYear ? ' (hiện tại)' : ''}</option>)}
          </select>
        )}
      </PageHeader>

      {/* Thẻ thống kê */}
      <div className="dash-stats">
        <div className="dash-stat st-purple">
          <div><div className="lbl">Học viên</div><div className="num">{counts.students}</div></div>
          <div className="ic"><IconStudents /></div>
        </div>
        <div className="dash-stat st-peach">
          <div><div className="lbl">Lớp học</div><div className="num">{counts.classes}</div></div>
          <div className="ic"><IconClass /></div>
        </div>
        <div className="dash-stat st-blue">
          <div><div className="lbl">Giáo lý viên</div><div className="num">{counts.teachers}</div></div>
          <div className="ic"><IconTeacher /></div>
        </div>
        <div className="dash-stat st-green" title="Có mặt / (có mặt + trễ + vắng không phép), 4 tuần gần nhất">
          <div><div className="lbl">{isCurrent ? 'Chuyên cần 4 tuần' : 'Chuyên cần'}</div><div className="num">{counts.attRecent != null ? `${counts.attRecent}%` : NA}</div></div>
          <div className="ic"><IconCheck /></div>
        </div>
        <div className="dash-stat dbx-st-gold" title="Trung bình điểm TB có hệ số của các học viên">
          <div><div className="lbl">Điểm TB</div><div className="num">{counts.avgScore != null ? counts.avgScore : NA}</div></div>
          <div className="ic"><IconGrades /></div>
        </div>
      </div>

      {isCurrent && <Attention att={data.attention} navigate={navigate} />}

      {isCurrent && (
        <div className="quick-actions">
          <button onClick={() => navigate('/attendance')}><IconCheck /><span><b>Điểm danh</b><small>Ghi có mặt / vắng buổi học</small></span></button>
          <button onClick={() => navigate('/grades')}><IconGrades /><span><b>Nhập điểm</b><small>Cập nhật bảng điểm lớp</small></span></button>
          <button onClick={() => navigate('/random')}><IconDice /><span><b>Chọn trả bài</b><small>Bốc thăm học viên lên trả bài</small></span></button>
          <button onClick={() => navigate('/students')}><IconStudents /><span><b>Học viên</b><small>Tra cứu, thêm, sửa hồ sơ</small></span></button>
        </div>
      )}

      {isAdmin ? <ClassReviews /> : <ClassReviewsGLV />}

      {/* Bảng xếp hạng thi đua (bảng xếp hạng duy nhất, theo tỷ lệ giáo xứ đặt) */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2><IconTrophy className="h-ic" />Bảng xếp hạng thi đua{!isCurrent && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> · năm {year}</span>}</h2>
          {isCurrent && (
            <select value={lbPeriod} onChange={(e) => setLbPeriod(e.target.value)} style={{ width: 150 }}>
              <option value="all">Toàn bộ</option>
              <option value="month">Tháng này</option>
            </select>
          )}
        </div>
        {lbClasses.length > 1 && (
          <div className="lb-tabs">
            {lbClasses.map((c) => (
              <button key={c.id} className={lbClass === c.id ? 'on' : ''} onClick={() => setLbClass(c.id)}>{c.name}</button>
            ))}
          </div>
        )}
        {lbClass ? <LeaderboardTable classId={lbClass} range={lbRange} /> : <p className="muted">Chưa có lớp nào.</p>}
      </div>

      <div className="dbx-grid">
        {/* Kết quả theo lớp */}
        <div className="panel">
          <div className="card-head"><h2>Kết quả theo lớp</h2><span className="muted" style={{ fontSize: 12 }}>Điểm TB có hệ số · Chuyên cần</span></div>
          <div className="perf">
            {classAverages.map((c, i) => {
              const pct = c.avg != null ? Math.min((c.avg / 10) * 100, 100) : 0;
              const color = PALETTE[i % PALETTE.length];
              return (
                <div className="item click-row" key={c.id} onClick={() => navigate(`/grades?class=${c.id}`)}>
                  <div className="cls">{c.name}<span className="cls-sub">{c.count} HV</span></div>
                  {c.avg != null ? (
                    <div className="track" title="Điểm trung bình của lớp">
                      <div className="fill" style={{ width: `${pct}%`, background: color }}>{c.avg}</div>
                    </div>
                  ) : <div className="track-empty">Chưa có điểm</div>}
                  <div className="score">{c.rate != null ? <span className="cc-chip" title="Tỷ lệ chuyên cần">CC {c.rate}%</span> : <span className="muted" style={{ fontSize: 12 }}>Chưa điểm danh</span>}</div>
                </div>
              );
            })}
            {classAverages.length === 0 && (
              <div className="muted" style={{ textAlign: 'center', padding: 12 }}>Chưa có lớp nào</div>
            )}
          </div>
        </div>

        {/* Biểu đồ điểm danh theo tuần */}
        <div className="panel">
          <div className="card-head"><h2>Tỷ lệ có mặt theo tuần</h2><span className="muted" style={{ fontSize: 12 }}>8 tuần gần nhất</span></div>
          <WeeklyChart data={attendanceByWeek} />
        </div>
      </div>
    </div>
  );
}
