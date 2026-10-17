import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import QRCode from 'qrcode';
import { exportXlsx, fileSlug } from '../lib/exportUtils';
import { printExamPaper } from '../lib/examPaper';
import { IconAlert, IconClock, IconCopy, IconDice, IconDownload, IconPlus, IconPrinter, IconRefresh } from '../components/Icons.jsx';
import { toast } from '../lib/toast';
import { SkeletonTable } from '../components/Skeleton.jsx';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import RowMenu from '../components/RowMenu.jsx';
import { keepOptionOrder } from '../lib/examOrder';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const KINDS = [{ v: '15p', l: '15 phút', dur: 15 }, { v: '1tiet', l: '1 tiết', dur: 45 }, { v: 'hocky', l: 'Học kỳ', dur: 60 }, { v: 'khac', l: 'Khác' }];
const kindLabel = (k) => (KINDS.find((x) => x.v === k) || { l: k }).l;
const kindDur = (k) => KINDS.find((x) => x.v === k)?.dur;
const EXAM_BASE = (typeof window !== 'undefined' ? window.location.origin : '') + '/exam/';
const ST = {
  draft: ['Nháp', 'gray'], waiting: ['Phòng chờ', 'yellow'],
  started: ['Đang thi', 'green'], closed: ['Đã đóng', 'indigo'],
};
const NA = <span className="muted">–</span>;
function badge(s) { const v = ST[s] || ST.draft; return <span className={`tag-chip tone-${v[1]}`}>{v[0]}</span>; }
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
// Bỏ dấu để tìm kiếm
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const errMsg = (e, d) => e?.response?.data?.error || d;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function Exams() {
  const [view, setView] = useState('list'); // list | build | room
  const [exams, setExams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState(null);   // { mode: 'new' | 'edit' | 'copy', exam? }
  const [classes, setClasses] = useState([]);
  const [fClass, setFClass] = useState('');
  const [fStatus, setFStatus] = useState('');
  function load() { api.get('/exams').then((r) => setExams(r.data)).catch(() => setExams([])).finally(() => setLoaded(true)); }
  useEffect(() => { load(); api.get('/classes').then((r) => setClasses(r.data)).catch(() => {}); }, []);

  async function del(e) {
    const msg = `Xóa đề "${e.title}"?`
      + (e.joined ? `\n\nBài làm của ${e.joined} em sẽ mất, không xem lại được nữa.` : '')
      + (e.grade_column_id ? '\n\nCột điểm của đề ở trang Điểm số vẫn giữ nguyên (muốn bỏ thì xóa cột ở đó).' : '');
    if (!await confirmDialog(msg)) return;
    try { await api.delete(`/exams/${e.id}`); toast(`Đã xóa đề "${e.title}"`); load(); }
    catch (err) { toast.err(errMsg(err, 'Xóa đề thất bại')); }
  }
  async function openBuilder(mode, e) {
    if (mode === 'new') { setDraft({ mode }); setView('build'); return; }
    try { const { data } = await api.get(`/exams/${e.id}`); setDraft({ mode, exam: data }); setView('build'); }
    catch (err) { toast.err(errMsg(err, 'Không tải được đề')); }
  }

  if (view === 'build') {
    return <ExamBuilder classes={classes} draft={draft} onCancel={() => setView('list')}
      onDone={(id) => { load(); setCurrent(id); setView('room'); }} />;
  }
  if (view === 'room' && current) return <ExamRoom examId={current} onBack={() => { load(); setCurrent(null); setView('list'); }} />;

  const counts = exams.reduce((m, e) => { m[e.status] = (m[e.status] || 0) + 1; return m; }, {});
  const shown = exams.filter((e) => (!fClass || e.class_id === fClass) && (!fStatus || e.status === fStatus));
  const examClasses = classes.filter((c) => exams.some((e) => e.class_id === c.id));

  return (
    <div>
      <PageHeader title="Đề thi & thi online" subtitle="Soạn đề trắc nghiệm, mở phòng thi online cho học viên và chấm điểm tự động.">
        <button data-tour="exam-add" className="btn" onClick={() => openBuilder('new')}>+ Tạo đề</button>
      </PageHeader>

      {exams.length > 0 && (
        <div className="exx-filters">
          {examClasses.length > 1 && (
            <select value={fClass} onChange={(e) => setFClass(e.target.value)} aria-label="Lọc theo lớp">
              <option value="">Tất cả lớp</option>
              {examClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="exx-chips">
            <button type="button" className={`exx-chip${!fStatus ? ' on' : ''}`} onClick={() => setFStatus('')}>Tất cả <b>{exams.length}</b></button>
            {Object.keys(ST).filter((s) => counts[s]).map((s) => (
              <button key={s} type="button" className={`exx-chip${fStatus === s ? ' on' : ''}`} onClick={() => setFStatus(fStatus === s ? '' : s)}>{ST[s][0]} <b>{counts[s]}</b></button>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        {!loaded ? <SkeletonTable rows={3} cols={6} /> : exams.length === 0 ? <p className="muted">Chưa có đề thi nào. Bấm "Tạo đề" để soạn đề trắc nghiệm cho học viên thi online.</p> : (
          <table className="exx-table">
            <thead><tr><th>Đề</th><th>Lớp</th><th>Câu</th><th>Trạng thái</th><th>Đã nộp</th><th></th></tr></thead>
            <tbody>
              {shown.map((e) => {
                const editable = e.status === 'draft' && !e.joined;
                return (
                  <tr key={e.id}>
                    <td className="exx-c-name">
                      <span className="link-name" onClick={() => { setCurrent(e.id); setView('room'); }}>{e.title}</span>
                      <small className="muted">{kindLabel(e.kind)} · hệ số {e.weight}{e.duration_min ? ` · làm bài ${e.duration_min} phút` : ''}</small>
                    </td>
                    <td data-label="Lớp">{e.class_name || <span className="muted">Chưa gán lớp</span>}</td>
                    <td data-label="Số câu">{e.num_questions}</td>
                    <td data-label="Trạng thái">{badge(e.status)}</td>
                    <td data-label="Đã nộp">{e.joined ? `${e.submitted}/${e.joined}` : NA}</td>
                    <td className="exx-c-act">
                      <button className="btn ghost sm" onClick={() => { setCurrent(e.id); setView('room'); }}>Phòng thi</button>
                      <RowMenu items={[
                        editable && { label: 'Sửa đề', onClick: () => openBuilder('edit', e) },
                        { label: 'Nhân bản (dùng cho lớp khác)', onClick: () => openBuilder('copy', e) },
                        { label: 'Xóa đề…', danger: true, onClick: () => del(e) },
                      ]} />
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr className="exx-empty"><td colSpan={6} className="muted">Không có đề nào khớp bộ lọc.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Soạn đề (tạo mới / sửa nháp / nhân bản) ---------------- */
const MAX_DUR = 180;
const draftKey = (mode, src) => (mode === 'edit' ? `examDraft:edit:${src?.id}` : 'examDraft:new');
function readDraft(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function writeDraft(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* bộ nhớ trình duyệt bị chặn */ } }
function dropDraft(key) { try { localStorage.removeItem(key); } catch { /* noop */ } }

function ExamBuilder({ classes, draft, onDone, onCancel }) {
  const src = draft?.exam;
  const mode = draft?.mode || 'new';
  const key = draftKey(mode, src);
  const init = useMemo(() => {
    if (!src) return { title: '', classId: '', kind: '15p', weight: 1, duration: 15, picked: {} };
    const picked = {};
    (src.questions || []).forEach((q) => { picked[q.id] = { id: q.id, text: q.text, options: q.options, correct: q.correct }; });
    return {
      title: mode === 'copy' ? `${src.title} (bản sao)` : src.title,
      classId: mode === 'copy' ? '' : (src.class_id || ''),
      kind: src.kind || '15p', weight: src.weight ?? 1, duration: src.duration_min ?? 0, picked,
    };
  }, [src, mode]);
  const [title, setTitle] = useState(init.title);
  const [classId, setClassId] = useState(init.classId);
  const [kind, setKind] = useState(init.kind);
  const [weight, setWeight] = useState(init.weight);
  const [duration, setDuration] = useState(init.duration);
  const [bank, setBank] = useState(null);      // { topics: [...] }
  const [topicId, setTopicId] = useState('');
  const [n, setN] = useState(10);
  const [bq, setBq] = useState('');            // tìm trong ngân hàng
  const [peek, setPeek] = useState(null);      // câu ngân hàng đang xem đáp án
  const [picked, setPicked] = useState(init.picked); // qid -> question (thứ tự chèn = thứ tự câu)
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [editing, setEditing] = useState(null); // câu đang sửa / thêm mới
  const [qtab, setQtab] = useState(src ? 'chosen' : 'bank'); // điện thoại: bank | chosen
  const snap = (v) => JSON.stringify([v.title, v.classId, v.kind, String(v.weight), String(v.duration), Object.values(v.picked).map((q) => [q.id, q.text, q.options, q.correct])]);
  const cur = { title, classId, kind, weight, duration, picked };
  const dirty = snap(cur) !== snap(init) || mode === 'copy';

  useEffect(() => {
    fetch('/exam-question-bank.json').then((r) => r.json()).then((b) => {
      setBank(b); setTopicId(b.topics?.[0]?.id || '');
    }).catch(() => setBank({ topics: [] }));
  }, []);
  // Khôi phục bản nháp soạn dở (lưu trong trình duyệt này)
  useEffect(() => {
    if (mode === 'copy') return;
    const d = readDraft(key);
    if (!d || snap(d) === snap(init)) return;
    const t = new Date(d.ts || Date.now()); const p2 = (x) => String(x).padStart(2, '0');
    const when = `${p2(t.getHours())}:${p2(t.getMinutes())} ngày ${p2(t.getDate())}/${p2(t.getMonth() + 1)}`;
    const cnt = Object.keys(d.picked || {}).length;
    confirmDialog({ message: `Khôi phục đề đang soạn dở${d.title ? ` "${d.title}"` : ''}?\n\nBản nháp có ${cnt} câu, lưu lúc ${when} trên máy này.`, okText: 'Khôi phục', cancelText: 'Bắt đầu lại' })
      .then((yes) => {
        if (!yes) { dropDraft(key); return; }
        setTitle(d.title || ''); setClassId(d.classId || ''); setKind(d.kind || '15p');
        setWeight(d.weight ?? 1); setDuration(d.duration ?? 0); setPicked(d.picked || {});
        if (cnt) setQtab('chosen');
      });
  }, []); // eslint-disable-line
  // Tự lưu bản nháp khi có thay đổi
  useEffect(() => {
    if (!dirty || saving) return undefined;
    const t = setTimeout(() => writeDraft(key, { ...cur, ts: Date.now() }), 600);
    return () => clearTimeout(t);
  }, [title, classId, kind, weight, duration, picked]); // eslint-disable-line
  // Cảnh báo khi tải lại / đóng tab lúc đang soạn
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const topic = bank?.topics?.find((t) => t.id === topicId);
  const fq = fold(bq.trim());
  const bankShown = (topic?.questions || []).filter((q) => !fq || fold([q.text, ...(q.options || [])].join(' ')).includes(fq));
  const pickedList = Object.values(picked);
  const perTopic = pickedList.reduce((m, q) => { if (q._topic) m[q._topic] = (m[q._topic] || 0) + 1; return m; }, {});
  const isPicked = (q) => !!picked[q.id];
  function toggle(q) { setPicked((p) => { const c = { ...p }; if (c[q.id]) delete c[q.id]; else c[q.id] = { ...q, _topic: topicId }; return c; }); }
  function pickRandom() {
    if (!topic) return;
    const pool = bankShown.filter((q) => !picked[q.id]); // đang tìm thì bốc trong kết quả tìm
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const add = pool.slice(0, Math.max(0, Number(n) || 0));
    if (!add.length) { toast.err(fq ? 'Đã chọn hết các câu khớp tìm kiếm' : 'Đã chọn hết câu của cấp này'); return; }
    setPicked((p) => { const c = { ...p }; add.forEach((q) => { c[q.id] = { ...q, _topic: topicId }; }); return c; });
    toast(`Đã thêm ${add.length} câu vào đề`);
  }
  function clearTopic() { setPicked((p) => Object.fromEntries(Object.entries(p).filter(([, q]) => q._topic !== topicId))); }
  function saveQuestion(q) {
    setPicked((p) => {
      const id = q.id || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
      return { ...p, [id]: { ...p[id], ...q, id } };
    });
    setEditing(null);
  }
  function removeQ(id) { setPicked((p) => { const c = { ...p }; delete c[id]; return c; }); }
  // Đổi thứ tự câu: dựng lại object theo thứ tự mới
  function moveQ(i, d) {
    const list = Object.values(picked); const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setPicked(Object.fromEntries(list.map((q) => [q.id, q])));
  }
  function changeKind(k) {
    // Gợi ý thời lượng theo loại bài, chỉ khi người dùng chưa tự đổi thời lượng
    if (String(duration) === String(kindDur(kind) ?? duration) && kindDur(k)) setDuration(kindDur(k));
    setKind(k);
  }
  async function leave() {
    if (busy.current) return;
    if (dirty && !(await confirmDialog(mode === 'edit' ? 'Bỏ các thay đổi chưa lưu của đề này?' : 'Bỏ đề đang soạn? Các câu đã chọn sẽ mất.'))) return;
    dropDraft(key);
    onCancel();
  }

  function validate() {
    const e = {};
    const w = Number(weight); const d = Number(duration);
    if (!title.trim()) e.title = 'Nhập tên đề thi';
    if (!classId) e.classId = 'Chọn lớp thi';
    if (!(w >= 0.5 && w <= 10)) e.weight = 'Hệ số từ 0,5 đến 10';
    if (!(Number.isInteger(d) && d >= 0 && d <= MAX_DUR)) e.duration = `Số phút nguyên từ 0 đến ${MAX_DUR}`;
    if (!pickedList.length) e.questions = 'Chọn ít nhất 1 câu hỏi';
    return e;
  }
  async function save() {
    if (busy.current) return;
    const e = validate();
    setErrs(e);
    const first = ['title', 'classId', 'weight', 'duration', 'questions'].find((k) => e[k]);
    if (first) {
      if (first === 'questions') setQtab('bank');
      document.querySelector(`[data-err="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.err(e[first]);
      return;
    }
    busy.current = true; setSaving(true);
    try {
      const questions = pickedList.map((q) => ({ text: q.text, options: q.options, correct: q.correct }));
      const payload = { title: title.trim(), class_id: classId, kind, weight: Number(weight), duration_min: Number(duration) || null, questions };
      let id;
      if (mode === 'edit') { await api.put(`/exams/${src.id}`, payload); id = src.id; toast('Đã lưu đề'); }
      else { const { data } = await api.post('/exams', payload); id = data.id; toast(`Đã tạo đề "${payload.title}"`); }
      dropDraft(key);
      onDone(id);
    } catch (err) { toast.err(errMsg(err, mode === 'edit' ? 'Lưu đề thất bại' : 'Tạo đề thất bại')); busy.current = false; setSaving(false); }
  }
  const fieldErr = (k) => errs[k] && <div className="exx-ferr">{errs[k]}</div>;
  const clearErr = (k) => errs[k] && setErrs((x) => ({ ...x, [k]: '' }));

  const heading = mode === 'edit' ? 'Sửa đề thi' : mode === 'copy' ? 'Nhân bản đề thi' : 'Soạn đề thi';
  const className = classes.find((c) => c.id === classId)?.name;
  return (
    <div className="exx-builder">
      <div className="att-head"><h1 style={{ margin: 0 }}>{heading}</h1>
        <button className="btn ghost" onClick={leave}>← Quay lại</button></div>
      {mode === 'copy' && <p className="muted exx-sub">Chọn lớp cho bản sao. Đề gốc giữ nguyên.</p>}

      <div className="panel exx-setup">
        <div className="exx-set1">
          <div className="field" data-err="title"><label>Tên đề *</label>
            <input data-tour="exam-title" className={errs.title ? 'invalid' : ''} value={title} onChange={(e) => { setTitle(e.target.value); clearErr('title'); }} placeholder="VD: Kiểm tra 15 phút Bài 5" />
            {fieldErr('title')}
          </div>
          <div data-tour="exam-class" className="field" data-err="classId"><label>Lớp thi *</label>
            <select className={errs.classId ? 'invalid' : ''} value={classId} onChange={(e) => { setClassId(e.target.value); clearErr('classId'); }}>
              <option value="">Chọn lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {fieldErr('classId')}
          </div>
        </div>
        <div className="exx-set2">
          <div className="field"><label>Loại bài</label>
            <select value={kind} onChange={(e) => changeKind(e.target.value)}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
          </div>
          <div className="field" data-err="weight"><label>Hệ số</label>
            <input className={errs.weight ? 'invalid' : ''} type="number" inputMode="decimal" min="0.5" max="10" step="0.5" value={weight} onChange={(e) => { setWeight(e.target.value); clearErr('weight'); }} />
            {fieldErr('weight')}
          </div>
          <div className="field" data-err="duration"><label>Phút làm bài</label>
            <input className={errs.duration ? 'invalid' : ''} type="number" inputMode="numeric" min="0" max={MAX_DUR} step="1" value={duration} onChange={(e) => { setDuration(e.target.value); clearErr('duration'); }} />
            {fieldErr('duration') || <div className="exx-fhint">0 = không giới hạn</div>}
          </div>
        </div>
      </div>

      <div className={`exx-qwrap on-${qtab}`} data-err="questions">
        <div className="seg exx-tabs">
          <button type="button" className={`seg-btn ${qtab === 'bank' ? 'on' : ''}`} onClick={() => setQtab('bank')}>Ngân hàng</button>
          <button type="button" className={`seg-btn ${qtab === 'chosen' ? 'on' : ''}`} onClick={() => setQtab('chosen')}>Trong đề ({pickedList.length})</button>
        </div>

        <div className="panel exx-pane exx-pane-bank">
          <h2 className="exx-ph">Ngân hàng câu hỏi</h2>
          {!bank ? <p className="muted">Đang tải ngân hàng câu hỏi…</p> : (
            <>
              <div className="field"><label>Cấp</label>
                <select value={topicId} onChange={(e) => { setTopicId(e.target.value); setPeek(null); }}>
                  {bank.topics.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.count} câu{perTopic[t.id] ? `, đã chọn ${perTopic[t.id]}` : ''})</option>)}
                </select>
              </div>
              <div className="exx-pickrow">
                <input className="exx-n" type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} aria-label="Số câu bốc" />
                <button data-tour="exam-random" className="btn ghost" onClick={pickRandom}><IconDice className="bi" />{fq ? 'Bốc trong kết quả tìm' : 'Bốc ngẫu nhiên'}</button>
              </div>
              <input className="exx-bsearch" type="search" value={bq} onChange={(e) => setBq(e.target.value)} placeholder="Tìm câu hỏi hoặc đáp án…" aria-label="Tìm câu hỏi" />
              <div className="exx-bankmeta">
                <span className="muted">{fq ? `${bankShown.length} câu khớp` : `${bankShown.length} câu`}{perTopic[topicId] ? ` · đã chọn ${perTopic[topicId]}` : ''}</span>
                {perTopic[topicId] > 0 && <button type="button" className="exx-linkbtn" onClick={clearTopic}>Bỏ các câu đã chọn ở cấp này</button>}
              </div>
              <div className="pick-list exx-bank exx-scroll">
                {bankShown.map((q) => (
                  <div key={q.id} className={`exx-bq${isPicked(q) ? ' on' : ''}`}>
                    <label className="fp-chk">
                      <input type="checkbox" checked={isPicked(q)} onChange={() => toggle(q)} />
                      <span>{q.text}</span>
                    </label>
                    <button type="button" className="exx-peek" onClick={() => setPeek(peek === q.id ? null : q.id)} aria-expanded={peek === q.id}>{peek === q.id ? 'Ẩn' : 'Đáp án'}</button>
                    {peek === q.id && (
                      <div className="exx-bopts">
                        {(q.options || []).map((opt, idx) => (
                          <div key={idx} className={`rv-opt ${idx === q.correct ? 'correct' : ''}`}><b>{LETTERS[idx]}.</b> {opt}{idx === q.correct && <span className="rv-tag ok"> đáp án</span>}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {bankShown.length === 0 && <p className="muted">Không có câu nào khớp.</p>}
              </div>
            </>
          )}
        </div>

        <div className="panel exx-pane exx-pane-chosen">
          <div className="exx-chead">
            <h2 className="exx-ph">Câu hỏi trong đề ({pickedList.length})</h2>
            <button className="btn ghost sm" onClick={() => setEditing({ text: '', options: ['', ''], correct: 0 })}><IconPlus className="bi" />Thêm câu tự soạn</button>
          </div>
          {pickedList.length > 1 && <p className="muted exx-fhint">Thứ tự dưới đây dùng cho đề in giấy. Thi online, mỗi em được xáo thứ tự câu khác nhau.</p>}
          {errs.questions && !pickedList.length && <div className="exx-ferr">{errs.questions}</div>}
          {pickedList.length === 0 ? (
            <p className="muted">Chưa có câu nào. Chọn câu ở ngân hàng, bấm "Bốc ngẫu nhiên", hoặc "Thêm câu tự soạn".</p>
          ) : (
            <div className="pick-list exx-scroll">
              {pickedList.map((q, i) => (
                <div className="rv-q" key={q.id}>
                  <div className="rv-q-t exx-qrow">
                    <span className="exx-qtext"><b>Câu {i + 1}.</b> {q.text}
                      {q.custom ? <span className="exx-qtag">tự soạn</span> : q.edited ? <span className="exx-qtag">đã sửa</span> : null}
                      {keepOptionOrder(q.options) && <span className="exx-qtag" title="Đáp án kiểu &quot;Cả A và B&quot;, &quot;các ý trên&quot; nên khi thi online không xáo thứ tự đáp án">giữ thứ tự đáp án</span>}
                    </span>
                    <span className="row-links exx-qact">
                      <button onClick={() => moveQ(i, -1)} disabled={i === 0} title="Đưa lên" aria-label="Đưa lên">↑</button>
                      <button onClick={() => moveQ(i, 1)} disabled={i === pickedList.length - 1} title="Đưa xuống" aria-label="Đưa xuống">↓</button>
                      <button onClick={() => setEditing(q)}>Sửa</button>
                      <button className="danger" onClick={() => removeQ(q.id)}>Xóa</button>
                    </span>
                  </div>
                  {(q.options || []).map((opt, idx) => (
                    <div key={idx} className={`rv-opt ${idx === q.correct ? 'correct' : ''}`}>
                      <b>{LETTERS[idx]}.</b> {opt}{idx === q.correct && <span className="rv-tag ok"> đáp án</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="exx-bar">
        <span className="exx-bar-info"><b>{pickedList.length} câu</b>{className ? ` · ${className}` : ''}{Number(duration) > 0 ? ` · ${duration} phút` : ''}</span>
        <button className="btn ghost" onClick={leave} disabled={saving}>Hủy</button>
        <button data-tour="exam-save" className="btn" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu…' : mode === 'edit' ? 'Lưu đề' : 'Tạo đề'}
        </button>
      </div>

      {editing && <QuestionEditor init={editing} onSave={saveQuestion} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ---------------- Soạn / sửa 1 câu hỏi ---------------- */
function QuestionEditor({ init, onSave, onClose }) {
  const [text, setText] = useState(init.text || '');
  const [options, setOptions] = useState(init.options?.length ? [...init.options] : ['', '']);
  const [correct, setCorrect] = useState(init.correct ?? 0);
  const dirty = text !== (init.text || '') || JSON.stringify(options) !== JSON.stringify(init.options?.length ? init.options : ['', '']) || correct !== (init.correct ?? 0);
  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length < 6 ? [...o, ''] : o));
  function rmOpt(i) {
    setOptions((o) => (o.length <= 2 ? o : o.filter((_, j) => j !== i)));
    setCorrect((c) => (i < c ? c - 1 : i === c ? 0 : c));
  }
  async function close() {
    if (dirty && !(await confirmDialog('Bỏ câu hỏi đang soạn?'))) return;
    onClose();
  }
  function save() {
    const opts = options.map((s) => s.trim()).filter(Boolean);
    if (!text.trim()) return toast.err('Nhập nội dung câu hỏi');
    if (opts.length < 2) return toast.err('Cần ít nhất 2 đáp án');
    if (!options[correct]?.trim()) return toast.err('Đáp án đúng đang để trống');
    if (new Set(opts.map((o) => o.toLowerCase())).size < opts.length) return toast.err('Có hai đáp án giống nhau');
    // Chỉ số đáp án đúng tính lại sau khi bỏ các ô trống
    const right = opts.indexOf(options[correct].trim());
    if (!dirty && init.id) { onClose(); return; }
    onSave({ id: init.id, text: text.trim(), options: opts, correct: right, custom: init.custom || !init.id, edited: !!init.id && !init.custom });
  }
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{init.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h2>
        <div className="field"><label>Nội dung câu hỏi *</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="VD: Bí tích nào Chúa Giêsu lập trong bữa Tiệc Ly?" /></div>
        <div className="field" style={{ marginBottom: 6 }}><label>Các đáp án <span className="muted" style={{ fontWeight: 400 }}>(chấm ô tròn ở đáp án ĐÚNG)</span></label></div>
        {options.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} title="Đặt làm đáp án đúng" style={{ flex: '0 0 auto', width: 18, height: 18, margin: 0, cursor: 'pointer' }} />
            <b style={{ flex: '0 0 22px' }}>{LETTERS[i]}.</b>
            <input style={{ flex: '1 1 auto', minWidth: 0 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Đáp án ${LETTERS[i]}`} />
            {options.length > 2
              ? <button type="button" onClick={() => rmOpt(i)} title="Bỏ đáp án" style={{ flex: '0 0 auto', width: 34, height: 34, border: '1px solid var(--border,#d1d5db)', borderRadius: 8, background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
              : <span style={{ flex: '0 0 34px' }} />}
          </div>
        ))}
        {options.length < 6 && <button className="btn ghost sm" type="button" onClick={addOpt} style={{ marginTop: 2 }}>+ Thêm đáp án</button>}
        <p className="muted exx-fhint">Đáp án kiểu "Cả A và B đều đúng" hay "Tất cả các ý trên" sẽ được giữ nguyên thứ tự khi thi online.</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={close}>Hủy</button>
          <button className="btn" onClick={save}>Lưu câu</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Phòng thi (điều khiển + QR + kết quả) ---------------- */
function ExamRoom({ examId, onBack }) {
  const [exam, setExam] = useState(null);
  const [qr, setQr] = useState('');
  const [roster, setRoster] = useState(null);     // học viên của lớp, để biết em nào chưa vào
  const [reviewing, setReviewing] = useState(null); // attempt đang xem lại
  const [timeLeft, setTimeLeft] = useState(null);    // đồng hồ đếm ngược cho GLV
  const [projecting, setProjecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  function exportResults() {
    const qs = exam.questions || [];
    const rows = (exam.attempts || []).filter((a) => a.status === 'submitted');
    const columns = [
      { label: 'STT', get: (_r, i) => i + 1, width: 6 },
      { label: 'Họ tên', get: (r) => r.student_name, width: 26 },
      { label: 'Điểm', get: (r) => (r.score ?? ''), width: 8 },
      { label: 'Số câu đúng', get: (r) => (r.correct_count ?? ''), width: 11 },
      { label: 'Tổng câu', get: (r) => (r.total ?? ''), width: 9 },
      { label: 'Nộp lúc', get: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString('vi-VN') : ''), width: 19 },
      { label: 'Rời MH', get: (r) => (r.leave_count || 0), width: 8 },
      ...qs.map((q, qi) => ({ label: 'C' + (qi + 1), get: (r) => { const c = r.answers?.[q.id]; return c == null ? '' : (c === q.correct ? 'Đ' : 'S'); }, width: 5 })),
    ];
    exportXlsx({
      filename: `ket-qua-${fileSlug(exam.title)}.xlsx`, sheetName: 'Kết quả',
      title: 'KẾT QUẢ THI: ' + exam.title,
      subtitle: [`Lớp: ${exam.class_name || ''}`, `${kindLabel(exam.kind)} · hệ số ${exam.weight} · ${qs.length} câu`, 'Đ = đúng · S = sai · ô trống = bỏ trống'],
      columns, rows,
    });
  }

  function load() { return api.get(`/exams/${examId}`).then((r) => setExam(r.data)).catch(() => {}); }
  useEffect(() => { load(); }, [examId]);
  useEffect(() => {
    if (exam?.code) QRCode.toDataURL(EXAM_BASE + exam.code, { width: 480, margin: 1 }).then(setQr).catch(() => {});
  }, [exam?.code]);
  useEffect(() => {
    if (!exam?.class_id) return;
    api.get(`/students?class_id=${exam.class_id}`).then((r) => setRoster(r.data)).catch(() => setRoster(null));
  }, [exam?.class_id]);
  // Poll bài làm khi phòng đang mở
  useEffect(() => {
    if (!exam) return;
    if (exam.status === 'waiting' || exam.status === 'started') {
      pollRef.current = setInterval(load, 3000);
      return () => clearInterval(pollRef.current);
    }
  }, [exam?.status]); // eslint-disable-line
  // Đồng hồ đếm ngược cho GLV (đề có giới hạn giờ)
  useEffect(() => {
    if (exam?.status === 'started' && exam.duration_min && exam.started_at) {
      const dl = Date.parse(exam.started_at) + exam.duration_min * 60000;
      const tick = () => setTimeLeft(dl - Date.now());
      tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
    }
    setTimeLeft(null);
  }, [exam?.status, exam?.duration_min, exam?.started_at]);
  useEffect(() => {
    if (!projecting) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setProjecting(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [projecting]);

  async function setStatus(status, okMsg) {
    if (busy) return;
    setBusy(true);
    try { await api.post(`/exams/${examId}/status`, { status }); if (okMsg) toast(okMsg); await load(); }
    catch (e) { toast.err(errMsg(e, 'Không đổi được trạng thái phòng thi')); }
    finally { setBusy(false); }
  }
  async function start() {
    if (!attempts.length && !(await confirmDialog('Chưa em nào vào phòng chờ. Vẫn bắt đầu thi?\n\nCác em vào sau vẫn làm bài được.'))) return;
    setStatus('started', 'Đã bắt đầu thi');
  }
  async function finish() {
    const doing = attempts.filter((a) => a.status !== 'submitted').length;
    const msg = 'Kết thúc và đóng phòng thi?' + (doing ? `\n\n${doing} em đang làm sẽ bị nộp bài ngay, câu chưa làm tính là sai.` : '');
    if (await confirmDialog({ message: msg, okText: 'Kết thúc', danger: true })) setStatus('closed', 'Đã đóng phòng thi');
  }
  async function saveGrades() {
    try { const { data } = await api.post(`/exams/${examId}/save-grades`, {}); toast(`Đã lưu ${data.saved} điểm vào trang Điểm số`); }
    catch (e) { toast.err(errMsg(e, 'Lưu điểm thất bại')); }
  }
  async function copyLink() {
    if (await copyText(link)) toast('Đã sao chép link phòng thi'); else toast.err('Không sao chép được, hãy bôi đen link để sao chép');
  }
  if (!exam) return <div className="muted">Đang tải…</div>;

  const link = EXAM_BASE + exam.code;
  const attempts = exam.attempts || [];
  const submitted = attempts.filter((a) => a.status === 'submitted');
  const open = exam.status === 'waiting' || exam.status === 'started';
  const joinedIds = new Set(attempts.map((a) => a.student_id));
  const absent = (roster || []).filter((s) => !joinedIds.has(s.id));
  const scores = submitted.map((a) => Number(a.score)).filter((x) => !Number.isNaN(x));
  const avg = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length) : null;

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>{exam.title} {badge(exam.status)}</h1>
        <button className="btn ghost" onClick={onBack}>← Danh sách đề</button>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>Lớp: <b>{exam.class_name || 'Chưa gán lớp'}</b> · {kindLabel(exam.kind)} (hệ số {exam.weight}) · {exam.questions?.length || 0} câu · {exam.duration_min ? `làm bài ${exam.duration_min} phút` : 'không giới hạn giờ'}</p>
      {(exam.questions?.length > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn ghost sm" onClick={() => printExamPaper(exam, 'student')}><IconPrinter className="bi" />In đề (học viên)</button>
          <button className="btn ghost sm" onClick={() => printExamPaper(exam, 'key')}><IconPrinter className="bi" />In đáp án (GLV)</button>
          <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Chọn "Lưu thành PDF" trong hộp thoại in để tải về in giấy.</span>
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-col">
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="card-head" style={{ justifyContent: 'center' }}><h2 style={{ margin: 0 }}>Mã dự thi</h2></div>
            {qr && open
              ? <img src={qr} alt="Mã QR vào phòng thi" style={{ width: 220, height: 220 }} />
              : <div className="muted" style={{ padding: 30 }}>{exam.status === 'draft' ? 'QR hiện khi mở phòng chờ' : 'Phòng thi đã đóng'}</div>}
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, margin: '6px 0' }}>{exam.code}</div>
            <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{link}</div>
            {open && (
              <div className="exx-roomtools">
                <button className="btn ghost sm" onClick={copyLink}><IconCopy className="bi" />Sao chép link</button>
                <button className="btn ghost sm" onClick={() => setProjecting(true)}>Chiếu lên màn hình</button>
              </div>
            )}
            {exam.status === 'started' && timeLeft != null && (
              <>
                <div className={`room-timer ${timeLeft <= 60000 ? 'low' : ''}`}>
                  {timeLeft > 0 ? <><IconClock className="bi" />Còn khoảng <b>{fmt(timeLeft)}</b></> : <><IconClock className="bi" />Đã hết giờ (tính từ lúc bắt đầu)</>}
                </div>
                <p className="muted exx-hint">Giờ làm bài tính riêng cho từng em từ lúc em vào bài, nên em vào muộn vẫn đủ giờ.</p>
              </>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {exam.status === 'draft' && <button className="btn" disabled={busy} onClick={() => setStatus('waiting', 'Đã mở phòng chờ')}>Mở phòng chờ</button>}
              {exam.status === 'waiting' && <button className="btn" disabled={busy} onClick={start}>▶ Bắt đầu thi</button>}
              {exam.status === 'started' && <button className="btn danger" disabled={busy} onClick={finish}>■ Kết thúc</button>}
              {exam.status === 'closed' && <button className="btn" disabled={busy} onClick={() => setStatus('started', 'Đã mở thi lại')}><IconRefresh className="bi" />Mở thi lại (cho em vắng)</button>}
            </div>
            {exam.status === 'waiting' && <p className="muted exx-hint">Các em quét QR, chọn tên và chờ. Bấm "Bắt đầu thi" khi đủ.</p>}
            {exam.status === 'closed' && <p className="muted exx-hint">Bấm "Mở thi lại" để em vắng buổi thi vào làm; điểm sẽ được gộp vào cùng cột điểm cũ.</p>}
          </div>
        </div>

        <div className="dash-col">
          <div className="panel">
            <div className="card-head"><h2 style={{ margin: 0 }}>Học viên ({attempts.length}{roster ? `/${roster.length}` : ''})</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 13 }}>Đã nộp {submitted.length}</span>
                {submitted.length > 0 && <button className="btn ghost sm" onClick={exportResults}><IconDownload className="bi" />Excel</button>}
              </div>
            </div>
            {avg != null && (
              <div className="exx-stats">
                <span>Trung bình <b>{avg.toFixed(1)}</b></span>
                <span>Cao nhất <b>{Math.max(...scores)}</b></span>
                <span>Thấp nhất <b>{Math.min(...scores)}</b></span>
                <span>Dưới 5 <b>{scores.filter((x) => x < 5).length}</b></span>
              </div>
            )}
            <div className="table-scroll" style={{ maxHeight: 320 }}><table>
              <thead><tr><th>Tên</th><th>Trạng thái</th><th>Điểm</th></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className={a.status === 'submitted' ? 'click-row' : ''} onClick={() => a.status === 'submitted' && setReviewing(a)}>
                    <td>{a.student_name}{a.leave_count > 0 && <span title="Số lần rời màn hình thi" style={{ color: '#dc2626', fontWeight: 700, fontSize: 12 }}> <IconAlert className="bi" style={{ width: 13, height: 13, marginRight: 2 }} />{a.leave_count}</span>}{a.status === 'submitted' && <span className="muted" style={{ fontSize: 11 }}> · xem lại</span>}</td>
                    <td>{a.status === 'submitted' ? <span className="tag-chip tone-green">Đã nộp</span> : <span className="muted">Đang làm</span>}</td>
                    <td style={{ fontWeight: 600 }}>{a.score != null ? a.score : NA}{a.total ? <span className="muted" style={{ fontSize: 12 }}> ({a.correct_count}/{a.total})</span> : ''}</td>
                  </tr>
                ))}
                {attempts.length === 0 && <tr><td colSpan={3} className="muted">{exam.status === 'draft' ? 'Mở phòng chờ để các em vào.' : 'Chưa có em nào vào.'}</td></tr>}
              </tbody>
            </table></div>
            {exam.status !== 'draft' && absent.length > 0 && (
              <details className="exx-absent">
                <summary>Chưa vào phòng ({absent.length})</summary>
                <div>{absent.map((s) => [s.saint_name, s.full_name].filter(Boolean).join(' ')).join(', ')}</div>
              </details>
            )}
            {submitted.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button className="btn ghost" onClick={saveGrades}><IconRefresh className="bi" />Đồng bộ lại điểm sang Điểm số</button>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Điểm tự đồng bộ khi các em nộp; nút này chỉ để đồng bộ lại thủ công khi cần.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {projecting && (
        <div className="exx-project" onClick={() => setProjecting(false)} role="dialog" aria-modal="true" aria-label="Chiếu mã phòng thi">
          <div className="exx-project-in" onClick={(e) => e.stopPropagation()}>
            <div className="exx-project-t">{exam.title}</div>
            {qr && <img src={qr} alt="Mã QR vào phòng thi" />}
            <div className="exx-project-code">{exam.code}</div>
            <div className="exx-project-link">{link}</div>
            <div className="exx-project-n">{attempts.length}{roster ? `/${roster.length}` : ''} em đã vào phòng</div>
            <button className="btn ghost" onClick={() => setProjecting(false)}>Đóng (Esc)</button>
          </div>
        </div>
      )}

      {reviewing && (
        <div className="modal-backdrop" onClick={() => setReviewing(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="card-head"><h2 style={{ margin: 0 }}>Bài làm: {reviewing.student_name}</h2>
              <span className="muted">{reviewing.score}/10 · đúng {reviewing.correct_count}/{reviewing.total}</span></div>
            <div className="pick-list" style={{ maxHeight: '62vh' }}>
              {(exam.questions || []).map((q, i) => {
                const chosen = reviewing.answers?.[q.id];
                const right = chosen === q.correct;
                return (
                  <div className="rv-q" key={q.id}>
                    <div className="rv-q-t"><b>Câu {i + 1}.</b> {q.text} {chosen == null ? <span className="muted">(bỏ trống)</span> : right ? <span style={{ color: '#15803d' }}>✓</span> : <span style={{ color: '#dc2626' }}>✗</span>}</div>
                    {(q.options || []).map((opt, idx) => (
                      <div key={idx} className={`rv-opt ${idx === q.correct ? 'correct' : ''} ${idx === chosen && !right ? 'wrong' : ''}`}>
                        <b>{LETTERS[idx]}.</b> {opt}
                        {idx === q.correct && <span className="rv-tag ok"> đáp án đúng</span>}
                        {idx === chosen && <span className="muted"> ← em chọn</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setReviewing(null)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
