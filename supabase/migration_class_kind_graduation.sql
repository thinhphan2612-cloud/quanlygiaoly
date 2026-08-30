-- =====================================================================
--  Phân loại lớp + tốt nghiệp
--  Chạy 1 lần trong SQL Editor của Supabase (project giaoly).
-- =====================================================================

-- 1) Loại lớp: 'catechism' (giáo lý chính quy) | 'external' (hôn nhân/dự tòng…)
alter table public.classes add column if not exists kind text not null default 'catechism';
-- 2) Lớp tốt nghiệp (chỉ dùng cho catechism): học viên lớp này auto ra trường khi kết thúc năm
alter table public.classes add column if not exists is_graduation boolean not null default false;
-- 3) Kết quả tốt nghiệp của học viên: null=chưa xét, true=tốt nghiệp, false=không đạt
alter table public.students add column if not exists grad_passed boolean;

-- Migrate lớp cũ: lớp không tự lên lớp (promotes=false) -> ngoài hệ thống
update public.classes set kind = 'external' where promotes = false;

-- Backfill "đã ra trường" cho dữ liệu cũ:
-- học viên có bản ghi MỚI NHẤT (theo niên khóa) trong lineage đã graduated -> grad_passed = true
with lineage as (
  select s.id, coalesce(s.origin_id, s.id) as key, c.school_year, s.graduated
  from public.students s
  left join public.classes c on c.id = s.class_id
),
latest as (
  select distinct on (key) id, graduated
  from lineage
  order by key, school_year desc nulls last, id
)
update public.students s set grad_passed = true
from latest l
where s.id = l.id and l.graduated = true;
