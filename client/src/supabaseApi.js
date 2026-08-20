// Lớp dữ liệu chạy trên Supabase — mô phỏng interface path-based (get/post/put/delete)
// mà các trang đang dùng, để không phải sửa nhiều ở tầng UI.
// Mỗi giáo xứ là 1 tenant; RLS ở Supabase tự lọc theo parish_id.
import { supabase } from './supabase';

const ok = (data) => Promise.resolve({ data });
const fail = (status, error) => Promise.reject({ response: { status, data: { error } } });
const round1 = (n) => Math.round(n * 10) / 10;

function parishId() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').parish_id || null;
  } catch {
    return null;
  }
}

// '' → null cho các cột uuid/date để tránh lỗi kiểu dữ liệu
const nn = (v) => (v === '' || v === undefined ? null : v);

const STUDENT_FIELDS = [
  'full_name', 'saint_name', 'birth_date', 'gender', 'parent_name', 'parent_phone',
  'student_phone', 'address', 'class_id', 'notes', 'position', 'sacrament',
];
function cleanStudent(body) {
  const out = {};
  for (const k of STUDENT_FIELDS) if (body[k] !== undefined) out[k] = nn(body[k]);
  return out;
}

async function handle(method, rawUrl, body = {}) {
  const pid = parishId();
  const [path, qs] = rawUrl.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/').filter(Boolean); // ['students','5']

  try {
    // ---------------- classes ----------------
    if (path === '/classes' && method === 'get') {
      const [{ data: classes, error: e1 }, { data: cts }, { data: studs }] = await Promise.all([
        supabase.from('classes').select('*').order('order_index').order('name'),
        supabase.from('class_teachers').select('class_id, teacher_id, is_primary, profiles(full_name)'),
        supabase.from('students').select('class_id').eq('graduated', false),
      ]);
      if (e1) return fail(400, e1.message);
      const countByClass = {};
      (studs || []).forEach((s) => { if (s.class_id) countByClass[s.class_id] = (countByClass[s.class_id] || 0) + 1; });
      const teacherByClass = {};
      (cts || []).forEach((ct) => {
        if (!teacherByClass[ct.class_id] || ct.is_primary) {
          teacherByClass[ct.class_id] = { id: ct.teacher_id, name: ct.profiles?.full_name || null };
        }
      });
      return ok((classes || []).map((c) => ({
        ...c,
        year: c.school_year,
        teacher_id: teacherByClass[c.id]?.id || null,
        teacher_name: teacherByClass[c.id]?.name || null,
        student_count: countByClass[c.id] || 0,
      })));
    }
    if (path === '/classes' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên lớp');
      const { data: cls, error } = await supabase
        .from('classes')
        .insert({ parish_id: pid, name: body.name, school_year: nn(body.year) })
        .select().single();
      if (error) return fail(400, error.message);
      if (body.teacher_id) {
        await supabase.from('class_teachers').insert({ class_id: cls.id, teacher_id: body.teacher_id, is_primary: true });
      }
      return ok(cls);
    }
    if (seg[0] === 'classes' && seg[1] && method === 'put') {
      const { error } = await supabase.from('classes')
        .update({ name: body.name, school_year: nn(body.year) })
        .eq('id', seg[1]);
      if (error) return fail(400, error.message);
      // Cập nhật giáo viên chính
      await supabase.from('class_teachers').delete().eq('class_id', seg[1]).eq('is_primary', true);
      if (body.teacher_id) {
        await supabase.from('class_teachers').insert({ class_id: seg[1], teacher_id: body.teacher_id, is_primary: true });
      }
      return ok({ ok: true });
    }
    if (seg[0] === 'classes' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('classes').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- profiles (auth/users) ----------------
    if (path === '/auth/users' && method === 'get') {
      const { data, error } = await supabase.from('profiles')
        .select('id, full_name, role').order('full_name');
      if (error) return fail(400, error.message);
      return ok((data || []).map((u) => ({ ...u, username: '' })));
    }
    if (path === '/auth/users' && method === 'post') {
      return fail(501, 'Thêm tài khoản giáo lý viên sẽ có ở bản sau (cần Supabase Edge Function để tạo user an toàn).');
    }
    if (seg[0] === 'auth' && seg[1] === 'users' && seg[2] && method === 'delete') {
      const { error } = await supabase.from('profiles').delete().eq('id', seg[2]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- students ----------------
    if (path === '/students' && method === 'get') {
      let query = supabase.from('students').select('*, classes(name)')
        .eq('graduated', false).order('full_name');
      if (q.class_id) query = query.eq('class_id', q.class_id);
      const { data, error } = await query;
      if (error) return fail(400, error.message);
      return ok((data || []).map((s) => ({ ...s, class_name: s.classes?.name || null })));
    }
    if (path === '/students' && method === 'post') {
      if (!body.full_name) return fail(400, 'Thiếu họ tên học viên');
      const { data, error } = await supabase.from('students')
        .insert({ parish_id: pid, ...cleanStudent(body) }).select('*, classes(name)').single();
      if (error) return fail(400, error.message);
      return ok({ ...data, class_name: data.classes?.name || null });
    }
    if (path === '/students/bulk' && method === 'post') {
      const list = Array.isArray(body.students) ? body.students : [];
      const valid = list.filter((s) => s.full_name && s.full_name.trim());
      if (valid.length === 0) return fail(400, 'Không có dòng nào hợp lệ (thiếu họ tên)');
      const rows = valid.map((s) => ({
        parish_id: pid, ...cleanStudent({ ...s, class_id: body.class_id || s.class_id || '' }),
      }));
      const { error } = await supabase.from('students').insert(rows);
      if (error) return fail(400, error.message);
      return ok({ count: valid.length, skipped: list.length - valid.length });
    }
    if (seg[0] === 'students' && seg[1] && method === 'get') {
      const { data, error } = await supabase.from('students').select('*').eq('id', seg[1]).maybeSingle();
      if (error) return fail(400, error.message);
      if (!data) return fail(404, 'Không tìm thấy học viên');
      return ok(data);
    }
    if (seg[0] === 'students' && seg[1] && method === 'put') {
      const { data, error } = await supabase.from('students')
        .update(cleanStudent(body)).eq('id', seg[1]).select('*, classes(name)').single();
      if (error) return fail(400, error.message);
      return ok({ ...data, class_name: data.classes?.name || null });
    }
    if (seg[0] === 'students' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('students').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- attendance (giáo lý) ----------------
    if (path === '/attendance' && method === 'get') {
      if (!q.class_id || !q.date) return fail(400, 'Cần class_id và date');
      const { data: students, error } = await supabase.from('students')
        .select('id, full_name, saint_name').eq('class_id', q.class_id).eq('graduated', false).order('full_name');
      if (error) return fail(400, error.message);
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('attendance').select('student_id, status')
          .eq('date', q.date).in('student_id', ids);
        recs = data || [];
      }
      return ok((students || []).map((s) => ({
        ...s, status: recs.find((r) => r.student_id === s.id)?.status || null,
      })));
    }
    if (path === '/attendance' && method === 'post') {
      const { date, records } = body;
      if (!date || !Array.isArray(records)) return fail(400, 'Cần date và danh sách records');
      const rows = records.map((r) => ({ parish_id: pid, student_id: r.student_id, date, status: r.status }));
      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
      if (error) return fail(400, error.message);
      return ok({ ok: true, count: records.length });
    }

    // ---------------- grades ----------------
    if (path === '/grades' && method === 'get') {
      if (!q.student_id) return fail(400, 'Cần student_id');
      const { data, error } = await supabase.from('grades')
        .select('id, score, date, grade_columns(name)').eq('student_id', q.student_id).order('date', { ascending: false });
      if (error) return fail(400, error.message);
      return ok((data || []).map((g) => ({ id: g.id, title: g.grade_columns?.name || '', score: g.score, date: g.date })));
    }
    if (path === '/grades' && method === 'post') {
      const { student_id, title, score, date } = body;
      if (!student_id || !title || score === undefined || score === null) return fail(400, 'Cần student_id, title và score');
      // tìm/ tạo cột điểm theo tên trong lớp của học viên
      const { data: stu } = await supabase.from('students').select('class_id').eq('id', student_id).maybeSingle();
      const classId = stu?.class_id || null;
      let col;
      const { data: found } = await supabase.from('grade_columns')
        .select('id').eq('name', title).eq('class_id', classId).maybeSingle();
      if (found) col = found;
      else {
        const { data: created, error: ce } = await supabase.from('grade_columns')
          .insert({ parish_id: pid, class_id: classId, name: title }).select('id').single();
        if (ce) return fail(400, ce.message);
        col = created;
      }
      const { error } = await supabase.from('grades').upsert(
        { parish_id: pid, student_id, column_id: col.id, score: Number(score), date: date || new Date().toISOString().slice(0, 10) },
        { onConflict: 'student_id,column_id' }
      );
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }
    if (seg[0] === 'grades' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('grades').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- dashboard ----------------
    if (path === '/dashboard' && method === 'get') {
      const [{ data: students }, { data: classes }, { data: profiles }, { data: grades }] = await Promise.all([
        supabase.from('students').select('id, full_name, saint_name, class_id').eq('graduated', false),
        supabase.from('classes').select('id, name').eq('graduated', false),
        supabase.from('profiles').select('id, role'),
        supabase.from('grades').select('student_id, score'),
      ]);
      const S = students || [], C = classes || [], G = grades || [];
      const counts = {
        students: S.length,
        classes: C.length,
        teachers: (profiles || []).filter((u) => u.role === 'teacher').length,
        avgScore: G.length ? round1(G.reduce((a, g) => a + Number(g.score), 0) / G.length) : 0,
      };
      const studentsPerClass = C.map((c) => ({ name: c.name, count: S.filter((s) => s.class_id === c.id).length }))
        .sort((a, b) => b.count - a.count);
      const byStudent = {};
      G.forEach((g) => { (byStudent[g.student_id] = byStudent[g.student_id] || []).push(Number(g.score)); });
      const topStudents = Object.entries(byStudent).map(([id, arr]) => {
        const s = S.find((x) => x.id === id) || {};
        return { id, saint_name: s.saint_name, full_name: s.full_name, avg: round1(arr.reduce((a, b) => a + b, 0) / arr.length), grade_count: arr.length };
      }).sort((a, b) => b.avg - a.avg).slice(0, 5);
      const classAverages = C.map((c) => {
        const ids = S.filter((s) => s.class_id === c.id).map((s) => s.id);
        const scores = G.filter((g) => ids.includes(g.student_id)).map((g) => Number(g.score));
        return scores.length ? { name: c.name, avg: round1(scores.reduce((a, b) => a + b, 0) / scores.length) } : null;
      }).filter(Boolean).sort((a, b) => b.avg - a.avg);
      return ok({ counts, studentsPerClass, topStudents, classAverages });
    }

    return fail(404, 'Không tìm thấy: ' + method.toUpperCase() + ' ' + path);
  } catch (err) {
    return fail(500, err.message || 'Lỗi hệ thống');
  }
}

const supabaseApi = {
  get: (url) => handle('get', url),
  post: (url, body) => handle('post', url, body),
  put: (url, body) => handle('put', url, body),
  delete: (url) => handle('delete', url),
};

export default supabaseApi;
