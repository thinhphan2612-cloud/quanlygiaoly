// Lớp dữ liệu chạy trên Supabase — mô phỏng interface path-based (get/post/put/delete)
// mà các trang đang dùng, để không phải sửa nhiều ở tầng UI.
// Mỗi giáo xứ là 1 tenant; RLS ở Supabase tự lọc theo parish_id.
import { supabase } from './supabase';
import { byViName } from './lib/viName';

// sắp xếp danh sách học viên theo TÊN (từ cuối họ và tên)
const sortStudents = (arr, f = 'full_name') => (arr || []).slice().sort((a, b) => byViName(a, b, f));

const ok = (data) => Promise.resolve({ data });
const fail = (status, error) => Promise.reject({ response: { status, data: { error } } });
const round1 = (n) => Math.round(n * 10) / 10;
// "2025-2026" -> "2026-2027"; "2025" -> "2026"; không parse được -> null
function bumpYear(y) {
  if (!y) return null;
  const m2 = String(y).match(/(\d{4})\s*-\s*(\d{4})/);
  if (m2) return `${+m2[1] + 1}-${+m2[2] + 1}`;
  const m1 = String(y).match(/(\d{4})/);
  if (m1) return String(+m1[1] + 1);
  return null;
}

function parishId() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').parish_id || null;
  } catch {
    return null;
  }
}
function meId() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').id || null; } catch { return null; }
}
function meRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role || null; } catch { return null; }
}
// J: các lớp mà giáo lý viên đang đăng nhập phụ trách
async function myClassIds() {
  const { data } = await supabase.from('class_teachers').select('class_id').eq('teacher_id', meId());
  return (data || []).map((x) => x.class_id);
}

// '' → null cho các cột uuid/date để tránh lỗi kiểu dữ liệu
const nn = (v) => (v === '' || v === undefined ? null : v);

const STUDENT_FIELDS = [
  'full_name', 'saint_name', 'birth_date', 'gender', 'parent_name', 'parent_phone',
  'student_phone', 'address', 'class_id', 'notes', 'position', 'sacrament', 'avatar_url',
  'father_saint', 'father_name', 'father_phone', 'mother_saint', 'mother_name', 'mother_phone',
  'godparent_name', 'baptism_date', 'first_communion_date', 'confirmation_date', 'certificates',
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
        supabase.from('classes').select('*').eq('graduated', false).order('order_index').order('name'),
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
      let result = (classes || []).map((c) => {
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
      });
      // J: giáo lý viên chỉ thấy lớp mình phụ trách
      if (meRole() === 'teacher') {
        const mid = meId();
        result = result.filter((c) => (c.teacher_ids || []).includes(mid));
      }
      return ok(result);
    }
    if (path === '/classes' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên lớp');
      // Giới hạn gói Khởi động: tối đa 1 lớp
      const { data: par } = await supabase.from('parishes').select('plan').eq('id', pid).maybeSingle();
      if ((par?.plan || 'free') === 'free') {
        const { count } = await supabase.from('classes').select('id', { count: 'exact', head: true }).eq('parish_id', pid);
        if ((count || 0) >= 1) return fail(402, 'Gói Khởi động chỉ quản lý 1 lớp. Nâng lên Pro để thêm lớp không giới hạn.');
      }
      const { data: cls, error } = await supabase
        .from('classes')
        .insert({
          parish_id: pid, name: body.name, school_year: nn(body.year),
          order_index: Number(body.order_index) || 0, room: nn(body.room), schedule: nn(body.schedule),
          promotes: body.promotes !== false, merged: !!body.merged,
        })
        .select().single();
      if (error) return fail(400, error.message);
      await saveClassTeachers(cls.id, body);
      return ok(cls);
    }
    if (seg[0] === 'classes' && seg[1] && method === 'put') {
      const patch = {
        name: body.name, school_year: nn(body.year), order_index: Number(body.order_index) || 0,
        room: nn(body.room), schedule: nn(body.schedule),
      };
      if (body.promotes !== undefined) patch.promotes = body.promotes !== false;
      const { error } = await supabase.from('classes').update(patch).eq('id', seg[1]);
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
    // Sắp xếp thứ tự lớp: ids đi từ TRÊN xuống DƯỚI (lớp lớn nhất -> nhỏ nhất).
    // order_index lớn = lớp cao (ra trường khi lên lớp), nên top nhận order_index lớn nhất.
    if (path === '/classes/reorder' && method === 'post') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const n = ids.length;
      for (let i = 0; i < n; i++) {
        const { error } = await supabase.from('classes')
          .update({ order_index: n - 1 - i }).eq('id', ids[i]).eq('parish_id', pid);
        if (error) return fail(400, error.message);
      }
      return ok({ ok: true });
    }

    // ---------------- hồ sơ của chính mình ----------------
    if (path === '/me' && method === 'put') {
      const patch = {};
      for (const k of ['avatar_url', 'full_name', 'saint_name', 'phone']) if (body[k] !== undefined) patch[k] = body[k];
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', meId()).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }

    // ---------------- profiles (auth/users) ----------------
    if (path === '/auth/users' && method === 'get') {
      const [{ data, error }, { data: cts }] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, role, email, saint_name, birth_date, address, area, glv_level, occupation, phone')
          .order('full_name'),
        supabase.from('class_teachers').select('teacher_id, is_primary, classes(name)'),
      ]);
      if (error) return fail(400, error.message);
      const classesByTeacher = {};
      (cts || []).forEach((ct) => {
        if (ct.classes?.name) (classesByTeacher[ct.teacher_id] = classesByTeacher[ct.teacher_id] || [])
          .push(ct.classes.name + (ct.is_primary ? ' (chính)' : ''));
      });
      return ok((data || []).map((u) => ({ ...u, username: u.email || '', classes: classesByTeacher[u.id] || [] })));
    }
    if (path === '/auth/users' && method === 'post') {
      const { email, password, full_name } = body;
      if (!email || !password) return fail(400, 'Cần email và mật khẩu');
      const { data, error } = await supabase.functions.invoke('create-teacher', { body: { email, password, full_name } });
      if (error) {
        let msg = 'Tạo tài khoản thất bại (đã deploy Edge Function create-teacher chưa?)';
        try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* noop */ }
        return fail(400, msg);
      }
      if (data?.error) return fail(400, data.error);
      return ok(data);
    }
    if (seg[0] === 'auth' && seg[1] === 'users' && seg[2] && method === 'put') {
      const patch = {};
      for (const k of ['full_name', 'saint_name', 'birth_date', 'address', 'area', 'glv_level', 'occupation', 'phone'])
        if (body[k] !== undefined) patch[k] = nn(body[k]);
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', seg[2]).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'auth' && seg[1] === 'users' && seg[2] && method === 'delete') {
      // Xóa profile -> vô hiệu hóa truy cập (tài khoản auth vẫn còn, sẽ dọn sau)
      const { error } = await supabase.from('profiles').delete().eq('id', seg[2]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- hồ sơ học viên (gộp) ----------------
    if (path === '/student-profile' && method === 'get') {
      if (!q.id) return fail(400, 'Cần id');
      const sid = q.id;
      const [{ data: student, error: e1 }, { data: grades }, { data: att }, { data: sp }] = await Promise.all([
        supabase.from('students').select('*, classes(name)').eq('id', sid).maybeSingle(),
        supabase.from('grades').select('score, grade_columns(name, weight, order_index)').eq('student_id', sid),
        supabase.from('attendance').select('date, status, note').eq('student_id', sid).order('date', { ascending: false }),
        supabase.from('spiritual_records').select('done, spiritual_tasks(name)').eq('student_id', sid),
      ]);
      if (e1) return fail(400, e1.message);
      if (!student) return fail(404, 'Không tìm thấy học viên');
      const gRows = (grades || []).map((g) => ({ name: g.grade_columns?.name || '', weight: g.grade_columns?.weight || 1, order_index: g.grade_columns?.order_index || 0, score: Number(g.score) }))
        .sort((a, b) => a.order_index - b.order_index);
      let s = 0, w = 0; gRows.forEach((g) => { s += g.score * g.weight; w += g.weight; });
      const tb = w ? Math.round((s / w) * 10) / 10 : null;
      const A = att || [];
      const present = A.filter((x) => x.status === 'present').length;
      const late = A.filter((x) => x.status === 'late').length;
      const absent = A.filter((x) => x.status === 'absent').length;
      const excused = A.filter((x) => x.status === 'excused').length;
      const counted = present + absent + late; // vắng có phép không tính vào tỷ lệ chuyên cần
      const rate = counted ? Math.round((present / counted) * 100) : null;
      const spMap = {};
      (sp || []).forEach((r) => { const n = r.spiritual_tasks?.name || '—'; const m = spMap[n] || (spMap[n] = { task: n, done: 0, total: 0 }); m.total += 1; if (r.done) m.done += 1; });
      return ok({
        student: { ...student, class_name: student.classes?.name || null },
        grades: gRows, tb,
        attendance: { present, absent, late, excused, total: A.length, rate, recent: A.slice(0, 12) },
        spiritual: Object.values(spMap),
      });
    }

    // ---------------- lịch sử cả lớp (điểm TB từng em qua các năm) ----------------
    if (path === '/class-history' && method === 'get') {
      if (!q.class_id) return fail(400, 'Cần class_id');
      const { data, error } = await supabase.rpc('class_history', { p_class: q.class_id });
      if (error) return fail(400, error.message);
      return ok(data || []);
    }

    // ---------------- lịch sử điểm qua các năm (theo origin_id) ----------------
    if (path === '/student-history' && method === 'get') {
      if (!q.id) return fail(400, 'Cần id');
      const { data: me } = await supabase.from('students').select('id, origin_id').eq('id', q.id).maybeSingle();
      if (!me) return fail(404, 'Không tìm thấy học viên');
      const key = me.origin_id || me.id;
      const { data: recs } = await supabase.from('students')
        .select('id, class_id, classes(name, school_year)')
        .or(`origin_id.eq.${key},id.eq.${key}`);
      const list = recs || [];
      const sids = list.map((r) => r.id);
      const cids = [...new Set(list.map((r) => r.class_id).filter(Boolean))];
      let grades = [], cols = [];
      if (sids.length) { const { data } = await supabase.from('grades').select('student_id, column_id, score').in('student_id', sids); grades = data || []; }
      if (cids.length) { const { data } = await supabase.from('grade_columns').select('id, weight').in('class_id', cids); cols = data || []; }
      const wById = {}; cols.forEach((c) => { wById[c.id] = Number(c.weight) || 1; });
      const out = list.map((r) => {
        const gs = grades.filter((g) => g.student_id === r.id);
        let s = 0, w = 0; gs.forEach((g) => { const wt = wById[g.column_id] || 1; s += Number(g.score) * wt; w += wt; });
        return { student_id: r.id, year: r.classes?.school_year || null, class_name: r.classes?.name || null, avg: w ? Math.round((s / w) * 10) / 10 : null, count: gs.length, current: r.id === me.id };
      }).sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
      return ok(out);
    }

    // ---------------- students ----------------
    if (path === '/students' && method === 'get') {
      let query = supabase.from('students').select('*, classes(name)').order('full_name');
      query = query.eq('graduated', q.graduated === '1');
      if (q.class_id) query = query.eq('class_id', q.class_id);
      // J: giáo lý viên chỉ thấy học viên lớp mình phụ trách
      if (meRole() === 'teacher') {
        const ids = await myClassIds();
        query = query.in('class_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      }
      const { data, error } = await query;
      if (error) return fail(400, error.message);
      return ok(sortStudents((data || []).map((s) => ({ ...s, class_name: s.classes?.name || null }))));
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
    // Chuyển nhiều học viên sang 1 lớp. remember=true: ghi nhớ lớp cũ (để trả về sau — lớp gộp hè).
    if (path === '/students/move' && method === 'post') {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      if (!ids.length) return ok({ moved: 0 });
      const dest = nn(body.class_id);
      if (body.remember) {
        const { data: rows } = await supabase.from('students').select('id, class_id').in('id', ids);
        for (const r of rows || []) {
          const { error } = await supabase.from('students').update({ class_id: dest, prev_class_id: r.class_id }).eq('id', r.id);
          if (error) return fail(400, error.message);
        }
      } else {
        const { error } = await supabase.from('students').update({ class_id: dest }).in('id', ids);
        if (error) return fail(400, error.message);
      }
      return ok({ moved: ids.length });
    }
    // Trả học viên về lớp cũ (lớp gộp hè): class_id <- prev_class_id, xóa prev
    if (path === '/students/return' && method === 'post') {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      if (!ids.length) return ok({ returned: 0 });
      const { data: rows } = await supabase.from('students').select('id, prev_class_id').in('id', ids);
      let n = 0;
      for (const r of rows || []) {
        if (!r.prev_class_id) continue;
        const { error } = await supabase.from('students').update({ class_id: r.prev_class_id, prev_class_id: null }).eq('id', r.id);
        if (error) return fail(400, error.message);
        n++;
      }
      return ok({ returned: n });
    }
    // Ghi bí tích hàng loạt cho cả lớp: đặt trạng thái bí tích + ngày lãnh nhận tương ứng
    if (path === '/students/sacrament' && method === 'post') {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      if (!ids.length) return fail(400, 'Chưa chọn học viên');
      if (body.sacrament !== 'ruoc_le' && body.sacrament !== 'them_suc') return fail(400, 'Bí tích không hợp lệ');
      if (!body.date) return fail(400, 'Thiếu ngày lãnh nhận');
      // chặn ghi lùi bậc (Rước lễ trước, Thêm Sức sau)
      const RANK = { none: 0, ruoc_le: 1, them_suc: 2 };
      const newR = RANK[body.sacrament];
      const { data: cur } = await supabase.from('students').select('id, full_name, sacrament').in('id', ids);
      const bad = (cur || []).filter((s) => (RANK[s.sacrament] || 0) > newR);
      if (bad.length) return fail(400, `Sai thứ tự bí tích cho: ${bad.map((s) => s.full_name).join(', ')}`);
      const patch = { sacrament: body.sacrament };
      if (body.sacrament === 'them_suc') patch.confirmation_date = nn(body.date);
      else patch.first_communion_date = nn(body.date);
      const { error } = await supabase.from('students').update(patch).in('id', ids);
      if (error) return fail(400, error.message);
      return ok({ count: ids.length });
    }
    // Ghi chứng chỉ/khóa hoàn thành hàng loạt: thêm {name, date} vào từng học viên (không trùng tên)
    if (path === '/students/certificate' && method === 'post') {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      const name = (body.name || '').trim();
      if (!ids.length || !name) return fail(400, 'Cần chọn học viên và tên chứng chỉ');
      const { data: rows, error: e1 } = await supabase.from('students').select('id, certificates').in('id', ids);
      if (e1) return fail(400, e1.message);
      for (const r of rows || []) {
        const list = Array.isArray(r.certificates) ? r.certificates : [];
        const next = list.filter((c) => c.name !== name).concat([{ name, date: nn(body.date) }]);
        const { error } = await supabase.from('students').update({ certificates: next }).eq('id', r.id);
        if (error) return fail(400, error.message);
      }
      return ok({ count: (rows || []).length });
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
        .select('id, full_name, saint_name').eq('class_id', q.class_id).order('full_name');
      if (error) return fail(400, error.message);
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('attendance').select('student_id, status, note')
          .eq('date', q.date).in('student_id', ids);
        recs = data || [];
      }
      return ok(sortStudents((students || []).map((s) => {
        const r = recs.find((x) => x.student_id === s.id);
        return { ...s, status: r?.status || null, note: r?.note || '' };
      })));
    }
    if (path === '/attendance' && method === 'post') {
      const { date, records } = body;
      if (!date || !Array.isArray(records)) return fail(400, 'Cần date và danh sách records');
      const rows = records.map((r) => ({ parish_id: pid, student_id: r.student_id, date, status: r.status, note: r.status === 'excused' ? (r.note || null) : null }));
      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
      if (error) return fail(400, error.message);
      return ok({ ok: true, count: records.length });
    }

    // ---------------- attendance theo khoảng (tuần/tháng) ----------------
    if (path === '/attendance-range' && method === 'get') {
      if (!q.class_id || !q.from || !q.to) return fail(400, 'Cần class_id, from, to');
      const { data: students } = await supabase.from('students')
        .select('id, full_name, saint_name').eq('class_id', q.class_id).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('attendance').select('student_id, date, status')
          .gte('date', q.from).lte('date', q.to).in('student_id', ids);
        recs = data || [];
      }
      const dates = [...new Set(recs.map((r) => r.date))].sort();
      const rows = sortStudents(students).map((s) => {
        const byDate = {};
        recs.filter((r) => r.student_id === s.id).forEach((r) => { byDate[r.date] = r.status; });
        const vals = Object.values(byDate);
        return {
          id: s.id, full_name: s.full_name, saint_name: s.saint_name, byDate,
          present: vals.filter((x) => x === 'present').length,
          late: vals.filter((x) => x === 'late').length,
          absent: vals.filter((x) => x === 'absent').length,
          excused: vals.filter((x) => x === 'excused').length,
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
        .select('id, full_name, saint_name').eq('class_id', q.class_id).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('spiritual_records').select('student_id, task_id, done')
          .eq('date', q.date).in('student_id', ids);
        recs = data || [];
      }
      return ok(sortStudents((students || []).map((s) => {
        const done = {};
        recs.filter((r) => r.student_id === s.id).forEach((r) => { done[r.task_id] = r.done; });
        return { id: s.id, full_name: s.full_name, saint_name: s.saint_name, done };
      })));
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
        .select('id, full_name, saint_name').eq('class_id', q.class_id).order('full_name');
      const ids = (students || []).map((s) => s.id);
      let recs = [];
      if (ids.length) {
        const { data } = await supabase.from('spiritual_records').select('student_id, task_id, date, done')
          .gte('date', q.from).lte('date', q.to).in('student_id', ids);
        recs = data || [];
      }
      const dates = [...new Set(recs.map((r) => r.date))].sort();
      const rows = sortStudents(students).map((s) => {
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
        supabase.from('students').select('id, full_name, saint_name, avatar_url').eq('class_id', q.class_id).order('full_name'),
        supabase.from('grade_columns').select('*').eq('class_id', q.class_id).order('order_index').order('created_at'),
        supabase.from('grades').select('student_id, column_id, score')
          .in('column_id', (await supabase.from('grade_columns').select('id').eq('class_id', q.class_id)).data?.map((c) => c.id) || ['00000000-0000-0000-0000-000000000000']),
      ]);
      const scores = {};
      (grades || []).forEach((g) => { (scores[g.student_id] = scores[g.student_id] || {})[g.column_id] = Number(g.score); });
      return ok({ students: sortStudents(students), columns: columns || [], scores });
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

    // ---------------- promote (kết thúc năm học & lên lớp — mô hình COPY) ----------------
    // Nhân bản các lớp promotes=true sang NĂM MỚI, học viên copy lên bậc kế tiếp
    // (điểm reset). Lớp cao nhất -> ra trường. Toàn bộ năm cũ đóng băng (graduated=true)
    // để tra cứu ở tab Lưu trữ.
    if (path === '/promote' && method === 'post') {
      const { data: classes, error } = await supabase.from('classes')
        .select('*').eq('parish_id', pid).eq('graduated', false).order('order_index');
      if (error) return fail(400, error.message);
      const active = classes || [];
      if (!active.length) return fail(400, 'Chưa có lớp nào để lên lớp');

      const curYear = active.map((c) => c.school_year).find(Boolean) || null;
      const nextYear = bumpYear(curYear);
      // Chuỗi lên lớp = lớp bật promotes, theo thứ tự bậc (nhỏ -> lớn)
      const chain = active.filter((c) => c.promotes).sort((a, b) => a.order_index - b.order_index);
      if (!chain.length) return fail(400, 'Không có lớp nào bật "Tự động lên lớp".');

      // 1) Tạo bộ lớp mới cho năm mới: chỉ giữ TÊN + thứ tự lớp.
      //    XÓA sạch giáo lý viên, phòng, lịch học -> tài khoản GLV KHÔNG thấy gì
      //    cho tới khi Cha vào sửa lớp & phân công lại.
      const newIdByOld = {};
      for (const c of chain) {
        const { data: nc, error: ce } = await supabase.from('classes').insert({
          parish_id: pid, name: c.name, school_year: nextYear, order_index: c.order_index,
          room: null, schedule: null, promotes: true, graduated: false,
        }).select('id').single();
        if (ce) return fail(400, ce.message);
        newIdByOld[c.id] = nc.id;
      }

      // 2) Copy học viên lên bậc kế tiếp (chép hồ sơ cá nhân + bí tích + chứng chỉ, KHÔNG chép điểm)
      const copyFields = STUDENT_FIELDS.filter((f) => f !== 'class_id');
      let promoted = 0, graduated = 0;
      for (let i = 0; i < chain.length; i++) {
        const destNewId = chain[i + 1] ? newIdByOld[chain[i + 1].id] : null; // bậc kế tiếp năm mới
        const { data: studs } = await supabase.from('students').select('*').eq('class_id', chain[i].id).eq('graduated', false);
        const list = studs || [];
        if (!destNewId) { graduated += list.length; continue; } // lớp cao nhất -> ra trường
        const copies = list.map((s) => {
          const o = { parish_id: pid, class_id: destNewId, graduated: false, origin_id: s.origin_id || s.id };
          for (const f of copyFields) if (s[f] !== undefined) o[f] = s[f];
          return o;
        });
        if (copies.length) {
          const { error: ie } = await supabase.from('students').insert(copies);
          if (ie) return fail(400, ie.message);
          promoted += copies.length;
        }
      }

      // 3) Đóng băng năm cũ: mọi lớp đang hoạt động (kể cả lớp không lên lớp) + học viên của chúng
      const oldClassIds = active.map((c) => c.id);
      await supabase.from('students').update({ graduated: true }).in('class_id', oldClassIds).eq('graduated', false);
      await supabase.from('classes').update({ graduated: true }).in('id', oldClassIds);

      // 4) Đặt năm học mới là hiện tại
      if (nextYear && nextYear !== curYear) {
        const { data: ex } = await supabase.from('school_years').select('id').eq('parish_id', pid).eq('name', nextYear).maybeSingle();
        let syId = ex?.id;
        if (!syId) { const { data: cr } = await supabase.from('school_years').insert({ parish_id: pid, name: nextYear }).select('id').single(); syId = cr?.id; }
        if (syId) {
          await supabase.from('school_years').update({ is_current: false }).eq('parish_id', pid);
          await supabase.from('school_years').update({ is_current: true }).eq('id', syId);
          const { data: p } = await supabase.from('parishes').select('settings').eq('id', pid).maybeSingle();
          await supabase.from('parishes').update({ settings: { ...(p?.settings || {}), current_school_year: nextYear } }).eq('id', pid);
        }
      }
      return ok({ promoted, graduated, new_year: nextYear });
    }

    // ---------------- lưu trữ (tra cứu năm cũ) ----------------
    if (path === '/archive-years' && method === 'get') {
      const [{ data: cls }, { data: studs }] = await Promise.all([
        supabase.from('classes').select('id, school_year').eq('parish_id', pid).eq('graduated', true),
        supabase.from('students').select('class_id').eq('graduated', true),
      ]);
      const yearByClass = {}; (cls || []).forEach((c) => { yearByClass[c.id] = c.school_year || 'Không rõ năm'; });
      const agg = {};
      (cls || []).forEach((c) => { const y = c.school_year || 'Không rõ năm'; (agg[y] = agg[y] || { classes: 0, students: 0 }).classes++; });
      (studs || []).forEach((s) => { const y = yearByClass[s.class_id]; if (!y) return; (agg[y] = agg[y] || { classes: 0, students: 0 }).students++; });
      return ok(Object.entries(agg).map(([year, v]) => ({ year, classes: v.classes, students: v.students }))
        .sort((a, b) => b.year.localeCompare(a.year)));
    }
    if (path === '/archive-classes' && method === 'get') {
      if (!q.year) return fail(400, 'Cần year');
      const { data: cls } = await supabase.from('classes').select('*')
        .eq('parish_id', pid).eq('graduated', true).eq('school_year', q.year).order('order_index', { ascending: false });
      const ids = (cls || []).map((c) => c.id);
      const counts = {};
      if (ids.length) {
        const { data: studs } = await supabase.from('students').select('class_id').eq('graduated', true).in('class_id', ids);
        (studs || []).forEach((s) => { counts[s.class_id] = (counts[s.class_id] || 0) + 1; });
      }
      return ok((cls || []).map((c) => ({ ...c, year: c.school_year, student_count: counts[c.id] || 0 })));
    }
    if (path === '/archive-class' && method === 'get') {
      if (!q.class_id) return fail(400, 'Cần class_id');
      const [{ data: cls }, { data: students }, { data: columns }] = await Promise.all([
        supabase.from('classes').select('*').eq('id', q.class_id).maybeSingle(),
        supabase.from('students').select('*, classes(name)').eq('class_id', q.class_id).order('full_name'),
        supabase.from('grade_columns').select('*').eq('class_id', q.class_id).order('order_index').order('created_at'),
      ]);
      const colIds = (columns || []).map((c) => c.id);
      let grades = [];
      if (colIds.length) { const { data } = await supabase.from('grades').select('student_id, column_id, score').in('column_id', colIds); grades = data || []; }
      const scores = {};
      grades.forEach((g) => { (scores[g.student_id] = scores[g.student_id] || {})[g.column_id] = Number(g.score); });
      return ok({
        class: cls ? { ...cls, year: cls.school_year } : null,
        students: sortStudents((students || []).map((s) => ({ ...s, class_name: s.classes?.name || null }))),
        columns: columns || [], scores,
      });
    }
    // ---------------- entitlement (kho tính năng) ----------------
    if (path === '/features' && method === 'get') {
      const { data, error } = await supabase.from('features').select('*').eq('active', true).order('order_index');
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/entitlements' && method === 'get') {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase.from('parish_features')
        .select('feature_key, status, source, expires_at').eq('status', 'active');
      if (error) return fail(400, error.message);
      const keys = (data || []).filter((r) => !r.expires_at || r.expires_at > nowIso).map((r) => r.feature_key);
      return ok({ keys, rows: data || [] });
    }

    // ---------------- game học ----------------
    if (path === '/games' && method === 'get') {
      const { data, error } = await supabase.from('games').select('*').order('order_index').order('created_at');
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/games' && method === 'post') {
      if (!body.name) return fail(400, 'Thiếu tên game');
      const { data, error } = await supabase.from('games').insert({
        parish_id: pid, name: body.name, description: nn(body.description), url: nn(body.url),
        emoji: body.emoji || '🎮', color: body.color || '#3b82f6',
        min_plan: ['free', 'standard', 'pro'].includes(body.min_plan) ? body.min_plan : 'standard',
        order_index: Number(body.order_index) || 0,
      }).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'games' && seg[1] && method === 'put') {
      const patch = {};
      for (const k of ['name', 'description', 'url', 'emoji', 'color', 'min_plan', 'order_index']) if (body[k] !== undefined) patch[k] = body[k];
      const { data, error } = await supabase.from('games').update(patch).eq('id', seg[1]).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'games' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('games').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- thông báo ----------------
    if (path === '/notifications' && method === 'get') {
      const { data, error } = await supabase.from('notifications')
        .select('*').eq('recipient_id', meId()).order('created_at', { ascending: false }).limit(50);
      if (error) return fail(400, error.message);
      return ok(data || []);
    }
    if (path === '/notifications/read' && method === 'post') {
      let query = supabase.from('notifications').update({ read: true }).eq('recipient_id', meId());
      if (body.id) query = query.eq('id', body.id); else query = query.eq('read', false);
      const { error } = await query;
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }
    // admin gửi thông báo đến các GLV
    if (path === '/notifications' && method === 'post') {
      const { recipient_ids, title, content } = body;
      if (!Array.isArray(recipient_ids) || !recipient_ids.length) return fail(400, 'Chọn ít nhất 1 người nhận');
      if (!content) return fail(400, 'Nhập nội dung thông báo');
      const rows = recipient_ids.map((rid) => ({
        parish_id: pid, recipient_id: rid, sender_id: meId(), type: 'admin', title: title || 'Thông báo', content,
      }));
      const { error } = await supabase.from('notifications').insert(rows);
      if (error) return fail(400, error.message);
      return ok({ ok: true, count: rows.length });
    }
    // admin xem lịch sử đã gửi
    if (path === '/notifications/sent' && method === 'get') {
      const { data, error } = await supabase.from('notifications')
        .select('id, title, content, created_at, read, profiles!notifications_recipient_id_fkey(full_name)')
        .eq('type', 'admin').order('created_at', { ascending: false }).limit(100);
      if (error) return fail(400, error.message);
      return ok((data || []).map((n) => ({ ...n, recipient_name: n.profiles?.full_name || '' })));
    }

    // ---------------- kiểm toán thu chi ----------------
    if (path === '/transactions' && method === 'get') {
      let query = supabase.from('transactions').select('*, classes(name)').order('date', { ascending: false }).order('created_at', { ascending: false });
      if (q.class_id) query = query.eq('class_id', q.class_id);
      const { data, error } = await query;
      if (error) return fail(400, error.message);
      return ok((data || []).map((t) => ({ ...t, class_name: t.classes?.name || null })));
    }
    if (path === '/transactions' && method === 'post') {
      if (!body.content || body.amount === undefined || body.amount === '') return fail(400, 'Cần nội dung và số tiền');
      const { data, error } = await supabase.from('transactions').insert({
        parish_id: pid, class_id: nn(body.class_id), content: body.content,
        type: body.type === 'chi' ? 'chi' : 'thu', amount: Number(body.amount) || 0,
        date: body.date || new Date().toISOString().slice(0, 10), note: nn(body.note),
      }).select().single();
      if (error) return fail(400, error.message);
      return ok(data);
    }
    if (seg[0] === 'transactions' && seg[1] && method === 'delete') {
      const { error } = await supabase.from('transactions').delete().eq('id', seg[1]);
      if (error) return fail(400, error.message);
      return ok({ ok: true });
    }

    // ---------------- dashboard ----------------
    if (path === '/dashboard' && method === 'get') {
      // xem lại năm cũ qua ?year= (RLS lọc: GLV chỉ thấy lớp mình từng phụ trách)
      const wantYear = q.year || null;
      let students, classes;
      if (wantYear) {
        const { data: yc } = await supabase.from('classes').select('id, name').eq('parish_id', pid).eq('school_year', wantYear).order('order_index');
        classes = yc || [];
        const cids = classes.map((c) => c.id);
        const { data: ys } = await supabase.from('students')
          .select('id, full_name, saint_name, class_id, avatar_url')
          .in('class_id', cids.length ? cids : ['00000000-0000-0000-0000-000000000000']);
        students = ys || [];
      } else {
        const [{ data: c1 }, { data: s1 }] = await Promise.all([
          supabase.from('classes').select('id, name').eq('graduated', false),
          supabase.from('students').select('id, full_name, saint_name, class_id, avatar_url').eq('graduated', false),
        ]);
        classes = c1 || []; students = s1 || [];
      }
      let [{ data: profiles }, { data: grades }, { data: attend }] = await Promise.all([
        supabase.from('profiles').select('id, role'),
        supabase.from('grades').select('student_id, score'),
        supabase.from('attendance').select('student_id, date, status'),
      ]);
      // J: giáo lý viên chỉ xem số liệu lớp mình phụ trách
      let teacherCount = (profiles || []).filter((u) => u.role === 'teacher').length;
      if (meRole() === 'teacher') {
        const myIds = await myClassIds();
        classes = (classes || []).filter((c) => myIds.includes(c.id));
        students = (students || []).filter((s) => myIds.includes(s.class_id));
        const sIds = new Set(students.map((s) => s.id));
        grades = (grades || []).filter((g) => sIds.has(g.student_id));
        attend = (attend || []).filter((a) => sIds.has(a.student_id));
        const { data: cts } = await supabase.from('class_teachers').select('teacher_id').in('class_id', myIds.length ? myIds : ['00000000-0000-0000-0000-000000000000']);
        teacherCount = new Set((cts || []).map((c) => c.teacher_id)).size;
      }
      // Chỉ tính điểm/điểm danh của học viên đang hoạt động (bỏ dữ liệu năm đã lưu trữ)
      const activeIds = new Set((students || []).map((s) => s.id));
      grades = (grades || []).filter((g) => activeIds.has(g.student_id));
      attend = (attend || []).filter((a) => activeIds.has(a.student_id));
      // Điểm danh theo tuần (CN đầu tuần) — tỷ lệ có mặt
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
        teachers: teacherCount,
        avgScore: G.length ? round1(G.reduce((a, g) => a + Number(g.score), 0) / G.length) : 0,
      };
      const studentsPerClass = C.map((c) => ({ name: c.name, count: S.filter((s) => s.class_id === c.id).length }))
        .sort((a, b) => b.count - a.count);
      // Tỷ lệ chuyên cần theo học viên
      const attByStu = {};
      (attend || []).forEach((a) => { const x = attByStu[a.student_id] || (attByStu[a.student_id] = { present: 0, counted: 0 }); if (a.status !== 'excused') x.counted += 1; if (a.status === 'present') x.present += 1; });
      const rateOf = (id) => { const x = attByStu[id]; return x && x.counted ? Math.round((x.present / x.counted) * 100) : null; };
      const classNameOf = (cid) => C.find((c) => c.id === cid)?.name || null;

      const byStudent = {};
      G.forEach((g) => { (byStudent[g.student_id] = byStudent[g.student_id] || []).push(Number(g.score)); });
      const topStudents = Object.entries(byStudent).map(([id, arr]) => {
        const s = S.find((x) => x.id === id) || {};
        return { id, class_id: s.class_id, class_name: classNameOf(s.class_id), saint_name: s.saint_name, full_name: s.full_name, avatar_url: s.avatar_url, avg: round1(arr.reduce((a, b) => a + b, 0) / arr.length), grade_count: arr.length, rate: rateOf(id) };
      }).sort((a, b) => b.avg - a.avg).slice(0, 5);

      const classAverages = C.map((c) => {
        const ids = S.filter((s) => s.class_id === c.id).map((s) => s.id);
        const scores = G.filter((g) => ids.includes(g.student_id)).map((g) => Number(g.score));
        let p = 0, t = 0; ids.forEach((id) => { const x = attByStu[id]; if (x) { p += x.present; t += x.counted; } });
        return { id: c.id, name: c.name, count: ids.length, avg: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null, rate: t ? Math.round((p / t) * 100) : null };
      }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
      // danh sách năm học (để lọc) + năm hiện tại
      const { data: allCls } = await supabase.from('classes').select('school_year, graduated').eq('parish_id', pid);
      const years = [...new Set((allCls || []).map((c) => c.school_year).filter(Boolean))].sort().reverse();
      const currentYear = (allCls || []).filter((c) => !c.graduated).map((c) => c.school_year).find(Boolean) || null;
      return ok({ counts, studentsPerClass, topStudents, classAverages, attendanceByWeek, years, currentYear, year: wantYear || currentYear });
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
