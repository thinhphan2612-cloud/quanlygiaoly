-- v6: bật Supabase Realtime cho các bảng để đồng bộ tức thời giữa admin & GLV.
-- RLS vẫn áp dụng cho realtime (mỗi tài khoản chỉ nhận thay đổi của dữ liệu mình được xem).
-- Idempotent: chỉ thêm bảng chưa có trong publication.
do $$
declare t text;
begin
  foreach t in array array[
    'students','classes','grades','grade_columns','attendance',
    'spiritual_records','spiritual_tasks','class_teachers','transactions',
    'school_years','notifications','profiles'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;
