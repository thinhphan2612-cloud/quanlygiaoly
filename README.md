# Giáo Lý Số (quanlygiaoly)

Webapp SaaS quản lý lớp giáo lý Công giáo theo từng **giáo xứ** (multi-tenant): học viên, lớp, giáo lý viên, điểm danh, việc thiêng liêng, điểm số và thi đua, đề thi online tự chấm, chứng chỉ bí tích, lên lớp/ra trường theo niên khóa, dashboard và game học giáo lý.

- App: **app.giaoly.com.vn** · Giới thiệu: **giaoly.com.vn**

## Công nghệ

- **Frontend**: React + Vite + React Router (thư mục `client/`). Triển khai trên **Vercel**.
- **Backend**: **Supabase** — Postgres (RLS multi-tenant theo `parish_id`) + **Edge Functions** (Deno). Không có server Node riêng cho production.
- Client gọi dữ liệu qua `client/src/supabaseApi.js` (adapter giả lập REST path-based, nói chuyện trực tiếp với Supabase JS + RPC), và gọi Edge Functions cho các việc cần `service_role` hoặc gửi email.

> Thư mục `server/` (Express + SQLite) và `api/` là mã **cũ trước khi chuyển sang Supabase**, giữ lại để tham khảo, không dùng cho production.

## Cấu trúc thư mục

```
client/            # React SPA (Vite) — deploy lên Vercel
  src/
    pages/         # Students, Classes, Attendance, Grades, Exams, ExamTake, Admin, Settings, Login, Guide...
    components/    # Layout, InstallGuide, PricingModal...
    lib/           # plans, viError, exportUtils, viName, pwa, parseStudents...
    supabaseApi.js # "API" path-based gọi Supabase (quan trọng nhất)
    api.js, auth.jsx
  public/          # manifest.webmanifest, sw.js, exam-question-bank.json, favicon, logo
  index.html, .env.local (không commit)
supabase/
  functions/<tên>/index.ts   # Edge Functions (Deno)
  migration_*.sql, schema.sql # chạy TAY trong Supabase SQL Editor
landing/index.html           # trang giới thiệu tĩnh (giaoly.com.vn)
vercel.json                  # cấu hình build/deploy Vercel
```

## Chức năng chính

- Phân quyền theo giáo xứ: **Quản trị (admin)** và **Giáo lý viên (GLV)**; **super-admin** quản trị billing toàn hệ thống.
- Học viên (hồ sơ trọn đời, cha mẹ, đỡ đầu, bí tích), lớp học, phân công GLV, nhập hàng loạt.
- Điểm danh theo ngày và việc thiêng liêng; thống kê tuần/tháng; xuất báo cáo Excel/PDF.
- Điểm số theo hệ số, xếp hạng thi đua; chứng chỉ bí tích (in/PDF).
- Đề thi online: tạo đề (ngân hàng câu hỏi + tự soạn), học viên quét mã vào thi, tự chấm, cảnh báo rời màn hình.
- Lên lớp/ra trường cuối năm (mô hình COPY theo niên khóa) + lưu trữ các niên khóa cũ.
- Gói dịch vụ: **Khởi động** (free, 1 lớp) và **Pro** (phân bậc theo số lớp), tính theo niên khóa.

## Edge Functions (Supabase)

`admin-api` (super-admin + chương trình Tân thủ), `create-teacher` (tạo GLV/đổi mật khẩu), `register-invite` (đăng ký từ landing), `redeem-welcome`, `promo-blast`, `pro12-campaign`, `cron-tasks` (nhắc gia hạn), `lead-notify`, `provision`.

## Phát triển & triển khai

```bash
# Chạy client ở local (cần client/.env.local với VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
cd client && npm install && npm run dev

# Build kiểm tra
cd client && npm run build

# Deploy Edge Function (Supabase CLI đã đăng nhập)
npx supabase functions deploy <tên> [--no-verify-jwt] --project-ref <project-ref>

# Đặt secret cho Edge Functions
npx supabase secrets set NAME=value --project-ref <project-ref>
```

- **Frontend**: Vercel tự build từ branch `main` (`buildCommand: npm --prefix client run build`, output `client/dist`).
- **Migrations**: dán nội dung `supabase/migration_*.sql` vào **Supabase SQL Editor** rồi chạy (không có pipeline tự động).

## Biến môi trường (chỉ tên — không commit giá trị)

- Client (`client/.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `EXAM_CODE`.
- Edge Functions (Supabase secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SUPERADMIN_EMAILS`, `APP_URL`, `PROMO_SECRET`, `PRO12_SECRET`.

## Lưu ý

- Email gửi bằng SMTP thô tự viết (`smtpSend` trong các Edge Function), không dùng denomailer.
- Văn bản hiển thị cho người dùng viết tiếng Việt tự nhiên, không dùng dấu gạch ngang dài (—).
