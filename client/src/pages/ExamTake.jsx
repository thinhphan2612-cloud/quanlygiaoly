import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const lsKey = (code) => `exam:${code}`;

export default function ExamTake() {
  const { code } = useParams();
  const [exam, setExam] = useState(undefined); // undefined=loading, null=not found
  const [attempt, setAttempt] = useState(() => { try { return JSON.parse(localStorage.getItem(lsKey(code)) || 'null'); } catch { return null; } });
  const [roster, setRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const [joining, setJoining] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showMissing, setShowMissing] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const pollRef = useRef(null);

  const loadExam = () => supabase.rpc('exam_public', { p_code: code }).then(({ data }) => setExam(data || null));
  useEffect(() => { loadExam(); }, [code]);

  // Lobby: tải danh sách lớp để chọn tên
  useEffect(() => {
    if (exam && !attempt) supabase.rpc('exam_roster', { p_code: code }).then(({ data }) => setRoster(data || []));
  }, [exam, attempt, code]);

  // Đã vào phòng nhưng chưa bắt đầu -> poll trạng thái
  useEffect(() => {
    if (!attempt || result) return;
    if (exam && exam.status !== 'started') {
      pollRef.current = setInterval(loadExam, 2500);
      return () => clearInterval(pollRef.current);
    }
  }, [attempt, exam?.status, result]); // eslint-disable-line

  // Khi đã bắt đầu -> tải đề (ẩn đáp án)
  useEffect(() => {
    if (attempt && exam?.status === 'started' && questions === null && !result) {
      supabase.rpc('exam_take', { p_code: code }).then(({ data }) => setQuestions(data || []));
    }
  }, [attempt, exam?.status, questions, result, code]);

  const shownRoster = useMemo(() => {
    const t = search.trim().toLowerCase();
    return roster.filter((r) => !t || (r.name || '').toLowerCase().includes(t));
  }, [roster, search]);

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

  function pick(qid, idx) { setAnswers((a) => ({ ...a, [qid]: idx })); }

  async function submit() {
    const missing = (questions || []).filter((q) => answers[q.id] == null);
    if (missing.length) {
      setShowMissing(true);
      const nums = missing.map((q) => (questions.indexOf(q) + 1));
      alert(`Còn ${missing.length} câu chưa làm: câu ${nums.join(', ')}.\nVui lòng làm hết trước khi nộp.`);
      const first = document.getElementById('q-' + missing[0].id);
      first && first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm('Nộp bài? Bạn sẽ không sửa được sau khi nộp.')) return;
    try {
      const { data, error } = await supabase.rpc('exam_submit', { p_attempt_id: attempt.id, p_answers: answers });
      if (error) throw error;
      setResult(data);
      localStorage.removeItem(lsKey(code));
    } catch (e) { alert(e.message || 'Nộp bài thất bại'); }
  }

  // ----- Trạng thái tải / không tìm thấy -----
  if (exam === undefined) return <div className="exam-wrap"><div className="exam-msg">Đang tải…</div></div>;
  if (exam === null) return <div className="exam-wrap"><div className="exam-msg">Không tìm thấy đề thi. Kiểm tra lại mã hoặc QR.</div></div>;

  // ----- Kết quả -----
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

  // ----- Lobby: chọn tên -----
  if (!attempt) return (
    <div className="exam-wrap"><div className="exam-paper">
      <div className="exam-head"><h1>{exam.title}</h1><p className="muted">Lớp {exam.class_name} · {exam.num_questions} câu</p></div>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Chọn tên của con để vào phòng thi:</p>
      <input className="exam-input" placeholder="Tìm tên…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="exam-roster">
        {shownRoster.map((r) => (
          <label key={r.id} className={`exam-name ${picked === r.id ? 'on' : ''}`}>
            <input type="radio" name="who" checked={picked === r.id} onChange={() => setPicked(r.id)} />
            <span>{r.name}</span>
          </label>
        ))}
        {shownRoster.length === 0 && <div className="muted" style={{ padding: 10 }}>Không có tên phù hợp.</div>}
      </div>
      {err && <div className="error">{err}</div>}
      <button className="exam-btn" onClick={join} disabled={!picked || joining}>{joining ? 'Đang vào…' : 'Vào phòng thi'}</button>
    </div></div>
  );

  // ----- Đã vào, chờ bắt đầu -----
  if (exam.status !== 'started') return (
    <div className="exam-wrap"><div className="exam-paper exam-result">
      <div className="exam-spin">⏳</div>
      <h2>Xin chào, {attempt.name}</h2>
      <p className="muted">{exam.status === 'closed' ? 'Đề thi đã đóng.' : 'Đang chờ giáo lý viên bắt đầu… Vui lòng giữ nguyên trang này.'}</p>
    </div></div>
  );

  // ----- Làm bài (đề dạng 1 tờ A4) -----
  const answeredCount = Object.keys(answers).length;
  return (
    <div className="exam-wrap">
      <div className="exam-paper">
        <div className="exam-head">
          <h1>{exam.title}</h1>
          <p className="muted">Họ tên: <b>{attempt.name}</b> · Lớp {exam.class_name}</p>
        </div>
        {(questions || []).map((q, i) => (
          <div className="exam-q" id={'q-' + q.id} key={q.id}>
            <div className={`exam-q-text ${showMissing && answers[q.id] == null ? 'miss' : ''}`}><b>Câu {i + 1}.</b> {q.text}</div>
            <div className="exam-opts">
              {(q.options || []).map((opt, idx) => (
                <label key={idx} className={`exam-opt ${answers[q.id] === idx ? 'on' : ''}`}>
                  <input type="radio" name={'q' + q.id} checked={answers[q.id] === idx} onChange={() => pick(q.id, idx)} />
                  <span className="exam-letter">{LETTERS[idx]}</span><span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {questions && questions.length === 0 && <p className="muted">Đề chưa có câu hỏi.</p>}
      </div>
      <div className="exam-bar">
        <span>{answeredCount}/{questions?.length || 0} câu</span>
        <button className="exam-btn" onClick={submit}>Nộp bài</button>
      </div>
    </div>
  );
}
