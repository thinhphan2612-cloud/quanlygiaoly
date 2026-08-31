# Email templates (Giáo Lý Số)

HTML cho các email hệ thống, dùng **logo thương hiệu** (`https://www.giaoly.com.vn/logo-full.png`) thay cho icon/emoji.

Các template này KHÔNG nằm trong code app — chúng được cấu hình ở **Supabase Dashboard → Authentication → Email Templates**. Sau khi sửa file ở đây, phải **copy nội dung dán vào ô "Message body (HTML)"** của template tương ứng rồi bấm **Save**.

| File | Template trong Supabase | Dùng khi |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | User tự đăng ký (nếu bật xác nhận email) |
| `reset-password.html` | **Reset Password** | Quên mật khẩu → gửi link đặt lại |
| `invite.html` | **Invite user** | Admin mời/cấp tài khoản cho GLV/giáo xứ |

## Lưu ý
- Biến động nhất quán: nút bấm dùng `{{ .ConfirmationURL }}` (Supabase tự thay bằng link thật). Có thể dùng thêm `{{ .Email }}`, `{{ .SiteURL }}`, `{{ .Token }}` nếu cần.
- **Logo phải là URL HTTPS công khai** — email client (Gmail…) không đọc được data-URI hay logo lưu trong DB. Đang dùng `https://www.giaoly.com.vn/logo-full.png` (apex `giaoly.com.vn` bị 308 redirect sang `www`, nên dùng thẳng `www`).
- Nếu đổi logo: thay `landing/logo-full.png`, deploy lại landing, giữ nguyên tên file để URL không đổi.
- Vấn đề email vào spam là chuyện KHÁC (do gửi từ Gmail SMTP) — cần domain auth (Resend + DNS giaoly.com.vn), không liên quan template này.
