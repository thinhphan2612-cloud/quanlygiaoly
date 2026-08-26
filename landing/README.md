# Landing page — giaoly.com.vn

Trang giới thiệu (marketing) cho Giáo Lý Số. Đây là **static site** riêng, tách khỏi web app.

## Deploy lên Vercel (project riêng)

1. Vercel → **Add New → Project** → import repo `thinhphan2612-cloud/quanlygiaoly`.
2. Ở màn hình cấu hình, đặt **Root Directory = `landing`**.
3. Framework Preset để **Other** (không cần build — chỉ static HTML). Deploy.
4. Project này → Settings → **Domains** → thêm `giaoly.com.vn` và `www.giaoly.com.vn`.
5. Ở project **app** (React) → Settings → Domains → **gỡ** `giaoly.com.vn` và `www` (chỉ giữ `app.giaoly.com.vn`).

## Nội dung

- `index.html` — toàn bộ landing (self-contained, không cần build).
- Nút **Đăng nhập** → `https://app.giaoly.com.vn/login`, **Đăng ký** → `.../register`.
- Tự đổi thành **"Vào ứng dụng"** khi phát hiện cookie `gl_signed_in` (app ghi khi đăng nhập trên `.giaoly.com.vn`).

Sửa landing → chỉnh `index.html` rồi push; Vercel tự deploy lại.
