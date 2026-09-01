import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const lsKey = (code) => `exam:${code}`;

// PRNG có seed để trộn ổn định theo từng bài làm (attempt id)
function seedFrom(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildDisplay(questions, seedStr) {
  const rnd = mulberry32(seedFrom(seedStr));
  return shuffle(questions, rnd).map((q) => ({
    id: q.id, text: q.text,
    opts: shuffle((q.options || []).map((text, orig) => ({ text, orig })), rnd),
  }));
}
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export default function ExamTake() {
  const { code } = useParams();
  const [exam, setExam] = useState(undefined); // undefined=loading, null=not found
  const [attempt, setAttempt] = useState(() => { try { return JSON.parse(localStorage.getItem(lsKey(code)) || 'null'); } catch { return null; } });
  const [roster, setRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const [joining, setJoining] = useState(false);
  const [displayQs, setDisplayQs] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showMissing, setShowMissing] = useState(false);
  const [result, setResult] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [err, setErr] = useState('');
  const pollRef = useRef(null);
  const answersRef = useRef({});
  const submittingRef = useRef(false);

  const loadExam = () => supabase.rpc('exam_public', { p_code: code }).then(({ data }) => setExam(data || null));
  useEffect(() => { loadExam(); }, [code]);

  useEffect(() => { if (exam && !attempt) supabase.rpc('exam_roster', { p_code: code }).then(({ data }) => setRoster(data || [])); }, [exam, attempt, code]);

  // Chờ bắt đầu -> poll
  useEffect(() => {
    if (!attempt || result) return;
    if (exam && exam.status !== 'started') { pollRef.current = setInterval(loadExam, 2500); return () => clearInterval(pollRef.current); }
  }, [attempt, exam?.status, result]); // eslint-disable-line

  // Vào làm bài: bắt đầu tính giờ + tải đề (ẩn đáp án) + trộn theo attempt
  useEffect(() => {
    if (!(attempt && exam?.status === 'started' && displayQs === null && !result)) return;
    (async () => {
      const { data: beg } = await supabase.rpc('exam_begin', { p_attempt_id: attempt.id });
      if (beg?.submitted) { setResult({ score: beg.score, correct: beg.correct, total: beg.total }); return; }
      const { data: qs } = await supabase.rpc('exam_take', { p_code: code });
      setDisplayQs(buildDisplay(qs || [], attempt.id));
      if (beg?.duration_min && beg.started_at && beg.server_now) {
        const remain = beg.duration_min * 60000 - (Date.parse(beg.server_now) - Date.parse(beg.started_at));
        setDeadline(Date.now() + Math.max(0, remain));
      }
    })();
  }, [attempt, exam?.status, displayQs, result, code]);

  // Đồng hồ đếm ngược -> hết giờ tự nộp
  useEffect(() => {
    if (!deadline || result) return;
    const t = setInterval(() => {
      const left = deadline - Date.now();
      setTimeLeft(left);
      if (left <= 0) { clearInterval(t); doSubmit(true); }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, result]); // eslint-disable-line

  const shownRoster = useMemo(() => { const t = search.trim().toLowerCase(); return roster.filter((r) => !t || (r.name || '').toLowerCase().includes(t)); }, [roster, search]);

  async function join() {
    if (!picked) return;
    setJoining(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('exam_join', { p_code: code, p_student_id: picked });
      if (error) throw error;
      const st = roster.find((r) => r.id === picked);
      const att = { id: data, student_id: picked, name: st?.name || '' };
      localStorage.setItem(lsKey(code), JSON.stringify(att));
      setAttempt(att); loadExam();
    } catch (e) { setErr(e.message || 'Không vào được phòng thi'); } finally { setJoining(false); }
  }

  function pick(qid, orig) { setAnswers((a) => { const n = { ...a, [qid]: orig }; answersRef.current = n; return n; }); }

  async function doSubmit(auto) {
    if (submittingRef.current) return;
    const ans = answersRef.current;
    if (!auto) {
      const missing = (displayQs || []).filter((q) => ans[q.id] == null);
      if (missing.length) {
        setShowMissing(true);
        const nums = missing.map((q) => displayQs.indexOf(q) + 1);
        alert(`Còn ${missing.length} câu chưa làm: câu ${nums.join(', ')}.\nVui lòng làm hết trước khi nộp.`);
        const first = document.getElementById('q-' + missing[0].id);
        first && first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!confirm('Nộp bài? Bạn sẽ không sửa được sau khi nộp.')) return;
    }
    submittingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('exam_submit', { p_attempt_id: attempt.id, p_answers: ans });
      if (error) throw error;
      setResult(data); localStorage.removeItem(lsKey(code));
    } catch (e) { submittingRef.current = false; if (!auto) alert(e.message || 'Nộp bài thất bại'); }
  }

  if (exam === undefined) return <div className="exam-wrap"><div className="exam-msg">Đang tải…</div></div>;
  if (exam === null) return <div className="exam-wrap"><div className="exam-msg">Không tìm thấy đề thi. Kiểm tra lại mã hoặc QR.</div></div>;

  if (result) return (
    <div className="exam-wrap"><div className="exam-paper exam-result">
      <div style={{ fontSize: 46 }}>🎉</div>
      <h2>Đã nộp bài!</h2>
      <p className="muted">{attempt?.name}</p>
      <div className="exam-score">{result.score}<span>/10</span></div>
      <p className="muted">Đúng {result.correct}/{result.total} câu</p>
      <p className="muted" style={{ fontSize: 13 }}>Cảm ơn con. Có thể đóng trang này.</p>
    </div></div>
  );

  if (!attempt) return (
    <div className="exam-wrap"><div className="exam-paper">
      <div className="exam-head"><h1>{exam.title}</h1><p className="muted">Lớp {exam.class_name} · {exam.num_questions} câu{exam.duration_min ? ` · ${exam.duration_min} phút` : ''}</p></div>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Chọn tên của con để vào phòng thi:</p>
      <input className="exam-input" placeholder="Tìm tên…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="exam-roster">
        {shownRoster.map((r) => (
          <label key={r.id} className={`exam-name ${picked === r.id ? 'on' : ''}`}>
            <input type="radio" name="who" checked={picked === r.id} onChange={() => setPicked(r.id)} /><span>{r.name}</span>
          </label>
        ))}
        {shownRoster.length === 0 && <div className="muted" style={{ padding: 10 }}>Không có tên phù hợp.</div>}
      </div>
      {err && <div className="error">{err}</div>}
      <button className="exam-btn" onClick={join} disabled={!picked || joining}>{joining ? 'Đang vào…' : 'Vào phòng thi'}</button>
    </div></div>
  );

  if (exam.status !== 'started') return (
    <div className="exam-wrap"><div className="exam-paper exam-result">
      <div className="exam-spin">⏳</div>
      <h2>Xin chào, {attempt.name}</h2>
      <p className="muted">{exam.status === 'closed' ? 'Đề thi đã đóng.' : 'Đang chờ giáo lý viên bắt đầu… Vui lòng giữ nguyên trang này.'}</p>
    </div></div>
  );

  const answeredCount = Object.keys(answers).length;
  const low = timeLeft != null && timeLeft <= 60000;
  return (
    <div className="exam-wrap">
      <div className="exam-paper">
        <div className="exam-head">
          <h1>{exam.title}</h1>
          <p className="muted">Họ tên: <b>{attempt.name}</b> · Lớp {exam.class_name}</p>
        </div>
        {(displayQs || []).map((q, i) => (
          <div className="exam-q" id={'q-' + q.id} key={q.id}>
            <div className={`exam-q-text ${showMissing && answers[q.id] == null ? 'miss' : ''}`}><b>Câu {i + 1}.</b> {q.text}</div>
            <div className="exam-opts">
              {q.opts.map((opt, idx) => (
                <label key={idx} className={`exam-opt ${answers[q.id] === opt.orig ? 'on' : ''}`}>
                  <input type="radio" name={'q' + q.id} checked={answers[q.id] === opt.orig} onChange={() => pick(q.id, opt.orig)} />
                  <span className="exam-letter">{LETTERS[idx]}</span><span>{opt.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {displayQs === null && <p className="muted">Đang tải đề…</p>}
      </div>
      <div className="exam-bar">
        {timeLeft != null && <span className={`exam-timer ${low ? 'low' : ''}`}>⏱ {fmt(timeLeft)}</span>}
        <span>{answeredCount}/{displayQs?.length || 0} câu</span>
        <button className="exam-btn" onClick={() => doSubmit(false)}>Nộp bài</button>
      </div>
    </div>
  );
}
