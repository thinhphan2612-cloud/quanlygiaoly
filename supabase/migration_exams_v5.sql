-- Thi online v5: mốc giờ bắt đầu ở cấp ĐỀ (để màn hình GLV hiện đồng hồ đếm ngược).
alter table public.exams add column if not exists started_at timestamptz;
