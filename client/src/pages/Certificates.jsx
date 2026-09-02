import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { supabase } from '../supabase';
import { exportCertificates } from '../lib/certificate';
import { printCert, BUILTIN_FRAMES, CERT_ORIENT } from '../lib/certTemplates';
import { fileToPngBlob } from '../lib/img';

const TYPES = [
  { key: 'baptism', label: 'Rửa Tội & Thêm Sức' },
  { key: 'marriage', label: 'Giáo Lý Hôn Nhân' },
  { key: 'scout', label: 'Huynh Trưởng' },
  { key: 'merit', label: 'Giấy khen' },
];
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function Certificates() {
  const [parish, setParish] = useState(null);
  const [currentClasses, setCurrentClasses] = useState([]);
  const [currentYear, setCurrentYear] = useState('');
  const [archYears, setArchYears] = useState([]);
  const [year, setYear] = useState('');
  const [classes, setClasses] = useState([]);
  const [kind, setKind] = useState('baptism');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');
  const [meritTitle, setMeritTitle] = useState('GIẤY KHEN');
  const [meritReason, setMeritReason] = useState('');
  // thông tin in trên chứng chỉ thiết kế
  const [priestName, setPriestName] = useState('');
  const [extra, setExtra] = useState({ place: '', issue_date: todayStr(), role: 'Anh', level: 'I' });
  const setE = (k) => (e) => setExtra((x) => ({ ...x, [k]: e.target.value }));
  // Khung (frame) chứng chỉ
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [customFrames, setCustomFrames] = useState([]);
  const [selFrame, setSelFrame] = useState('');
  const [frameBusy, setFrameBusy] = useState(false);
  const loadFrames = () => api.get('/cert-frames').then((r) => setCustomFrames(r.data || [])).catch(() => setCustomFrames([]));
  useEffect(() => { loadFrames(); }, []);

  useEffect(() => {
    api.get('/parish').then((r) => {
      setParish(r.data);
      setExtra((x) => ({ ...x, place: x.place || r.data?.name || '' }));
      setPriestName((p) => p || r.data?.settings?.priest_name || '');
    }).catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      api.get('/classes').then((r) => r.data).catch(() => []),
      api.get('/archive-years').then((r) => r.data).catch(() => []),
    ]).then(([cur, ay]) => {
      const cy = cur.map((c) => c.year).find(Boolean) || '';
      setCurrentClasses(cur); setCurrentYear(cy); setArchYears(ay || []);
      setYear(cy || (ay?.[0]?.year || ''));
    });
  }, []);

  const isCurrentYear = !!year && year === currentYear;
  useEffect(() => {
    setClassId(''); setStudents([]); setPicked([]);
    if (!year) { setClasses([]); return; }
    if (year === currentYear) { setClasses(currentClasses); return; }
    api.get(`/archive-classes?year=${encodeURIComponent(year)}`).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [year, currentYear, currentClasses]);
  useEffect(() => {
    if (!classId) { setStudents([]); setPicked([]); return; }
    const req = isCurrentYear
      ? api.get(`/students?class_id=${classId}`).then((r) => r.data)
      : api.get(`/archive-class?class_id=${classId}`).then((r) => r.data.students || []);
    req.then((list) => { setStudents(list); setPicked(list.map((s) => s.id)); }).catch(() => {});
  }, [classId, isCurrentYear]);

  const yearOptions = useMemo(() => [
    ...(currentYear ? [{ value: currentYear, label: `${currentYear} (hiện tại)` }] : []),
    ...(archYears || []).filter((a) => a.year && a.year !== currentYear).map((a) => ({ value: a.year, label: a.year })),
  ], [currentYear, archYears]);

  const cls = classes.find((c) => c.id === classId) || {};
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter((s) => !t || ((s.full_name || '') + ' ' + (s.saint_name || '')).toLowerCase().includes(t));
  }, [students, search]);
  const allPicked = students.length > 0 && students.every((s) => picked.includes(s.id));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(allPicked ? [] : students.map((s) => s.id));
  const isMerit = kind === 'merit';
  const isBaptism = kind === 'baptism';
  const frames = useMemo(() => [
    ...(BUILTIN_FRAMES[kind] || []).map((f) => ({ ...f, builtin: true })),
    ...customFrames.filter((f) => f.type === kind).map((f) => ({ ...f, builtin: false })),
  ], [kind, customFrames]);
  const customCount = frames.filter((f) => !f.builtin).length;
  useEffect(() => {
    setSelFrame((cur) => (frames.some((f) => f.url === cur) ? cur : (frames[0]?.url || '')));
  }, [frames]);

  async function uploadFrame(file) {
    if (!file || !parish?.id) return;
    if (customCount >= 2) { alert('Mỗi loại chỉ được thêm tối đa 2 khung tùy chỉnh (chưa tính khung mặc định).'); return; }
    setFrameBusy(true);
    try {
      const blob = await fileToPngBlob(file, 2000);
      const path = `${parish.id}/${kind}/${Date.now()}.png`;
      const up = await supabase.storage.from('cert-frames').upload(path, blob, { upsert: true, contentType: 'image/png' });
      if (up.error) throw new Error(up.error.message);
      const pub = supabase.storage.from('cert-frames').getPublicUrl(path).data.publicUrl;
      await api.post('/cert-frames', { type: kind, name: (file.name || 'Khung').replace(/\.[^.]+$/, '').slice(0, 40) || 'Khung', url: pub });
      await loadFrames();
      setSelFrame(pub);
    } catch (e) {
      alert('Tải khung thất bại: ' + (e.message || e) + '\n(Đã chạy migration cert_frames & tạo bucket "cert-frames" chưa?)');
    } finally { setFrameBusy(false); }
  }
  async function delFrame(f) {
    if (!confirm(`Xoá khung "${f.name}"?`)) return;
    try {
      await api.delete(`/cert-frames/${f.id}`);
      const p = (f.url || '').split('/cert-frames/')[1];
      if (p) await supabase.storage.from('cert-frames').remove([decodeURIComponent(p)]).catch(() => {});
      await loadFrames();
    } catch (e) { alert('Không xoá được: ' + (e.message || e)); }
  }

  const [msg, setMsg] = useState('');
  const BATCH_KEYS = ['baptism_date', 'baptism_church', 'baptism_book_no', 'baptism_priest', 'confirmation_date', 'confirmation_church', 'confirmation_bishop', 'confirmation_godparent', 'confirmation_book_no'];

  function certLogName() {
    if (kind === 'marriage') return 'Chứng chỉ Giáo lý Hôn nhân';
    if (kind === 'scout') return 'Chứng chỉ Huynh Trưởng' + (extra.level ? ` cấp ${extra.level}` : '');
    if (kind === 'baptism' || kind === 'baptism2') return 'Chứng chỉ Rửa Tội & Thêm Sức';
    if (isMerit) return (meritTitle || 'Giấy khen').trim();
    return 'Chứng chỉ';
  }
  // Ghi lịch sử cấp chứng chỉ vào hồ sơ (certificates jsonb) — xem lại được kể cả sau khi ra trường.
  async function logCert(sel, date) {
    const name = certLogName();
    await Promise.all(sel.map((s) => {
      const list = Array.isArray(s.certificates) ? [...s.certificates] : [];
      const i = list.findIndex((c) => c && c.name === name);
      const entry = { name, date };
      if (i >= 0) list[i] = entry; else list.push(entry);
      return api.put(`/students/${s.id}`, { certificates: list }).then(() => { s.certificates = list; }).catch(() => {});
    }));
  }

  async function issue() {
    const sel = students.filter((s) => picked.includes(s.id));
    if (!sel.length) { alert('Chưa chọn học viên nào'); return; }
    const issueDate = extra.issue_date || todayStr();
    if (isMerit) {
      exportCertificates({ parish, students: sel, kind: 'merit', merit: { title: meritTitle, reason: meritReason, className: cls.name, year: cls.year } });
    } else {
      const parishForCert = { ...parish, priest_name: priestName, priest_signature: parish?.settings?.priest_signature };
      printCert({ type: kind, frame: selFrame, parish: parishForCert, students: sel, extra });
      // Rửa Tội & Thêm Sức: áp thông tin chung -> ghi vào hồ sơ từng em
      if (isBaptism) {
        const patch = {};
        BATCH_KEYS.forEach((k) => { if (extra[k]) patch[k] = extra[k]; });
        if (Object.keys(patch).length) await Promise.all(sel.map((s) => api.put(`/students/${s.id}`, patch).catch(() => {})));
      }
    }
    setMsg('Đang lưu vào hồ sơ…');
    await logCert(sel, issueDate);
    setMsg(`Đã cấp & lưu vào hồ sơ ${sel.length} em (xem lại ở hồ sơ học viên → mục Chứng chỉ).`);
    setTimeout(() => setMsg(''), 5000);
  }

  return (
    <div>
      <div className="att-head"><h1 style={{ margin: 0 }}>Cấp chứng chỉ / Giấy khen</h1></div>

      <div className="panel">
        <div className="field">
          <label>Loại chứng chỉ</label>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {TYPES.map((t) => <button key={t.key} type="button" className={`seg-btn ${kind === t.key ? 'on' : ''}`} onClick={() => setKind(t.key)}>{t.label}</button>)}
          </div>
        </div>

        {isMerit ? (
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Tiêu đề</label><input value={meritTitle} onChange={(e) => setMeritTitle(e.target.value)} placeholder="GIẤY KHEN" /></div>
            <div className="field" style={{ flex: 2 }}><label>Nội dung khen</label><input value={meritReason} onChange={(e) => setMeritReason(e.target.value)} placeholder="VD: đạt thành tích xuất sắc trong học tập giáo lý" /></div>
          </div>
        ) : (
          <>
            <div className="field">
              <label>Khung chứng chỉ {frames.length > 1 && <span className="muted" style={{ fontWeight: 400 }}>— chọn mẫu khung muốn dùng</span>}</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {frames.map((f) => {
                  const land = (CERT_ORIENT[kind] || 'portrait') === 'landscape';
                  const on = selFrame === f.url;
                  const box = { position: 'relative', width: land ? 132 : 86, cursor: 'pointer' };
                  const imgBox = { width: '100%', height: land ? 94 : 122, border: on ? '2px solid var(--brand,#2563eb)' : '1px solid var(--border,#d1d5db)', borderRadius: 6, boxShadow: on ? '0 0 0 2px rgba(37,99,235,.25)' : 'none', background: '#fff', overflow: 'hidden', display: 'flex' };
                  return (
                    <div key={f.url} style={box} onClick={() => setSelFrame(f.url)} title={f.name}>
                      <div style={imgBox}><img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{f.name}{f.builtin ? '' : ' •'}</div>
                      {isAdmin && !f.builtin && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); delFrame(f); }} title="Xoá khung" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', lineHeight: '18px', padding: 0, fontSize: 14 }}>×</button>
                      )}
                    </div>
                  );
                })}
                {isAdmin && customCount < 2 && (
                  <label style={{ width: (CERT_ORIENT[kind] || 'portrait') === 'landscape' ? 132 : 86, height: (CERT_ORIENT[kind] || 'portrait') === 'landscape' ? 94 : 122, border: '1px dashed var(--border,#94a3b8)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', color: 'var(--muted,#64748b)', fontSize: 12 }}>
                    <input type="file" accept="image/*" hidden disabled={frameBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadFrame(f); }} />
                    <span>{frameBusy ? '⏳ Đang tải…' : <>＋<br />Thêm khung</>}</span>
                  </label>
                )}
              </div>
              {isAdmin && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Khung bạn thêm (đánh dấu •) áp dụng cho <b>mọi GLV</b> trong giáo xứ — tối đa 2 khung/loại, ngoài khung mặc định.</p>}
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}><label>Người ký (Linh mục / Trưởng ban)</label><input value={priestName} onChange={(e) => setPriestName(e.target.value)} placeholder="VD: Phêrô Nguyễn Văn An" /></div>
              <div className="field" style={{ flex: 1 }}><label>Nơi cấp</label><input value={extra.place} onChange={setE('place')} placeholder="VD: Hòa Khánh" /></div>
              <div className="field" style={{ flex: '0 0 160px' }}><label>Ngày cấp</label><input type="date" value={extra.issue_date} onChange={setE('issue_date')} /></div>
            </div>
            {kind === 'marriage' && (
              <div className="row">
                <div className="field" style={{ flex: '0 0 120px' }}><label>Vai</label><select value={extra.role} onChange={setE('role')}><option>Anh</option><option>Chị</option></select></div>
                <div className="field" style={{ flex: 2 }}><label>Dòng chứng nhận</label><input value={extra.certify_line || ''} onChange={setE('certify_line')} placeholder="VD: Linh mục Giáo xứ Nam Tây chứng nhận" /></div>
              </div>
            )}
            {kind === 'scout' && (
              <>
                <div className="row">
                  <div className="field" style={{ flex: 2 }}><label>Ban tổ chức</label><input value={extra.org2 || ''} onChange={setE('org2')} placeholder="Ban Giáo lý & Mục vụ Thiếu nhi" /></div>
                  <div className="field" style={{ flex: 1 }}><label>Giáo họ</label><input value={extra.giao_ho || ''} onChange={setE('giao_ho')} /></div>
                </div>
                <div className="row">
                  <div className="field" style={{ flex: 2 }}><label>Sa mạc tại</label><input value={extra.samac || ''} onChange={setE('samac')} placeholder="Tên/địa điểm sa mạc" /></div>
                  <div className="field" style={{ flex: '0 0 90px' }}><label>Cấp</label><input value={extra.level} onChange={setE('level')} placeholder="I" /></div>
                  <div className="field" style={{ flex: '0 0 160px' }}><label>Ngày khai mạc</label><input type="date" value={extra.open_date || ''} onChange={setE('open_date')} /></div>
                  <div className="field" style={{ flex: '0 0 120px' }}><label>Vào sổ số</label><input value={extra.sono || ''} onChange={setE('sono')} /></div>
                </div>
              </>
            )}
            {isBaptism && (
              <div className="panel" style={{ background: 'var(--surface-2, #f8fafc)', padding: 12, margin: '4px 0' }}>
                <div className="fp-label" style={{ marginBottom: 6 }}>Thông tin chung cho cả lớp <span className="muted" style={{ fontWeight: 400 }}>— điền 1 lần, áp cho mọi em được chọn &amp; tự lưu vào hồ sơ. Để trống thì dùng dữ liệu riêng của từng em.</span></div>
                <div className="row">
                  <div className="field"><label>Đã Rửa Tội ngày</label><input type="date" value={extra.baptism_date || ''} onChange={setE('baptism_date')} /></div>
                  <div className="field"><label>Nhà thờ Rửa Tội</label><input value={extra.baptism_church || ''} onChange={setE('baptism_church')} /></div>
                  <div className="field"><label>Trích sổ Rửa Tội</label><input value={extra.baptism_book_no || ''} onChange={setE('baptism_book_no')} /></div>
                  <div className="field"><label>Do Linh mục</label><input value={extra.baptism_priest || ''} onChange={setE('baptism_priest')} /></div>
                </div>
                <div className="row">
                  <div className="field"><label>Đã Thêm Sức ngày</label><input type="date" value={extra.confirmation_date || ''} onChange={setE('confirmation_date')} /></div>
                  <div className="field"><label>Nhà thờ Thêm Sức</label><input value={extra.confirmation_church || ''} onChange={setE('confirmation_church')} /></div>
                  <div className="field"><label>Do Đức Giám mục</label><input value={extra.confirmation_bishop || ''} onChange={setE('confirmation_bishop')} /></div>
                </div>
                <div className="row">
                  <div className="field"><label>Người đỡ đầu Thêm Sức</label><input value={extra.confirmation_godparent || ''} onChange={setE('confirmation_godparent')} /></div>
                  <div className="field"><label>Trích sổ Thêm Sức</label><input value={extra.confirmation_book_no || ''} onChange={setE('confirmation_book_no')} /></div>
                </div>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: -2 }}>
              Tên, ngày sinh, cha mẹ, nơi sinh… lấy từ <b>hồ sơ từng em</b> (Học viên → hồ sơ → "Chi tiết cho chứng chỉ"). Các trường chung ở trên áp cho cả lớp. Người ký &amp; chữ ký lấy từ Cài đặt giáo xứ.
            </p>
          </>
        )}

        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Niên khóa</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.length === 0 && <option value="">— Chưa có —</option>}
              {yearOptions.map((y) => <option key={y.value} value={y.value}>Niên khóa {y.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Lớp</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!classes.length}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Tìm học viên</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên…" disabled={!classId} /></div>
        </div>

        {!classId ? (
          <p className="muted">Chọn niên khóa &amp; lớp để hiện danh sách học viên; sau đó tick chọn rồi bấm Xuất.</p>
        ) : students.length === 0 ? (
          <p className="muted">Lớp chưa có học viên.</p>
        ) : (
          <>
            <div className="fp-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Đã chọn {picked.length}/{students.length}</span>
              <span className="link" onClick={toggleAll}>{allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
            </div>
            <div className="pick-list">
              {shown.map((s) => (
                <label key={s.id} className="fp-chk">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</span>
                </label>
              ))}
              {shown.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Không tìm thấy học viên.</div>}
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={issue} disabled={!picked.length}>🖨 Xuất {picked.length > 1 ? `${picked.length} tờ` : 'chứng chỉ'} (PDF)</button>
          {msg && <div className="info-box" style={{ marginTop: 8 }}>{msg}</div>}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Chọn "Lưu thành PDF" trong hộp thoại in. Mỗi học viên một trang.</p>
        </div>
      </div>
    </div>
  );
}
