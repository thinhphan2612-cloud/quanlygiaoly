-- Thumbnail cho game mặc định.
alter table public.default_games add column if not exists thumb_url text;

-- Gán thumbnail cho game bundle "Ai Là Triệu Phú".
update public.default_games
   set thumb_url = '/games/ai-la-trieu-phu/thumb.jpg'
 where key = 'ai-la-trieu-phu' and (thumb_url is null or thumb_url = '');
