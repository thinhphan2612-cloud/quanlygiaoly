import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const lsKey = (code) => `exam:${code}`;

function seedFrom(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildDisplay(questions, seedStr) {
  const rnd = mulberry32(seedFrom(seedStr));
  return shuffle(questions, rnd).map((q) => ({ id: q.id, text: q.text, opts: shuffle((q.options || []).map((text, orig) => ({ text, orig })), rnd) }));
}
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function ReviewList({ questions }) {
  return questions.map((q, i) => {
    const right = q.chosen === q.correct;
    return (
      <div className="rv-q" key={i}>
        <div className="rv-q-t"><b>Câu {i + 1}.</b> {q.text} {q.chosen == null ? <span className="muted">(bỏ trống)</span> : right ? <span style={{ color: '#15803d' }}>✓ đúng</span> : <span style={{ color: '#dc2626' }}>✗ sai</span>}</div>
        {q.options.map((opt, idx) => (
          <div key={idx} className={`rv-opt ${idx === q.correct ? 'correct' : ''} ${idx === q.chosen && !right ? 'wrong' : ''}`}>
            <b>{LETTERS[idx]}.</b> {opt}{idx === q.correct ? ' ✔' : ''}{idx === q.chosen ? ' ← con chọn' : ''}
          </div>
        ))}
      </div>
    );
  });
}

export default function ExamTake() {
  const { code } = useParams();
  const [exam, setExam] = useState(undefined);
  const [attempt, setAttempt] = useState(() => { try { return JSON.parse(localStorage.getItem(lsKey(code)) || 'null'); } catch { return null; } });
  const [roster, setRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const [joining, setJoining] = useState(false);
  const [displayQs, setDisplayQs] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showMissing, setShowMissing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [review, setReview] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [err, setErr] = useState('');
  const answersRef = useRef({});
  const submittingRef = useRef(false);
  const resumedRef = useRef(false);

  const loadExam = () => supabase.rpc('exam_public', { p_code: code }).then(({ data }) => setExam(data || null));
  useEffect(() => { loadExam(); }, [code]);
  useEffect(() => { if (exam && !attempt) supabase.rpc('exam_roster', { p_code: code }).then(({ data }) => setRoster(data || [])); }, [exam, attempt, code]);

  // Vào bài (started: tải đề + tính giờ; closed & đã nộp: lấy kết quả để hiện)
  useEffect(() => {
    if (!attempt || resumedRef.current || exam === undefined || exam === null) return;
    if (exam.status === 'started') {
      resumedRef.current = true;
      (async () => {
        const { data: beg } = await supabase.rpc('exam_begin', { p_attempt_id: attempt.id });
        if (beg?.leave_count) setLeaveCount(beg.leave_count); // hiện lại cảnh báo sau khi iOS reload
        if (beg?.submitted) { setScoreData({ score: beg.score, correct: beg.correct, total: beg.total }); setSubmitted(true); }
        const { data: qs } = await supabase.rpc('exam_take', { p_code: code });
        setDisplayQs(buildDisplay(qs || [], attempt.id));
        if (beg?.duration_min && beg.started_at && beg.server_now) {
          const remain = beg.duration_min * 60000 - (Date.parse(beg.server_now) - Date.parse(beg.started_at));
          setDeadline(Date.now() + Math.max(0, remain));
        }
      })();
    } else if (exam.status === 'closed') {
      resumedRef.current = true;
      (async () => {
        const { data } = await supabase.rpc('exam_review', { p_attempt_id: attempt.id });
        if (data && !data.error) { setScoreData({ score: data.score, correct: data.correct, total: data.total }); setReview(data); setSubmitted(true); setRevealed(true); }
      })();
    }
  }, [attempt, exam, code]);

  // Poll trạng thái (để bắt GLV "Kết thúc") + đồng hồ, cho tới khi công bố
  useEffect(() => { if (!attempt || revealed) return; const t = setInterval(loadExam, 2500); return () => clearInterval(t); }, [attempt, revealed]); // eslint-disable-line
  useEffect(() => { if (!deadline || revealed) return; const t = setInterval(() => setTimeLeft(deadline - Date.now()), 500); setTimeLeft(deadline - Date.now()); return () => clearInterval(t); }, [deadline, revealed]);

  // Cổng công bố: hết giờ (đề có giờ) hoặc GLV kết thúc -> tự nộp (nếu chưa) rồi hiện kết quả
  useEffect(() => {
    if (!attempt || revealed || exam === undefined || exam === null) return;
    const closed = exam.status === 'closed';
    const timeUp = deadline ? (timeLeft != null ? timeLeft <= 0 : Date.now() >= deadline) : false;
    if (!(closed || timeUp)) return;
    (async () => {
      if (!submitted) { const d = await doSubmit(true); if (d) setRevealed(true); }
      else setRevealed(true);
    })();
  }, [attempt, revealed, exam, timeLeft, deadline, submitted]); // eslint-disable-line

  // Chống gian lận: khi đang làm bài, chặn bôi đen/copy/cut/chuột phải để không sao chép câu hỏi ra ngoài.
  const taking = !!(attempt && exam && exam.status === 'started' && displayQs && !submitted && !revealed);
  const [leaveCount, setLeaveCount] = useState(0);
  useEffect(() => {
    if (!taking) return;
    const block = (e) => e.preventDefault();
    // Rời màn hình (đổi app/tab…) -> ghi nhận trên server + cập nhật số lần.
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        setLeaveCount((c) => c + 1); // hiện ngay
        supabase.rpc('exam_leave', { p_attempt_id: attempt.id }).then(({ data }) => { if (typeof data === 'number') setLeaveCount(data); }).catch(() => {});
      }
    };
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('copy', block); document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block); document.removeEventListener('visibilitychange', onHide);
    };
  }, [taking, attempt]);

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
    if (submittingRef.current || submitted) return null;
    const ans = answersRef.current;
    if (!auto) {
      const missing = (displayQs || []).filter((q) => ans[q.id] == null);
      if (missing.length) {
        setShowMissing(true);
        const nums = missing.map((q) => displayQs.indexOf(q) + 1);
        alert(`Còn ${missing.length} câu chưa làm: câu ${nums.join(', ')}.\nVui lòng làm hết trước khi nộp.`);
        const first = document.getElementById('q-' + missing[0].id); first && first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return null;
      }
      if (!confirm('Nộp bài? Sau khi nộp con sẽ chờ công bố kết quả.')) return null;
    }
    submittingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('exam_submit', { p_attempt_id: attempt.id, p_answers: ans });
      if (error) throw error;
      setScoreData(data); setSubmitted(true); localStorage.removeItem(lsKey(code));
      return data;
    } catch (e) { submittingRef.current = false; if (!auto) alert(e.message || 'Nộp bài thất bại'); return null; }
  }
  async function loadReview() { const { data } = await supabase.rpc('exam_review', { p_attempt_id: attempt.id }); if (data && !data.error) setReview(data); }

  if (exam === undefined) return <div className="exam-wrap"><div className="exam-msg">Đang tải…</div></div>;
  if (exam === null) return <div className="exam-wrap"><div className="exam-msg">Không tìm thấy đề thi. Kiểm tra lại mã hoặc QR.</div></div>;

  // Lobby
  if (!attempt) return (
    <div className="exam-wrap"><div className="exam-paper">
      <div className="exam-head"><h1>{exam.title}</h1><p className="muted">Lớp {exam.class_name} · {exam.num_questions} câu{exam.duration_min ? ` · ${exam.duration_min} phút` : ''}</p></div>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Chọn tên của con để vào phòng thi:</p>
      <input className="exam-input" placeholder="Tìm tên…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="exam-roster">
        {shownRoster.map((r) => (
          <label key={r.id} className={`exam-name ${picked === r.id ? 'on' : ''}`}><input type="radio" name="who" checked={picked === r.id} onChange={() => setPicked(r.id)} /><span>{r.name}</span></label>
        ))}
        {shownRoster.length === 0 && <div className="muted" style={{ padding: 10 }}>Không có tên phù hợp.</div>}
      </div>
      {err && <div className="error">{err}</div>}
      <button className="exam-btn" onClick={join} disabled={!picked || joining}>{joining ? 'Đang vào…' : 'Vào phòng thi'}</button>
    </div></div>
  );

  // Đã công bố -> kết quả + xem lại
  if (revealed && scoreData) return (
    <div className="exam-wrap"><div className="exam-paper">
      <div className="exam-result">
        <div style={{ fontSize: 46 }}>🎉</div><h2>Kết quả của con</h2><p className="muted">{attempt.name}</p>
        <div className="exam-score">{scoreData.score}<span>/10</span></div>
        <p className="muted">Đúng {scoreData.correct}/{scoreData.total} câu</p>
        {!review && <button className="exam-btn" style={{ maxWidth: 280, margin: '10px auto 0' }} onClick={loadReview}>Xem lại bài (đúng / sai)</button>}
      </div>
      {review && <div style={{ marginTop: 16 }}><ReviewList questions={review.questions} /></div>}
    </div></div>
  );

  // Đã nộp, chờ công bố
  if (submitted) return (
    <div className="exam-wrap"><div className="exam-paper exam-result">
      <div className="exam-spin">✅</div><h2>Đã nộp bài, {attempt.name}!</h2>
      {deadline
        ? <p className="muted">Kết quả sẽ hiện khi <b>hết giờ</b>. {timeLeft != null && timeLeft > 0 && <>Còn lại <b>{fmt(timeLeft)}</b>.</>}</p>
        : <p className="muted">Chờ giáo lý viên <b>công bố kết quả</b>. Vui lòng giữ nguyên trang này.</p>}
    </div></div>
  );

  // Đang làm bài
  if (displayQs) {
    const answeredCount = Object.keys(answers).length;
    const low = timeLeft != null && timeLeft <= 60000;
    return (
      <div className="exam-wrap">
        <div className="exam-paper exam-noselect">
          <div className="exam-head"><h1>{exam.title}</h1><p className="muted">Họ tên: <b>{attempt.name}</b> · Lớp {exam.class_name}</p></div>
          {leaveCount > 0 && <div className="exam-warn">⚠ Con đã rời khỏi màn hình thi <b>{leaveCount} lần</b>. Vui lòng ở lại trang cho đến khi nộp — mỗi lần rời màn hình đều được ghi lại cho giáo lý viên.</div>}
          {displayQs.map((q, i) => (
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
        </div>
        <div className="exam-bar">
          {timeLeft != null && <span className={`exam-timer ${low ? 'low' : ''}`}>⏱ {fmt(timeLeft)}</span>}
          <span>{answeredCount}/{displayQs.length} câu</span>
          <button className="exam-btn" onClick={() => doSubmit(false)}>Nộp bài</button>
        </div>
      </div>
    );
  }

  // Đã vào nhưng chưa bắt đầu / đã đóng mà chưa làm
  return (
    <div className="exam-wrap"><div className="exam-paper exam-result">
      <div className="exam-spin">⏳</div><h2>Xin chào, {attempt.name}</h2>
      <p className="muted">{exam.status === 'closed' ? 'Đề thi đã đóng.' : 'Đang chờ giáo lý viên bắt đầu… Vui lòng giữ nguyên trang này.'}</p>
    </div></div>
  );
}
