// Nạp dữ liệu mẫu ĐẦY ĐỦ cho 1 giáo xứ test (chỉ tài khoản đã khóa cứng dưới đây).
// Xóa data cũ (giữ profiles/giáo viên), seed niên khóa 2025-2026 hoàn chỉnh rồi lên lớp
// sang 2026-2027 (sẵn sàng khai giảng). Bảo vệ bằng header x-seed-secret == SEED_SECRET.
// Deploy: npx supabase functions deploy seed-demo --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TARGET_EMAIL = 'giaoxu.test2@gmail.com'; // chỉ seed đúng giáo xứ này
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const FAMILY = ['Nguyễn Văn', 'Trần Thị', 'Lê Văn', 'Phạm Thị', 'Hoàng Văn', 'Phan Thị', 'Vũ Văn', 'Đặng Thị', 'Bùi Văn', 'Đỗ Thị', 'Hồ Văn', 'Ngô Thị', 'Dương Văn', 'Lý Thị', 'Trương Văn', 'Đinh Thị'];
const GIVEN = ['An', 'Bình', 'Cường', 'Dung', 'Phúc', 'Giang', 'Hà', 'Khoa', 'Linh', 'Minh', 'Ngọc', 'Oanh', 'Phong', 'Quân', 'Sang', 'Trang', 'Uyên', 'Vinh', 'Yến', 'Bảo', 'Chi', 'Duy', 'Hân', 'Khang'];
const SAINT_M = ['Giuse', 'Phêrô', 'Phaolô', 'Gioan', 'Antôn', 'Đaminh', 'Vinh Sơn', 'Martinô', 'Tôma', 'Anrê'];
const SAINT_F = ['Maria', 'Anna', 'Têrêsa', 'Cêcilia', 'Lucia', 'Agata', 'Rosa', 'Catarina', 'Madalena', 'Isave'];

// Các Chúa Nhật của niên khóa 2025-2026 (một mẫu ~18 buổi)
function sundays(startIso: string, n: number): string[] {
  const out: string[] = []; const d = new Date(startIso + 'T00:00:00Z');
  for (let i = 0; i < n; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
  return out;
}
const rnd = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if ((req.headers.get('x-seed-secret') || '') !== (Deno.env.get('SEED_SECRET') || '\0')) return json({ error: 'forbidden' }, 403);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Tìm giáo xứ theo email admin
  let uid = '';
  for (let page = 1; page <= 20 && !uid; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = (data?.users || []).find((x) => (x.email || '').toLowerCase() === TARGET_EMAIL);
    if (u) uid = u.id;
    if (!data?.users?.length) break;
  }
  if (!uid) return json({ error: 'không tìm thấy tài khoản ' + TARGET_EMAIL }, 404);
  const { data: prof } = await admin.from('profiles').select('parish_id').eq('id', uid).maybeSingle();
  const pid = prof?.parish_id;
  if (!pid) return json({ error: 'tài khoản chưa có giáo xứ' }, 404);

  // 2) Giáo viên hiện có (giữ nguyên)
  const { data: teachers } = await admin.from('profiles').select('id').eq('parish_id', pid).eq('role', 'teacher');
  const teacherIds = (teachers || []).map((t) => t.id);

  // 3) Xóa data cũ (giữ profiles/giáo viên). Xóa theo thứ tự phụ thuộc.
  const delBy = async (table: string) => { await admin.from(table).delete().eq('parish_id', pid); };
  await delBy('transactions');
  await delBy('class_reviews');
  await delBy('grades');
  await delBy('grade_columns');
  await delBy('spiritual_records');
  await delBy('spiritual_tasks');
  await delBy('attendance');
  await delBy('students');        // cascade attendance/grades/spiritual_records của các em còn sót
  await delBy('classes');         // cascade class_teachers
  await delBy('school_years');

  const Y1 = '2025-2026', Y2 = '2026-2027';
  const CLASSES = ['Khai Tâm', 'Rước Lễ 1', 'Rước Lễ 2', 'Thêm Sức 1', 'Thêm Sức 2', 'Bao Đồng'];
  const N_PER = 10;

  // 4) Năm học
  await admin.from('school_years').insert([
    { parish_id: pid, name: Y1, is_current: false },
    { parish_id: pid, name: Y2, is_current: true },
  ]);

  // 5) Lớp 2025-2026 (đã đóng băng: graduated=true)
  const cls1: { id: string; name: string; order: number; grad: boolean }[] = [];
  for (let i = 0; i < CLASSES.length; i++) {
    const isGrad = i === CLASSES.length - 1;
    const { data: c } = await admin.from('classes').insert({
      parish_id: pid, name: CLASSES[i], school_year: Y1, order_index: i + 1,
      room: 'P' + (101 + i), schedule: 'Chúa Nhật', kind: 'catechism', is_graduation: isGrad, promotes: true, graduated: true,
    }).select('id').single();
    cls1.push({ id: c!.id, name: CLASSES[i], order: i + 1, grad: isGrad });
  }

  // Gán giáo viên (chia lượt) cho lớp 2025-2026
  if (teacherIds.length) {
    const ct = cls1.map((c, i) => ({ class_id: c.id, teacher_id: teacherIds[i % teacherIds.length], is_primary: true }));
    await admin.from('class_teachers').insert(ct);
  }

  // 6) Việc thiêng liêng
  const { data: tasksIns } = await admin.from('spiritual_tasks').insert([
    { parish_id: pid, name: 'Đi lễ Chúa Nhật', order_index: 0 },
    { parish_id: pid, name: 'Đọc kinh tối', order_index: 1 },
    { parish_id: pid, name: 'Xưng tội trong tháng', order_index: 2 },
  ]).select('id');
  const taskIds = (tasksIns || []).map((t) => t.id);

  const dates = sundays('2025-09-07', 18);
  const spDates = dates.filter((_, i) => i % 2 === 0); // ~9 buổi ghi việc thiêng liêng

  // 7) Học viên + điểm danh + điểm + việc thiêng liêng cho từng lớp (2025-2026)
  const gradeCols: Record<string, string[]> = {};
  const studentsByClass: Record<string, { id: string }[]> = {};
  let sSeed = 1;
  for (const c of cls1) {
    // cột điểm
    const { data: gc } = await admin.from('grade_columns').insert([
      { parish_id: pid, class_id: c.id, name: "Kiểm tra 15'", weight: 1, order_index: 0 },
      { parish_id: pid, class_id: c.id, name: 'Giữa kỳ', weight: 2, order_index: 1 },
      { parish_id: pid, class_id: c.id, name: 'Cuối kỳ', weight: 3, order_index: 2 },
    ]).select('id');
    gradeCols[c.id] = (gc || []).map((x) => x.id);

    // học viên
    const studentRows = [];
    for (let i = 0; i < N_PER; i++) {
      const male = (sSeed + i) % 2 === 0;
      const fam = FAMILY[(sSeed + i) % FAMILY.length];
      const giv = GIVEN[(sSeed * 3 + i) % GIVEN.length];
      const saint = male ? SAINT_M[(sSeed + i) % SAINT_M.length] : SAINT_F[(sSeed + i) % SAINT_F.length];
      const yob = 2010 + (i % 6); // 2010..2015
      studentRows.push({
        parish_id: pid, class_id: c.id, graduated: true, origin_id: null,
        saint_name: saint, full_name: fam + ' ' + giv,
        birth_date: `${yob}-0${1 + (i % 9)}-1${i % 9}`,
        gender: male ? 'Nam' : 'Nữ',
        father_saint: 'Giuse', father_name: 'Nguyễn Văn ' + GIVEN[i % GIVEN.length], father_phone: '09' + (10000000 + sSeed * 137 + i),
        mother_saint: 'Maria', mother_name: 'Trần Thị ' + GIVEN[(i + 3) % GIVEN.length],
        address: `${100 + i} Đường ${c.order}, Khu ${1 + (i % 3)}`,
        sacrament: c.order <= 2 ? 'none' : c.order <= 3 ? 'ruoc_le' : 'them_suc',
      });
    }
    const { data: sIns } = await admin.from('students').insert(studentRows).select('id');
    const sids = (sIns || []).map((x) => x.id);
    studentsByClass[c.id] = sids.map((id) => ({ id }));

    // điểm danh
    const att = [];
    for (let si = 0; si < sids.length; si++) {
      for (let di = 0; di < dates.length; di++) {
        const r = rnd(sSeed * 100 + si * 7 + di * 3);
        const status = r < 0.82 ? 'present' : r < 0.9 ? 'late' : r < 0.96 ? 'absent' : 'excused';
        att.push({ parish_id: pid, student_id: sids[si], date: dates[di], status });
      }
    }
    // chèn theo lô
    for (let k = 0; k < att.length; k += 500) await admin.from('attendance').insert(att.slice(k, k + 500));

    // điểm
    const grd = [];
    for (let si = 0; si < sids.length; si++) {
      for (let ci = 0; ci < gradeCols[c.id].length; ci++) {
        const score = Math.round((5 + rnd(sSeed * 50 + si * 5 + ci) * 5) * 10) / 10; // 5.0..10.0
        grd.push({ parish_id: pid, student_id: sids[si], column_id: gradeCols[c.id][ci], score, date: '2026-05-10' });
      }
    }
    await admin.from('grades').insert(grd);

    // việc thiêng liêng
    const sp = [];
    for (let si = 0; si < sids.length; si++) {
      for (const tId of taskIds) {
        for (const dt of spDates) {
          const done = rnd(sSeed * 11 + si * 13 + dt.length) < 0.7;
          sp.push({ parish_id: pid, student_id: sids[si], task_id: tId, date: dt, done });
        }
      }
    }
    for (let k = 0; k < sp.length; k += 500) await admin.from('spiritual_records').insert(sp.slice(k, k + 500));

    sSeed += 17;
  }

  // 8) Đơn xét duyệt đã duyệt cho mọi lớp 2025-2026 (quyết định: hầu hết advance, vài em stay)
  const reviews = cls1.map((c) => {
    const decisions: Record<string, string> = {};
    (studentsByClass[c.id] || []).forEach((s, i) => { decisions[s.id] = i % 7 === 6 ? 'stay' : 'advance'; });
    return {
      parish_id: pid, class_id: c.id, school_year: Y1, kind: 'catechism', status: 'approved',
      decisions, submitted_by: teacherIds[0] || uid, reviewed_by: uid,
      submitted_at: '2026-05-20T00:00:00Z', reviewed_at: '2026-05-22T00:00:00Z',
    };
  });
  await admin.from('class_reviews').insert(reviews);

  // 9) Thu chi mẫu
  await admin.from('transactions').insert([
    { parish_id: pid, class_id: null, content: 'Quỹ giáo lý đầu năm', type: 'thu', amount: 5000000, date: '2025-09-10', note: 'Đóng góp phụ huynh' },
    { parish_id: pid, class_id: null, content: 'Mua sách giáo lý', type: 'chi', amount: 1800000, date: '2025-09-20' },
    { parish_id: pid, class_id: cls1[0].id, content: 'Phần thưởng lớp Khai Tâm', type: 'chi', amount: 600000, date: '2026-05-25' },
    { parish_id: pid, class_id: null, content: 'Quỹ liên hoan cuối năm', type: 'thu', amount: 3000000, date: '2026-05-15' },
  ]);

  // 10) Lên lớp 2026-2027: tạo bộ lớp mới (graduated=false), chuyển học viên lên bậc kế.
  const cls2: Record<number, string> = {}; // order -> new class id
  for (let i = 0; i < cls1.length; i++) {
    const isGrad = i === cls1.length - 1;
    const { data: nc } = await admin.from('classes').insert({
      parish_id: pid, name: cls1[i].name, school_year: Y2, order_index: i + 1,
      room: 'P' + (101 + i), schedule: 'Chúa Nhật', kind: 'catechism', is_graduation: isGrad, promotes: true, graduated: false,
    }).select('id').single();
    cls2[i + 1] = nc!.id;
    if (teacherIds.length) await admin.from('class_teachers').insert({ class_id: nc!.id, teacher_id: teacherIds[i % teacherIds.length], is_primary: true });
  }
  // Chuyển: lớp order o -> order o+1 năm mới; lớp tốt nghiệp -> ra trường (không copy)
  const copies: Record<string, unknown>[] = [];
  const gradStudentIds: string[] = [];
  for (const c of cls1) {
    const destOrder = c.grad ? null : c.order + 1;
    const destId = destOrder ? cls2[destOrder] : null;
    for (const s of (studentsByClass[c.id] || [])) {
      if (!destId) { gradStudentIds.push(s.id); continue; }
      // lấy full record để copy
    }
    if (destId) {
      const { data: full } = await admin.from('students').select('*').eq('class_id', c.id);
      for (const s of (full || [])) {
        const o: Record<string, unknown> = { ...s };
        delete o.id; delete o.created_at;
        o.class_id = destId; o.graduated = false; o.origin_id = s.origin_id || s.id;
        // nâng bí tích một bậc cho hợp lý
        o.sacrament = c.order + 1 <= 2 ? 'none' : c.order + 1 <= 3 ? 'ruoc_le' : 'them_suc';
        copies.push(o);
      }
    }
  }
  if (copies.length) for (let k = 0; k < copies.length; k += 300) await admin.from('students').insert(copies.slice(k, k + 300));
  if (gradStudentIds.length) await admin.from('students').update({ grad_passed: true }).in('id', gradStudentIds);

  // 11) settings: năm hiện tại 2026-2027, đóng kỳ xét duyệt
  const { data: par } = await admin.from('parishes').select('settings').eq('id', pid).maybeSingle();
  await admin.from('parishes').update({
    settings: { ...(par?.settings || {}), current_school_year: Y2, promotion_open: false, manage_by_school_year: true, auto_promote: true, show_graduated: true },
  }).eq('id', pid);

  return json({
    ok: true, parish_id: pid, teachers: teacherIds.length,
    classes_2025_2026: cls1.length, students_per_class: N_PER,
    attendance_dates: dates.length, promoted_to_2026_2027: copies.length, graduated: gradStudentIds.length,
  });
});
