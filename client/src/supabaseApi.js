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

// Ghi danh sách giáo lý viên của lớp (chính + phụ). Chấp nhận body.teachers
// = [{teacher_id, is_primary}] hoặc fallback body.teacher_id (1 GV).
async function saveClassTeachers(classId, body) {
  let list = Array.isArray(body.teachers) ? body.teachers.filter((t) => t.teacher_id) : [];
  if (!list.length && body.teacher_id) list = [{ teacher_id: body.teacher_id, is_primary: true }];
  if (!list.length) return;
  if (!list.some((t) => t.is_primary)) list[0].is_primary = true; // đảm bảo có 1 GV chính
  const rows = list.map((t) => ({ class_id: classId, teacher_id: t.teacher_id, is_primary: !!t.is_primary }));
  await supabase.from('class_teachers').insert(rows);
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
      const teachersByClass = {};
      (cts || []).forEach((ct) => {
        (teachersByClass[ct.class_id] = teachersByClass[ct.class_id] || []).push({
          id: ct.teacher_id, name: ct.profiles?.full_name || null, is_primary: ct.is_primary,
        });
      });
      return ok((classes || []).map((c) => {
        const ts = (teachersByClass[c.id] || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        const primary = ts.find((t) => t.is_primary) || ts[0];
        return {
          ...c,
          year: c.school_year,
          teachers: ts,
          teacher_ids: ts.map((t) => t.id),
          primary_teacher_id: primary?.id || null,
          teacher_id: primary?.id || null, // tương thích cũ
          teacher_name: ts.length
            ? ts.map((t) => t.name + (t.is_primary ? ' (chính)' : '')).join(', ')
            : null,
          student_count: countByClass[c.id] || 0,
        };
      }));
    }
    if (path === '/classes' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên lớp');
      const { data: cls, error } = await supabase
        .from('classes')
        .insert({
          parish_id: pid, name: body.name, school_year: nn(body.year),
          order_index: Number(body.order_index) || 0, room: nn(body.room), schedule: nn(body.schedule),
        })
        .select().single();
      if (error) return fail(400, error.message);
      await saveClassTeachers(cls.id, body);
      return ok(cls);
    }
    if (seg[0] === 'classes' && seg[1] && method === 'put') {
      const { error } = await supabase.from('classes')
        .update({
          name: body.name, school_year: nn(body.year), order_index: Number(body.order_index) || 0,
          room: nn(body.room), schedule: nn(body.schedule),
        })
        .eq('id', seg[1]);
      if (error) return fail(400, error.message);
      await supabase.from('class_teachers').delete().eq('class_id', seg[1]);
      await saveClassTeachers(seg[1], body);
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
      let query = supabase.from('students').select('*, classes(name)').order('full_name');
      query = query.eq('graduated', q.graduated === '1');
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

    // ---------------- student-stats (cho bộ lọc) ----------------
    if (path === '/student-stats' && method === 'get') {
      const [{ data: students }, { data: grades }, { data: att }, { data: cols }] = await Promise.all([
        supabase.from('students').select('id, class_id').eq('graduated', false),
        supabase.from('grades').select('student_id, score'),
        supabase.from('attendance').select('student_id, status'),
        supabase.from('grade_columns').select('id, class_id'),
      ]);
      const colCountByClass = {};
      (cols || []).forEach((c) => { colCountByClass[c.class_id] = (colCountByClass[c.class_id] || 0) + 1; });
      const gByStu = {}, aByStu = {};
      (grades || []).forEach((g) => { (gByStu[g.student_id] = gByStu[g.student_id] || []).push(Number(g.score)); });
      (att || []).forEach((a) => { (aByStu[a.student_id] = aByStu[a.student_id] || []).push(a.status); });
      const stats = {};
      (students || []).forEach((s) => {
        const gs = gByStu[s.id] || [];
        const as = aByStu[s.id] || [];
        const colCount = colCountByClass[s.class_id] || 0;
        stats[s.id] = {
          avg: gs.length ? round1(gs.reduce((a, b) => a + b, 0) / gs.length) : null,
          grade_count: gs.length,
          columns: colCount,
          missing: Math.max(colCount - gs.length, 0),
          present: as.filter((x) => x === 'present').length,
          late: as.filter((x) => x === 'late').length,
          absent: as.filter((x) => x === 'absent').length,
        };
      });
      return ok(stats);
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

    // ---------------- attendance theo khoảng (tuần/tháng) ----------------
    if (path === '/attendance-range' && method === 'get') {
      if (!q.class_id || !q.from || !q.to) return fail(400, 'Cần class_id, from, to');
      const { data: students } = await supabase.from('students')
        .select('id, full_name, saint_name').eq('class_id', q.class_id).eq('graduated', false).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('attendance').select('student_id, date, status')
          .gte('date', q.from).lte('date', q.to).in('student_id', ids);
        recs = data || [];
      }
      const dates = [...new Set(recs.map((r) => r.date))].sort();
      const rows = (students || []).map((s) => {
        const byDate = {};
        recs.filter((r) => r.student_id === s.id).forEach((r) => { byDate[r.date] = r.status; });
        const vals = Object.values(byDate);
        return {
          id: s.id, full_name: s.full_name, saint_name: s.saint_name, byDate,
          present: vals.filter((x) => x === 'present').length,
          late: vals.filter((x) => x === 'late').length,
          absent: vals.filter((x) => x === 'absent').length,
        };
      });
      return ok({ dates, students: rows });
    }

    // ---------------- việc thiêng liêng: danh mục ----------------
    if (path === '/spiritual-tasks' && method === 'get') {
      const { data, error } = await supabase.from('spiritual_tasks').select('*').order('order_index').order('name');
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/spiritual-tasks' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên việc thiêng liêng');
      const { data, error } = await supabase.from('spiritual_tasks')
        .insert({ parish_id: pid, name: body.name, order_index: Number(body.order_index) || 0 }).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'spiritual-tasks' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('spiritual_tasks').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- việc thiêng liêng: điểm danh theo ngày ----------------
    if (path === '/spiritual' && method === 'get') {
      if (!q.class_id || !q.date) return fail(400, 'Cần class_id và date');
      const { data: students } = await supabase.from('students')
        .select('id, full_name, saint_name').eq('class_id', q.class_id).eq('graduated', false).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('spiritual_records').select('student_id, task_id, done')
          .eq('date', q.date).in('student_id', ids);
        recs = data || [];
      }
      return ok((students || []).map((s) => {
        const done = {};
        recs.filter((r) => r.student_id === s.id).forEach((r) => { done[r.task_id] = r.done; });
        return { id: s.id, full_name: s.full_name, saint_name: s.saint_name, done };
      }));
    }
    if (path === '/spiritual' && method === 'post') {
      const { date, records } = body;
      if (!date || !Array.isArray(records)) return fail(400, 'Cần date và records');
      const rows = records.map((r) => ({ parish_id: pid, student_id: r.student_id, task_id: r.task_id, date, done: !!r.done }));
      if (rows.length) {
        const { error } = await supabase.from('spiritual_records').upsert(rows, { onConflict: 'student_id,task_id,date' });
        if (error) return fail(400, error.message);
      }
      return ok({ ok: true });
    }
    // việc thiêng liêng theo khoảng: đếm số lần hoàn thành mỗi việc
    if (path === '/spiritual-range' && method === 'get') {
      if (!q.class_id || !q.from || !q.to) return fail(400, 'Cần class_id, from, to');
      const { data: students } = await supabase.from('students')
        .select('id, full_name, saint_name').eq('class_id', q.class_id).eq('graduated', false).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('spiritual_records').select('student_id, task_id, date, done')
          .gte('date', q.from).lte('date', q.to).in('student_id', ids);
        recs = data || [];
      }
      const dates = [...new Set(recs.map((r) => r.date))].sort();
      const rows = (students || []).map((s) => {
        const counts = {};
        recs.filter((r) => r.student_id === s.id && r.done).forEach((r) => { counts[r.task_id] = (counts[r.task_id] || 0) + 1; });
        return { id: s.id, full_name: s.full_name, saint_name: s.saint_name, counts };
      });
      return ok({ dates, students: rows });
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

    // ---------------- grade columns (cột điểm + hệ số) ----------------
    if (path === '/grade-columns' && method === 'get') {
      if (!q.class_id) return fail(400, 'Cần class_id');
      const { data, error } = await supabase.from('grade_columns').select('*')
        .eq('class_id', q.class_id).order('order_index').order('created_at');
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/grade-columns' && method === 'post') {
      if (!body.name || !body.class_id) return fail(400, 'Cần tên cột và class_id');
      const { data, error } = await supabase.from('grade_columns')
        .insert({ parish_id: pid, class_id: body.class_id, name: body.name, weight: Number(body.weight) || 1, order_index: Number(body.order_index) || 0 })
        .select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'grade-columns' && seg[1] && method === 'put') {
      const patch = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.weight !== undefined) patch.weight = Number(body.weight) || 1;
      if (body.order_index !== undefined) patch.order_index = Number(body.order_index) || 0;
      const { data, error } = await supabase.from('grade_columns').update(patch).eq('id', seg[1]).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'grade-columns' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('grade_columns').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- bảng điểm cả lớp ----------------
    if (path === '/grades-class' && method === 'get') {
      if (!q.class_id) return fail(400, 'Cần class_id');
      const [{ data: students }, { data: columns }, { data: grades }] = await Promise.all([
        supabase.from('students').select('id, full_name, saint_name').eq('class_id', q.class_id).eq('graduated', false).order('full_name'),
        supabase.from('grade_columns').select('*').eq('class_id', q.class_id).order('order_index').order('created_at'),
        supabase.from('grades').select('student_id, column_id, score')
          .in('column_id', (await supabase.from('grade_columns').select('id').eq('class_id', q.class_id)).data?.map((c) => c.id) || ['00000000-0000-0000-0000-000000000000']),
      ]);
      const scores = {};
      (grades || []).forEach((g) => { (scores[g.student_id] = scores[g.student_id] || {})[g.column_id] = Number(g.score); });
      return ok({ students: students || [], columns: columns || [], scores });
    }
    // đặt/sửa/xóa 1 ô điểm
    if (path === '/grade-cell' && method === 'post') {
      const { student_id, column_id, score } = body;
      if (!student_id || !column_id) return fail(400, 'Cần student_id và column_id');
      if (score === '' || score === null || score === undefined) {
        await supabase.from('grades').delete().eq('student_id', student_id).eq('column_id', column_id);
        return ok({ ok: true, cleared: true });
      }
      const { error } = await supabase.from('grades').upsert(
        { parish_id: pid, student_id, column_id, score: Number(score) }, { onConflict: 'student_id,column_id' }
      );
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- parish (giáo xứ + cài đặt) ----------------
    if (path === '/parish' && method === 'get') {
      const { data, error } = await supabase.from('parishes').select('*').eq('id', pid).maybeSingle();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (path === '/parish' && method === 'put') {
      const patch = {};
      for (const k of ['name', 'diocese', 'logo_url', 'settings', 'plan']) if (body[k] !== undefined) patch[k] = body[k];
      const { data, error } = await supabase.from('parishes').update(patch).eq('id', pid).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }

    // ---------------- school_years (năm học) ----------------
    if (path === '/school-years' && method === 'get') {
      const { data, error } = await supabase.from('school_years').select('*').order('name', { ascending: false });
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/school-years' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên năm học');
      const { data, error } = await supabase.from('school_years')
        .insert({ parish_id: pid, name: body.name }).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'school-years' && seg[1] && seg[2] === 'current' && method === 'post') {
      await supabase.from('school_years').update({ is_current: false }).eq('parish_id', pid);
      const { data, error } = await supabase.from('school_years')
        .update({ is_current: true }).eq('id', seg[1]).select().single();
      if (error) return fail(400, error.message);
      // lưu tên năm hiện tại vào settings để tiện dùng
      const { data: p } = await supabase.from('parishes').select('settings').eq('id', pid).maybeSingle();
      await supabase.from('parishes').update({ settings: { ...(p?.settings || {}), current_school_year: data.name } }).eq('id', pid);
      return ok(data);
    }
    if (seg[0] === 'school-years' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('school_years').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- promote (lên lớp cuối năm) ----------------
    if (path === '/promote' && method === 'post') {
      const { data: classes, error } = await supabase.from('classes')
        .select('id, order_index').eq('graduated', false).order('order_index');
      if (error) return fail(400, error.message);
      if (!classes || classes.length === 0) return fail(400, 'Chưa có lớp nào để lên lớp');
      // lớp kế tiếp theo order_index
      const sorted = [...classes].sort((a, b) => a.order_index - b.order_index);
      const nextOf = {};
      sorted.forEach((c, i) => { nextOf[c.id] = sorted[i + 1]?.id || null; });
      const highestIds = sorted.filter((c) => !nextOf[c.id]).map((c) => c.id);

      let graduated = 0, promoted = 0;
      // 1) Lớp cao nhất -> ra trường (làm trước để không bị nhảy dồn)
      if (highestIds.length) {
        const { data: g } = await supabase.from('students').update({ graduated: true })
          .in('class_id', highestIds).eq('graduated', false).select('id');
        graduated = g?.length || 0;
      }
      // 2) Chuyển từ lớp cao -> thấp để tránh cascade
      const withNext = sorted.filter((c) => nextOf[c.id]).reverse();
      for (const c of withNext) {
        const { data: mv } = await supabase.from('students').update({ class_id: nextOf[c.id] })
          .eq('class_id', c.id).eq('graduated', false).select('id');
        promoted += mv?.length || 0;
      }
      return ok({ promoted, graduated });
    }

    // ---------------- dashboard ----------------
    if (path === '/dashboard' && method === 'get') {
      const [{ data: students }, { data: classes }, { data: profiles }, { data: grades }, { data: attend }] = await Promise.all([
        supabase.from('students').select('id, full_name, saint_name, class_id').eq('graduated', false),
        supabase.from('classes').select('id, name').eq('graduated', false),
        supabase.from('profiles').select('id, role'),
        supabase.from('grades').select('student_id, score'),
        supabase.from('attendance').select('date, status'),
      ]);
      // Điểm danh theo tuần (CN đầu tuần) — tỷ lệ có mặt của tổng tất cả học viên
      const weekMap = {};
      (attend || []).forEach((a) => {
        const d = new Date(a.date + 'T00:00:00');
        const sun = new Date(d); sun.setDate(d.getDate() - d.getDay());
        const key = sun.toISOString().slice(0, 10);
        const w = weekMap[key] || (weekMap[key] = { present: 0, total: 0 });
        w.total += 1; if (a.status === 'present') w.present += 1;
      });
      const attendanceByWeek = Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8)
        .map(([wk, v]) => ({ label: wk.slice(8, 10) + '/' + wk.slice(5, 7), rate: v.total ? Math.round((v.present / v.total) * 100) : 0, present: v.present, total: v.total }));
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
      return ok({ counts, studentsPerClass, topStudents, classAverages, attendanceByWeek });
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
