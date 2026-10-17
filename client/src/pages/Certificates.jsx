import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { viError } from '../lib/viError';
import { supabase } from '../supabase';
import { printCert, certPageHtml, frameInset, BUILTIN_FRAMES, CERT_ORIENT } from '../lib/certTemplates';
import { fileToPngBlob } from '../lib/img';
import { IconAlert, IconPrinter, IconSave } from '../components/Icons.jsx';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';

const TYPES = [
  { key: 'baptism', label: 'Rửa Tội & Thêm Sức' },
  { key: 'first_communion', label: 'Rước Lễ lần đầu' },
  { key: 'marriage', label: 'Giáo Lý Hôn Nhân' },
  { key: 'merit', label: 'Giấy khen' },
  { key: 'scout', label: 'Huynh trưởng' },
];
const hasConfirmation = (s) => !!(s.confirmation_date || s.confirmation_church || s.confirmation_bishop || s.confirmation_book_no);
// "12/2026" -> em thứ i được "12+i/2026"; không có số thì giữ nguyên cho mọi em
const nthSono = (start, i) => { const m = /^(\d+)(.*)$/.exec(String(start || '').trim()); return m ? `${Number(m[1]) + i}${m[2]}` : String(start || '').trim(); };
const INSET_MAX = 30;
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
// Bỏ dấu để tìm kiếm
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const nameOf = (s) => [s.saint_name, s.full_name].filter(Boolean).join(' ');
const roleFromGender = (g) => (g === 'Nữ' ? 'Chị' : g === 'Nam' ? 'Anh' : '');
const clampInset = (v) => Math.min(INSET_MAX, Math.max(0, Math.round((Number(v) || 0) * 2) / 2));

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
  const [ranks, setRanks] = useState({});   // vị thứ riêng từng em (giấy khen)
  const [roles, setRoles] = useState({});   // Anh/Chị riêng từng em (hôn nhân)
  const [meritTitle, setMeritTitle] = useState('GIẤY KHEN');
  const [meritReason, setMeritReason] = useState('');
  const [printing, setPrinting] = useState(false);
  const [pv, setPv] = useState(0);          // tờ đang xem trước
  // thông tin in trên chứng chỉ thiết kế
  const [priestName, setPriestName] = useState('');
  const [extra, setExtra] = useState({ place: '', issue_date: todayStr(), level: 'I', org2: 'Ban Giáo lý & Mục vụ Thiếu nhi' });
  const setE = (k) => (e) => setExtra((x) => ({ ...x, [k]: e.target.value }));
  // Khung (frame) chứng chỉ
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [customFrames, setCustomFrames] = useState([]);
  const [selFrame, setSelFrame] = useState('');
  const [frameBusy, setFrameBusy] = useState(false);
  const [insetDraft, setInsetDraft] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [savingInset, setSavingInset] = useState(false);
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
    setPicked([]); setRanks({}); setPv(0);
    if (!classId) { setStudents([]); return; }
    const req = isCurrentYear
      ? api.get(`/students?class_id=${classId}`).then((r) => r.data)
      : api.get(`/archive-class?class_id=${classId}`).then((r) => r.data.students || []);
    req.then((list) => {
      setStudents(list);
      setRoles(Object.fromEntries(list.map((s) => [s.id, roleFromGender(s.gender) || 'Anh'])));
    }).catch(() => toast.err('Không tải được danh sách học viên'));
  }, [classId, isCurrentYear]);

  const yearOptions = useMemo(() => [
    ...(currentYear ? [{ value: currentYear, label: `${currentYear} (hiện tại)` }] : []),
    ...(archYears || []).filter((a) => a.year && a.year !== currentYear).map((a) => ({ value: a.year, label: a.year })),
  ], [currentYear, archYears]);

  const cls = classes.find((c) => c.id === classId) || {};
  const isMerit = kind === 'merit';
  const shown = useMemo(() => {
    const t = fold(search.trim());
    return students.filter((s) => !t || fold(nameOf(s)).includes(t));
  }, [students, search]);
  const allPicked = students.length > 0 && students.every((s) => picked.includes(s.id));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(allPicked ? [] : students.map((s) => s.id));
  // Hồ sơ thiếu gì so với nội dung in của loại chứng chỉ đang chọn
  const missing = (s) => {
    const m = [];
    if (kind === 'merit') return m;
    if (!s.birth_date) m.push('ngày sinh');
    if (kind !== 'scout' && !s.father_name && !s.mother_name) m.push('tên cha mẹ');
    if (kind === 'marriage' && !s.gender) m.push('giới tính');
    if (kind === 'baptism' && !s.baptism_date) m.push('ngày Rửa Tội');
    if (kind === 'first_communion' && !s.first_communion_date) m.push('ngày Rước Lễ');
    return m;
  };
  // Học viên kèm dữ liệu riêng từng tờ (vị thứ, vai)
  const sel = students.filter((s) => picked.includes(s.id));
  const withExtras = (s) => ({
    ...s, _rank: (ranks[s.id] || '').trim(), _role: roles[s.id] || roleFromGender(s.gender) || 'Anh',
    _sono: extra.sono_start ? nthSono(extra.sono_start, Math.max(0, sel.findIndex((x) => x.id === s.id))) : '',
  });
  const missCount = sel.filter((s) => missing(s).length).length;

  const frames = useMemo(() => [
    ...(BUILTIN_FRAMES[kind] || []).map((f) => ({ ...f, builtin: true })),
    ...customFrames.filter((f) => f.type === kind).map((f) => ({ ...f, builtin: false })),
  ], [kind, customFrames]);
  const customCount = frames.filter((f) => !f.builtin).length;
  useEffect(() => {
    setSelFrame((cur) => (frames.some((f) => f.url === cur) ? cur : (frames[0]?.url || '')));
  }, [frames]);

  // Khung THỰC SỰ dùng cho loại hiện tại: nếu selFrame (state) chưa kịp cập nhật
  // sau khi đổi loại thì lấy khung đầu của loại -> tránh ghép nhầm frame loại khác.
  const effFrame = frames.some((f) => f.url === selFrame) ? selFrame : (frames[0]?.url || '');
  const selFrameObj = frames.find((f) => f.url === effFrame) || null;
  const savedInset = frameInset(selFrameObj, parish);
  useEffect(() => {
    setInsetDraft({ top: savedInset.top || 0, right: savedInset.right || 0, bottom: savedInset.bottom || 0, left: savedInset.left || 0 });
  }, [effFrame, customFrames, parish]); // eslint-disable-line
  const insetDirty = ['top', 'right', 'bottom', 'left'].some((k) => (insetDraft[k] || 0) !== (savedInset[k] || 0));

  // Ghi settings giáo xứ: đọc bản mới nhất trước (PUT thay nguyên khối settings)
  async function patchSettings(fn) {
    const { data: fresh } = await api.get('/parish');
    const settings = fn(fresh?.settings || {});
    const { data } = await api.put('/parish', { settings });
    setParish(data || { ...fresh, settings });
  }
  async function saveInset() {
    if (!selFrameObj) return;
    setSavingInset(true);
    try {
      if (selFrameObj.builtin) await patchSettings((st) => ({ ...st, cert_insets: { ...(st.cert_insets || {}), [selFrameObj.id]: insetDraft } }));
      else { await api.put(`/cert-frames/${selFrameObj.id}`, { inset: insetDraft }); await loadFrames(); }
      toast('Đã lưu lề cho khung này');
    } catch (e) { toast.err(e.response?.data?.error || 'Lưu lề thất bại'); }
    finally { setSavingInset(false); }
  }
  async function saveSigner() {
    try { await patchSettings((st) => ({ ...st, priest_name: priestName.trim() })); toast('Đã lưu người ký mặc định'); }
    catch (e) { toast.err(e.response?.data?.error || 'Lưu người ký thất bại'); }
  }
  const signerDirty = priestName.trim() !== (parish?.settings?.priest_name || '');

  const parishForCert = { ...parish, priest_name: priestName, priest_signature: parish?.settings?.priest_signature };
  const certExtra = isMerit
    ? { ...extra, merit_title: meritTitle, merit_reason: meritReason, class_name: cls.name, year: cls.year }
    : extra;
  // Xem trước từng tờ của các em đã chọn (chưa chọn ai thì xem em đầu lớp / mẫu)
  const pvList = sel.length ? sel : students.slice(0, 1);
  const pvIdx = Math.min(pv, Math.max(0, pvList.length - 1));
  const pvStudent = pvList[pvIdx];
  const previewSrc = useMemo(() => {
    const st = pvStudent ? withExtras(pvStudent) : { saint_name: 'Tên Thánh', full_name: 'Nguyễn Văn A', birth_date: '2015-01-01' };
    return certPageHtml({ type: kind, frame: effFrame, inset: insetDraft, parish: parishForCert, students: [st], extra: certExtra });
  }, [kind, effFrame, insetDraft, parish, priestName, extra, meritTitle, meritReason, pvStudent, ranks, roles, cls]); // eslint-disable-line

  async function uploadFrame(file) {
    if (!file || !parish?.id) return;
    if (customCount >= 2) { toast.err('Mỗi loại chỉ thêm được tối đa 2 khung riêng (chưa tính khung mặc định).'); return; }
    if (!/^image\//.test(file.type)) { toast.err('Chọn tệp ảnh (PNG hoặc JPG)'); return; }
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
      toast('Đã thêm khung. Chỉnh lề nếu chữ đè lên hoa văn.');
    } catch (e) {
      toast.err('Không tải được khung lên: ' + viError(e.message || e));
    } finally { setFrameBusy(false); }
  }
  async function delFrame(f) {
    if (!await confirmDialog(`Xóa khung "${f.name}"?\n\nMọi giáo lý viên trong giáo xứ sẽ không dùng được khung này nữa.`)) return;
    try {
      await api.delete(`/cert-frames/${f.id}`);
      const p = (f.url || '').split('/cert-frames/')[1];
      if (p) await supabase.storage.from('cert-frames').remove([decodeURIComponent(p)]).catch(() => {});
      await loadFrames();
      toast(`Đã xóa khung "${f.name}"`);
    } catch (e) { toast.err('Không xóa được: ' + viError(e.message || e)); }
  }

  // Tên mục lưu vào hồ sơ: kèm năm học + vị thứ để lần cấp sau không đè lần trước
  function certLogName(s) {
    if (kind === 'baptism') return hasConfirmation(s) ? 'Chứng chỉ Rửa Tội và Thêm Sức' : 'Chứng chỉ Rửa Tội';
    if (kind === 'first_communion') return 'Chứng nhận Rước Lễ lần đầu';
    if (kind === 'scout') return `Chứng chỉ Huynh trưởng cấp ${extra.level || 'I'}`;
    if (kind === 'marriage') return 'Chứng chỉ Giáo lý Hôn nhân';
    const rank = (ranks[s.id] || '').trim();
    return [(meritTitle || 'Giấy khen').trim(), cls.year, rank ? `Vị thứ ${rank}` : ''].filter(Boolean).join(' · ');
  }
  // Ghi lịch sử cấp vào hồ sơ (certificates jsonb), thêm mục mới, trùng y hệt (tên + ngày) thì bỏ qua
  async function logCert(list, date) {
    const failed = [];
    await Promise.all(list.map((s) => {
      const name = certLogName(s);
      const cur = Array.isArray(s.certificates) ? s.certificates : [];
      if (cur.some((c) => c && c.name === name && c.date === date)) return null;
      const next = [...cur, { name, date }];
      return api.put(`/students/${s.id}`, { certificates: next })
        .then(() => { s.certificates = next; })
        .catch(() => failed.push(nameOf(s)));
    }));
    return failed;
  }

  async function issue() {
    if (!sel.length) { toast.err('Chưa chọn học viên nào'); return; }
    if (missCount && !(await confirmDialog({ message: `${missCount} em thiếu thông tin trong hồ sơ. Vẫn in?\n\nCác dòng thiếu sẽ để trống trên tờ in. Có thể bổ sung ở trang Học viên rồi in lại.`, okText: 'Vẫn in' }))) return;
    setPrinting(true);
    try {
      await printCert({ type: kind, frame: effFrame, inset: insetDraft, parish: parishForCert, students: sel.map(withExtras), extra: certExtra });
    } finally { setPrinting(false); }
    const label = isMerit ? (meritTitle || 'Giấy khen').trim() : TYPES.find((t) => t.key === kind)?.label;
    const yes = await confirmDialog({
      message: `Đã in hoặc lưu PDF xong?\n\nGhi "${label}" vào hồ sơ ${sel.length} em để xem lại sau (kể cả khi đã ra trường).`,
      okText: 'Ghi vào hồ sơ', cancelText: 'Chưa, không ghi',
    });
    if (!yes) return;
    const failed = await logCert(sel, extra.issue_date || todayStr());
    if (failed.length) toast.err(`Chưa ghi được hồ sơ của: ${failed.join(', ')}`);
    else toast(`Đã ghi vào hồ sơ ${sel.length} em (xem ở hồ sơ học viên, mục Chứng chỉ)`);
  }

  const land = (CERT_ORIENT[kind] || 'portrait') === 'landscape';
  return (
    <div className="crx">
      <PageHeader title="Cấp chứng chỉ / Giấy khen" subtitle="Chọn học viên, điền nội dung, xem trước từng tờ rồi in hoặc lưu PDF." />

      <div className="panel">
        <h2 className="crx-h"><span>1</span>Loại</h2>
        <div className="seg crx-seg">
          {TYPES.map((t) => <button key={t.key} type="button" className={`seg-btn ${kind === t.key ? 'on' : ''}`} onClick={() => { setKind(t.key); setPv(0); }}>{t.label}</button>)}
        </div>
      </div>

      <div className="panel">
        <h2 className="crx-h"><span>2</span>Học viên</h2>
        <div className="crx-grid3">
          <div className="field"><label>Niên khóa</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.length === 0 && <option value="">Chưa có</option>}
              {yearOptions.map((y) => <option key={y.value} value={y.value}>Niên khóa {y.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Lớp</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!classes.length}>
              <option value="">Chọn lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Tìm học viên</label><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gõ tên, không cần dấu" disabled={!classId} /></div>
        </div>

        {!classId ? (
          <p className="muted">Chọn niên khóa và lớp để hiện danh sách học viên.</p>
        ) : students.length === 0 ? (
          <p className="muted">Lớp chưa có học viên.</p>
        ) : (
          <>
            <div className="crx-listhead">
              <span>Đã chọn <b>{picked.length}</b>/{students.length}{missCount > 0 && <span className="crx-warn"> · {missCount} em thiếu thông tin</span>}</span>
              <button type="button" className="crx-link" onClick={toggleAll}>{allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
            </div>
            <div className="crx-list">
              {shown.map((s) => {
                const on = picked.includes(s.id);
                const miss = missing(s);
                return (
                  <div key={s.id} className={`crx-row${on ? ' on' : ''}`}>
                    <label className="crx-name">
                      <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
                      <span>{nameOf(s)}{miss.length > 0 && <small className="crx-miss" title={`Hồ sơ thiếu ${miss.join(', ')}`}><IconAlert className="bi" />Thiếu {miss.join(', ')}</small>}</span>
                    </label>
                    {on && isMerit && (
                      <input className="crx-rank" value={ranks[s.id] || ''} onChange={(e) => setRanks((r) => ({ ...r, [s.id]: e.target.value }))} placeholder="Vị thứ" aria-label={`Vị thứ của ${nameOf(s)}`} maxLength={20} />
                    )}
                    {on && kind === 'marriage' && (
                      <select className="crx-role" value={roles[s.id] || 'Anh'} onChange={(e) => setRoles((r) => ({ ...r, [s.id]: e.target.value }))} aria-label={`Vai của ${nameOf(s)}`}>
                        <option>Anh</option><option>Chị</option>
                      </select>
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Không tìm thấy học viên.</div>}
            </div>
            {isMerit && picked.length > 0 && <p className="muted crx-hint">Vị thứ nhập riêng cho từng em; để trống thì tờ in không có dòng vị thứ.</p>}
            {kind === 'marriage' && picked.length > 0 && <p className="muted crx-hint">Anh/Chị tự lấy theo giới tính trong hồ sơ, sửa được cho từng em.</p>}
          </>
        )}
      </div>

      <div className="panel">
        <h2 className="crx-h"><span>3</span>Nội dung</h2>
        {isMerit && (
          <div className="crx-grid2">
            <div className="field"><label>Tiêu đề</label><input value={meritTitle} onChange={(e) => setMeritTitle(e.target.value)} placeholder="GIẤY KHEN" /></div>
            <div className="field"><label>Nội dung khen</label><input value={meritReason} onChange={(e) => setMeritReason(e.target.value)} placeholder="Đã chuyên chăm học giáo lý và siêng năng tham dự Thánh Lễ" /></div>
          </div>
        )}
        {kind === 'marriage' && (
          <div className="field"><label>Dòng chứng nhận</label><input value={extra.certify_line || ''} onChange={setE('certify_line')} placeholder={`VD: Linh mục Giáo xứ ${parish?.name || 'Nam Tây'} chứng nhận`} /></div>
        )}
        {kind === 'first_communion' && (
          <div className="crx-grid2 crx-grid2e">
            <div className="field"><label>Nơi Rước Lễ</label><input value={extra.communion_church || ''} onChange={setE('communion_church')} placeholder={`Nhà thờ Giáo xứ ${(parish?.name || '').replace(/^Giáo xứ\s*/i, '')}`} /></div>
            <div className="field"><label>Linh mục cử hành</label><input value={extra.communion_priest || ''} onChange={setE('communion_priest')} placeholder={priestName || 'Để trống thì lấy người ký'} /></div>
          </div>
        )}
        {kind === 'scout' && (
          <>
            <div className="crx-grid3">
              <div className="field"><label>Ban cấp</label><input value={extra.org2 || ''} onChange={setE('org2')} placeholder="Ban Giáo lý & Mục vụ Thiếu nhi" /></div>
              <div className="field"><label>Sa mạc</label><input value={extra.samac || ''} onChange={setE('samac')} placeholder="VD: Trại Mẹ La Vang" /></div>
              <div className="field"><label>Ngày khai mạc</label><input type="date" value={extra.open_date || ''} onChange={setE('open_date')} /></div>
            </div>
            <div className="crx-grid3">
              <div className="field"><label>Cấp</label><select value={extra.level || 'I'} onChange={setE('level')}><option>I</option><option>II</option><option>III</option></select></div>
              <div className="field"><label>Số vào sổ (em đầu tiên)</label><input value={extra.sono_start || ''} onChange={setE('sono_start')} placeholder="VD: 12/2026" /></div>
              <div className="field"><label>Giáo họ</label><input value={extra.giao_ho || ''} onChange={setE('giao_ho')} placeholder="Để trống thì không in" /></div>
            </div>
          </>
        )}
        <div className="crx-grid3">
          <div className="field"><label>Người ký (Linh mục / Trưởng ban)</label>
            <input value={priestName} onChange={(e) => setPriestName(e.target.value)} placeholder="VD: Phêrô Nguyễn Văn An" />
            {isAdmin && signerDirty && priestName.trim() && <button type="button" className="crx-link crx-under" onClick={saveSigner}>Lưu làm người ký mặc định</button>}
          </div>
          <div className="field"><label>Nơi cấp</label><input value={extra.place} onChange={setE('place')} placeholder="VD: Hòa Khánh" /></div>
          <div className="field"><label>Ngày cấp</label><input type="date" value={extra.issue_date} onChange={setE('issue_date')} /></div>
        </div>
        <p className="muted crx-hint">
          {isMerit ? 'Lớp và năm học lấy theo lớp đang chọn, tên lấy từ hồ sơ. Chữ ký lấy từ Cài đặt giáo xứ.'
            : kind === 'baptism' ? 'Mọi thông tin lấy từ hồ sơ từng em (mục Bí tích). Em chưa Thêm Sức thì tờ in tự bỏ phần Thêm Sức. Chữ ký lấy từ Cài đặt giáo xứ.'
            : kind === 'scout' ? 'Số vào sổ tự tăng theo thứ tự các em đã chọn (12/2026, 13/2026...). Chữ ký lấy từ Cài đặt giáo xứ.'
            : 'Tên, ngày sinh, cha mẹ lấy từ hồ sơ từng em. Chữ ký lấy từ Cài đặt giáo xứ.'}
        </p>
      </div>

      <div className="panel">
        <div className="crx-pvhead">
          <h2 className="crx-h"><span>4</span>Xem trước</h2>
          {sel.length > 1 && (
            <div className="crx-pvnav">
              <button type="button" className="btn ghost sm" onClick={() => setPv(Math.max(0, pvIdx - 1))} disabled={pvIdx === 0} aria-label="Tờ trước">‹</button>
              <span>Tờ {pvIdx + 1}/{sel.length}</span>
              <button type="button" className="btn ghost sm" onClick={() => setPv(Math.min(sel.length - 1, pvIdx + 1))} disabled={pvIdx >= sel.length - 1} aria-label="Tờ sau">›</button>
            </div>
          )}
        </div>
        {pvStudent && <p className="muted crx-hint">{sel.length ? nameOf(pvStudent) : 'Mẫu xem trước với học viên đầu lớp (chưa chọn ai)'}{pvStudent && missing(pvStudent).length > 0 && <span className="crx-warn"> · thiếu {missing(pvStudent).join(', ')}</span>}</p>}
        <div className={`crx-pv ${land ? 'land' : 'port'}`}>
          <iframe title="Xem trước chứng chỉ" srcDoc={previewSrc} scrolling="no" />
        </div>

        <details className="crx-adv">
          <summary>Khung và căn lề {insetDirty && <span className="crx-warn">(chưa lưu)</span>}</summary>
          <div className="crx-frames">
            {frames.map((f) => (
              <div key={f.url} className={`crx-frame ${land ? 'land' : 'port'}${effFrame === f.url ? ' on' : ''}`} onClick={() => setSelFrame(f.url)} title={f.name}>
                <div className="crx-fimg"><img src={f.url} alt={f.name} /></div>
                <div className="crx-fname">{f.name}{f.builtin ? '' : ' (riêng)'}</div>
                {isAdmin && !f.builtin && (
                  <button type="button" className="crx-fdel" onClick={(e) => { e.stopPropagation(); delFrame(f); }} title="Xóa khung" aria-label={`Xóa khung ${f.name}`}>×</button>
                )}
              </div>
            ))}
            {isAdmin && customCount < 2 && (
              <label className={`crx-frame crx-fadd ${land ? 'land' : 'port'}`}>
                <input type="file" accept="image/*" hidden disabled={frameBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadFrame(f); }} />
                <div className="crx-fimg"><span>{frameBusy ? 'Đang tải…' : '+ Thêm khung'}</span></div>
              </label>
            )}
          </div>
          {isAdmin && <p className="muted crx-hint">Khung riêng áp dụng cho mọi giáo lý viên trong giáo xứ, tối đa 2 khung mỗi loại.</p>}

          <div className="crx-insets">
            <p className="muted crx-hint">Chữ đè lên hoa văn thì tăng lề để kéo nội dung vào trong (đơn vị % của tờ, 0 đến {INSET_MAX}).</p>
            {[['top', 'Lề trên'], ['bottom', 'Lề dưới'], ['left', 'Lề trái'], ['right', 'Lề phải']].map(([k, lb]) => (
              <div key={k} className="crx-inset">
                <span>{lb}</span>
                <button type="button" className="btn ghost sm" onClick={() => setInsetDraft((d) => ({ ...d, [k]: clampInset(d[k] - 0.5) }))} aria-label={`Giảm ${lb}`}>−</button>
                <input type="number" inputMode="decimal" min="0" max={INSET_MAX} step="0.5" value={insetDraft[k]} onChange={(e) => setInsetDraft((d) => ({ ...d, [k]: clampInset(e.target.value) }))} aria-label={lb} />
                <button type="button" className="btn ghost sm" onClick={() => setInsetDraft((d) => ({ ...d, [k]: clampInset(d[k] + 0.5) }))} aria-label={`Tăng ${lb}`}>+</button>
              </div>
            ))}
            {isAdmin && (
              <button className="btn ghost sm" onClick={saveInset} disabled={savingInset || !insetDirty}>
                {savingInset ? 'Đang lưu…' : <><IconSave className="bi" />Lưu lề cho khung này</>}
              </button>
            )}
            <p className="muted crx-hint">Lưu để mọi giáo lý viên in ra giống nhau{selFrameObj?.builtin ? ' (áp cho khung mặc định của giáo xứ bạn)' : ''}.</p>
          </div>
        </details>
      </div>

      <div className="crx-bar">
        <span className="crx-bar-info">{sel.length ? <><b>{sel.length} em</b>{cls.name ? ` · ${cls.name}` : ''}</> : 'Chưa chọn học viên'}</span>
        <button className="btn" onClick={issue} disabled={!sel.length || printing}>
          <IconPrinter className="bi" />{printing ? 'Đang chuẩn bị…' : sel.length > 1 ? `In / lưu PDF ${sel.length} tờ` : 'In / lưu PDF'}
        </button>
      </div>
      <p className="muted crx-hint crx-foot">Trong hộp thoại in, chọn "Lưu thành PDF" để tải file. Mỗi học viên một trang A4.</p>
    </div>
  );
}
