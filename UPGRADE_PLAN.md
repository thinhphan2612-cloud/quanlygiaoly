# Kế hoạch nâng cấp (từ feedback "UXUI upgrade" + yêu cầu bổ sung)

> Nguồn: file `UXUI upgrade.pdf` (9 trang mockup có chú thích) + tin nhắn bổ sung của Felix.
> Trạng thái: [ ] chưa làm · [~] đang làm · [x] xong

## A. Nền tảng & giao diện chung
- [x] A1. Đổi **toàn bộ màu tím → xanh dương** trên toàn UI. (biến --primary + hardcode → tông #2563eb)
- [x] A2. **Edit logo + tên giáo phận + tên giáo xứ** (Settings) — hiển thị ở sidebar & topbar. Logo lưu data-URL (không cần Storage).
- [x] A3. **Theme Day/Night** (menu avatar + Settings) + **màu theo năm phụng vụ** (6 màu: xanh, tím Vọng/Chay, xanh lá Thường niên, đỏ, hồng, vàng).
- [x] A4. Nút **"Góp ý / liên hệ tác giả"** dưới sidebar (modal: email góp ý + link WeCatholic).
- [x] A5. Cụm **gói/nâng cấp Pro**: thẻ Upgrade ở sidebar → **PricingModal** (Basic/Standard/Pro + lợi ích). Gói lưu ở parishes.plan (admin đặt tay ở Settings; thanh toán bổ sung sau).

## B. Cài đặt tài khoản Admin (bấm vào avatar) — YÊU CẦU BỔ SUNG, ưu tiên ✅
- [x] B1. Bấm avatar → menu: **họ tên admin** + email + **Cài đặt quản lý** (trang `/settings`).
- [x] B2. **Quản lý theo năm học giáo lý** (thêm/xóa năm học, đặt năm hiện tại).
- [x] B3. **Auto nhảy lớp sau mỗi năm học**: ô **thứ tự lớp** ở form lớp; nút "Lên lớp" chuyển học viên lên lớp kế (đã kiểm chứng: không nhảy dồn).
- [x] B4. Lớp cao nhất (ra trường) → mục **"Đã ra trường"** trong Settings (có tìm kiếm).
- [x] B5. 3 cờ **bật/tắt (on/off)**, **mặc định ON** (lưu vào parishes.settings).

## C. Dashboard (Tổng quan)
- [x] C1. **Bỏ cột "Mã học viên" (Mã HV)**.
- [x] C2. **Bỏ ô "Điểm trung bình"** ở hàng thẻ thống kê.
- [ ] C3. Thay donut/thẻ bằng **biểu đồ tăng/giảm điểm danh theo từng tuần** của **tổng tất cả học viên**.
- [ ] C4. **Chuông thông báo** hoạt động thật: tự động báo khi có học viên **vắng 3 buổi liên tiếp**; nhận thông báo từ admin.

## D. Học viên (Students) ✅
- [x] D1. Nút **Lọc / Sắp xếp** (popup) với: lọc nhiều lớp (tích), lọc bí tích (rước lễ/thêm sức/chưa),
  lọc điểm ≥/≤ ngưỡng nhập tay, chỉ hiện thiếu cột điểm, sắp xếp vắng nhiều nhất / chuyên cần nhất.
  (Endpoint `/student-stats` tính avg, cột điểm thiếu, present/absent/late.)
- [x] D2. Trường **Chức vụ** (tự nhập: lớp trưởng, lớp phó) — hiện dạng chip ở bảng.
- Bí tích đổi 'vo_long' → **'ruoc_le' (Rước lễ)** cho khớp feedback (none | ruoc_le | them_suc).

## E. Lớp học (Classes) ✅
- [x] E1. **Nhiều giáo lý viên/lớp** (chọn nhiều + đánh dấu 1 người chính).
- [x] E2. Trường **Phòng học** (vd A102) — hiển thị bảng chính.
- [x] E3. Trường **Thời gian học** (Sáng/Chiều/Tối) — hiển thị bảng chính.

## F. Điểm danh (Attendance) — tách 2 trang ✅
- [x] F1. **2 tab: "Giáo lý"** và **"Việc Thiêng liêng"**.
- [x] F2. Giáo lý: thống kê chỉ tính các ngày đã điểm danh.
- [x] F3. Nút **Ngày / Tuần / Tháng** + cột **Thống kê** (present/tổng buổi) + lưới ngày ở chế độ tuần/tháng.
- [x] F4. Checkbox **"Sắp xếp chuyên cần"** (có mặt nhiều → đầu) vs tên ABC.
- [x] F5. **Việc Thiêng liêng**: tạo nhiều việc (⚙ Quản lý việc), ô check theo học viên/ngày; thống kê tuần/tháng đếm số lần.
- API: /attendance-range, /spiritual-tasks (CRUD), /spiritual (get/post), /spiritual-range.

## G. Điểm số (Grades) — redesign ✅
- [x] G1. **Bảng điểm cả lớp** (học viên × cột điểm) + nút **"Tổng quát"** (modal xem toàn bảng + TB + hạng).
- [x] G2. Nút **⚙ Cột điểm**: quản lý cột điểm + **hệ số** (sửa inline, thêm/xóa). TB tính **có trọng số**.
- [x] G3. Nhập điểm **inline** trong bảng, **auto-lưu khi bấm ra ngoài** (viền xanh báo lưu).
- [x] G4. Checkbox **"Sắp xếp theo thứ hạng"** vs tên ABC; cột Hạng hiển thị vị thứ.
- API: /grade-columns (CRUD), /grades-class (ma trận điểm), /grade-cell (upsert/xóa 1 ô).

## H. Chọn trả bài (RandomPicker) ✅
- [x] H1. Nút **"Chưa thuộc bài"** (hiện sau khi bốc): bỏ khỏi danh sách đã chọn → vẫn được chọn lần sau.
- [x] H2. Chữ "Không lặp lại người đã chọn" đậm/rõ hơn (.picker-check).

## I. Trang Admin — Quản lý giáo viên (mở rộng)
- [ ] I1. Tab **"Quản lý giáo viên"**: thêm **thông tin cá nhân GLV** (ngày sinh, địa chỉ, khu vực, cấp GLV [cấp 1/2, để trống cha tự điền], nghề nghiệp, đồng hành lớp nào, SĐT).
- [ ] I2. Sắp xếp thứ tự cột: quản lý lớp nào.
- [ ] I3. Tab **"Thông báo đến GV"**: ô nội dung + tích chọn người nhận + gửi + **lịch sử tin nhắn đã gửi**.
- [ ] I4. Tab **"Kiểm toán"**: nhập **thu/chi** đơn giản (tên nội dung, thu, chi, ngày) + **thống kê cân đối** (âm/dương). Admin chỉ **xem/thống kê** thu chi các lớp, không can thiệp.

## J. Trang Giáo lý viên (member) — quyền hạn
- [ ] J1. GLV chỉ **quản lý MỘT lớp duy nhất**, không can thiệp nội dung chung.
- [ ] J2. GLV có 3 mục: quản lý giáo viên (xem thông tin cá nhân của mình), thông báo đến GV (**chỉ nhận, không trả lời**), kiểm toán (nhập thu chi lớp mình).

## K. Game học ✅ (giao diện + khóa gói; nội dung game mẫu, link WeCatholic)
- [x] K1. Trang game hiện **thumbnail + tên**; bấm → **popup mô tả** + nút "Chơi ngay" mở tab mới (WeCatholic).
- [x] K2. Gói **Free**: game **xám + khóa 🔒**, bấm → mở bảng nâng cấp. Standard/Pro mở khóa.
- Ghi chú: danh sách game hiện là mẫu tĩnh (6 game) — có thể cho admin tự quản lý sau.

---
## ⚠ Ghi chú kiến trúc quan trọng
- Repo có **2 tầng dữ liệu**: backend Express+SQLite (`server/`) VÀ adapter localStorage (`client/src/localApi.js`) cho bản demo Vercel. Mỗi thay đổi schema/API phải sửa **cả hai** nếu muốn đồng bộ.
- Nhiều feature trong feedback (thông báo admin↔GV, tài khoản con, kiểm toán chia sẻ, khóa gói Pro thật) **chỉ hoạt động thật khi có backend + DB chung**. Trên localStorage chỉ giả lập UI theo từng máy — không chia sẻ dữ liệu giữa người dùng.
