import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import SacramentBadge, { SACRAMENTS } from '../components/SacramentBadge.jsx';
import StudentForm from '../components/StudentForm.jsx';
import { IconEditImage } from '../components/Icons.jsx';
import { fileToDataUrl } from '../lib/img';
import { ATT_LABEL } from '../lib/exportUtils';

const initials = (name = '') => { const p = name.trim().split(/\s+/); return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?'; };
const ATT_TONE = { present: 'ic-present', absent: 'ic-absent', late: 'ic-late', excused: 'ic-excused' };
const ATT_CHAR = { present: '✓', absent: '✗', late: '⏱', excused: '✚' };

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function onPickAvatar(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await fileToDataUrl(file, 240); await api.put(`/students/${id}`, { avatar_url: url }); load(); }
    catch { /* noop */ } finally { setUploading(false); }
  }

  function load() {
    api.get(`/student-profile?id=${id}`).then((r) => setData(r.data)).catch((e) => setErr(e.response?.data?.error || 'Không tải được hồ sơ'));
    api.get(`/student-history?id=${id}`).then((r) => setHistory(r.data)).catch(() => setHistory([]));
  }
  useEffect(() => { load(); }, [id]);

  if (err) return <div><button className="btn ghost sm" onClick={() => navigate(-1)}>← Quay lại</button><p className="muted" style={{ marginTop: 12 }}>{err}</p></div>;
  if (!data) return <div className="muted">Đang tải...</div>;

  const s = data.student;
  const dash = (v) => v || '—';
  const fatherFull = [s.father_saint, s.father_name].filter(Boolean).join(' ') || s.parent_name || '—';
  const motherFull = [s.mother_saint, s.mother_name].filter(Boolean).join(' ') || '—';
  const info = [
    ['Ngày sinh', dash(s.birth_date)],
    ['Giới tính', dash(s.gender)],
    ['Cha', fatherFull],
    ['SĐT cha', dash(s.father_phone || s.parent_phone)],
    ['Mẹ', motherFull],
    ['SĐT mẹ', dash(s.mother_phone)],
    ['Người đỡ đầu', dash(s.godparent_name)],
    ['SĐT học sinh', dash(s.student_phone)],
    ['Ngày rửa tội', dash(s.baptism_date)],
    ['Ngày rước lễ', dash(s.first_communion_date)],
    ['Ngày thêm sức', dash(s.confirmation_date)],
    ['Địa chỉ', dash(s.address)],
  ];

  async function save() {
    try { await api.put(`/students/${id}`, edit); setEdit(null); load(); }
    catch (e) { alert(e.response?.data?.error || 'Lưu thất bại'); }
  }

  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate(-1)}>← Quay lại</button>

      {/* Thẻ đầu hồ sơ */}
      <div className="panel profile-head">
        <div className="profile-ava-wrap">
          {s.avatar_url ? <img className="profile-ava-img" src={s.avatar_url} alt="avatar" /> : <div className="profile-ava">{initials(s.full_name)}</div>}
          {canEdit && (
            <>
              <button className="ava-edit" title="Đổi ảnh học viên" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '…' : <IconEditImage width="14" height="14" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
            </>
          )}
        </div>
        <div className="profile-id">
          <div className="profile-name">{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name} <SacramentBadge value={s.sacrament} /></div>
          <div className="profile-tags">
            <span className="tag-chip">{s.class_name || 'Chưa xếp lớp'}</span>
            {s.position && <span className="tag-chip role">{s.position}</span>}
            <span className="tag-chip muted">{SACRAMENTS[s.sacrament]?.label || 'Chưa nhận bí tích'}</span>
          </div>
        </div>
        {canEdit && <button className="btn" onClick={() => setEdit({ ...s })}>✏ Sửa thông tin</button>}
      </div>

      {/* Chỉ số nhanh */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-mini"><div className="lbl">Điểm trung bình</div><div className="num">{data.tb ?? '—'}</div></div>
        <div className="stat-mini"><div className="lbl">Chuyên cần</div><div className="num">{data.attendance.rate != null ? data.attendance.rate + '%' : '—'}</div></div>
        <div className="stat-mini"><div className="lbl">Có mặt / Vắng / Trễ / Có phép</div><div className="num" style={{ fontSize: 16 }}>{data.attendance.present} / {data.attendance.absent} / {data.attendance.late} / {data.attendance.excused}</div></div>
        <div className="stat-mini"><div className="lbl">Buổi đã điểm danh</div><div className="num">{data.attendance.total}</div></div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          {/* Thông tin cá nhân */}
          <div className="panel">
            <div className="card-head"><h2>Thông tin cá nhân</h2></div>
            <div className="info-grid">
              {info.map(([k, v]) => (<div className="info-row" key={k}><span className="info-k">{k}</span><span className="info-v">{v}</span></div>))}
            </div>
            {Array.isArray(s.certificates) && s.certificates.length > 0 && (
              <div className="info-row" style={{ marginTop: 8 }}>
                <span className="info-k">Chứng chỉ / khóa</span>
                <span className="info-v">{s.certificates.map((c) => c.name + (c.date ? ` (${c.date})` : '')).join('; ')}</span>
              </div>
            )}
            {s.notes && <div className="info-row" style={{ marginTop: 8 }}><span className="info-k">Ghi chú</span><span className="info-v">{s.notes}</span></div>}
          </div>

          {/* Bảng điểm */}
          <div className="panel">
            <div className="card-head"><h2>Điểm số</h2>{s.class_id && <span className="link" onClick={() => navigate(`/grades?class=${s.class_id}`)}>Bảng điểm lớp</span>}</div>
            <table>
              <thead><tr><th>Cột điểm</th><th style={{ textAlign: 'center' }}>Hệ số</th><th style={{ textAlign: 'right' }}>Điểm</th></tr></thead>
              <tbody>
                {data.grades.map((g, i) => (<tr key={i}><td>{g.name}</td><td style={{ textAlign: 'center' }}>{g.weight}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{g.score}</td></tr>))}
                {data.grades.length === 0 && <tr><td colSpan={3} className="muted">Chưa có điểm</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Lịch sử điểm qua các năm */}
          {history.length > 1 && (
            <div className="panel">
              <div className="card-head"><h2>Lịch sử điểm các năm</h2></div>
              <table>
                <thead><tr><th>Năm học</th><th>Lớp</th><th style={{ textAlign: 'right' }}>Điểm TB</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.student_id} className={h.current ? '' : 'click-row'} onClick={h.current ? undefined : () => navigate(`/students/${h.student_id}`)}>
                      <td>{h.year || '—'}{h.current && <span className="tag-chip muted" style={{ marginLeft: 6 }}>năm nay</span>}</td>
                      <td>{h.class_name || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{h.avg ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-col">
          {/* Việc thiêng liêng */}
          <div className="panel">
            <div className="card-head"><h2>Việc thiêng liêng</h2></div>
            <table>
              <tbody>
                {data.spiritual.map((t) => (<tr key={t.task}><td>{t.task}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{t.done}/{t.total}</td></tr>))}
                {data.spiritual.length === 0 && <tr><td className="muted">Chưa có ghi nhận</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Điểm danh gần đây */}
          <div className="panel">
            <div className="card-head"><h2>Điểm danh gần đây</h2></div>
            <div className="att-recent">
              {data.attendance.recent.map((a, i) => (
                <div className="att-recent-row" key={i} title={(ATT_LABEL[a.status] || '') + (a.note ? ' — ' + a.note : '')}>
                  <span>{a.date.split('-').reverse().join('/')}</span>
                  <span className={`att-ic ${ATT_TONE[a.status]}`}>{ATT_CHAR[a.status] || '?'}</span>
                </div>
              ))}
              {data.attendance.recent.length === 0 && <div className="muted">Chưa có buổi điểm danh</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal sửa thông tin */}
      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sửa thông tin học viên</h2>
            <StudentForm form={edit} setForm={setEdit} />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEdit(null)}>Hủy</button>
              <button className="btn" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
