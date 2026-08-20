# Kế hoạch nâng cấp (từ feedback "UXUI upgrade" + yêu cầu bổ sung)

> Nguồn: file `UXUI upgrade.pdf` (9 trang mockup có chú thích) + tin nhắn bổ sung của Felix.
> Trạng thái: [ ] chưa làm · [~] đang làm · [x] xong

## A. Nền tảng & giao diện chung
- [x] A1. Đổi **toàn bộ màu tím → xanh dương** trên toàn UI. (biến --primary + hardcode → tông #2563eb)
- [ ] A2. **Edit được logo, tên giáo phận, tên giáo xứ** (hiển thị ở góc trái topbar thay cho "Quản lý Giáo lý").
- [ ] A3. Nút **Theme**: đổi Day/Night và đổi màu theo **năm phụng vụ**.
- [ ] A4. Nút **"Góp ý / liên hệ tác giả"** (kèm quảng cáo wecatholic) đặt dưới sidebar.
- [ ] A5. Cụm **gói/nâng cấp Pro**: nút "Upgrade to go Pro"; bấm vào hiện **bảng các gói + lợi ích từng gói** (Basic / Standard / Pro). Tài khoản Free bị khóa các tính năng Pro.

## B. Cài đặt tài khoản Admin (bấm vào avatar) — YÊU CẦU BỔ SUNG, ưu tiên
- [ ] B1. Bấm avatar → menu: **họ tên admin** + **Cài đặt thông tin quản lý**.
- [ ] B2. **Quản lý theo năm học giáo lý.**
- [ ] B3. **Auto nhảy lớp sau mỗi năm học**: nhập **thứ tự lớp** để hệ thống tự cho học viên lên lớp kế tiếp.
- [ ] B4. Lớp cuối cùng (ra trường) → chuyển vào mục **"Đã ra trường"** (lưu trữ, tìm nhanh sau này).
- [ ] B5. Các trường quản lý này cho **bật/tắt (on/off)**, **mặc định ON**.

## C. Dashboard (Tổng quan)
- [ ] C1. **Bỏ cột "Mã học viên" (Mã HV)**.
- [ ] C2. **Bỏ ô "Điểm trung bình"** ở hàng thẻ thống kê.
- [ ] C3. Thay donut/thẻ bằng **biểu đồ tăng/giảm điểm danh theo từng tuần** của **tổng tất cả học viên**.
- [ ] C4. **Chuông thông báo** hoạt động thật: tự động báo khi có học viên **vắng 3 buổi liên tiếp**; nhận thông báo từ admin.

## D. Học viên (Students)
- [ ] D1. Nút **Sort/Lọc** trên thanh công cụ (bấm ra popup) với các bộ lọc:
  - lọc nhiều lớp cùng lúc (tích chọn 2–3 lớp)
  - lọc bí tích (rước lễ / thêm sức / chưa có)
  - lọc điểm; lọc vắng nhiều nhất; lọc chuyên cần nhất; lọc thiếu cột điểm
  - lọc điểm trên/dưới ngưỡng (nhập số để lọc)
- [ ] D2. Thêm trường **Chức vụ** (tự nhập tay: lớp trưởng, lớp phó...).

## E. Lớp học (Classes)
- [ ] E1. Cho phép **nhiều giáo lý viên/lớp** (chính + phụ).
- [ ] E2. Thêm trường **Phòng học** (tự nhập, vd A102) — hiển thị ở bảng chính.
- [ ] E3. Thêm trường **Thời gian học** (sáng/chiều/tối) — hiển thị ở bảng chính.

## F. Điểm danh (Attendance) — tách 2 trang
- [ ] F1. **Tách 2 tab: "Giáo lý"** và **"Việc Thiêng liêng"**.
- [ ] F2. Trang Giáo lý: chỉ thống kê ngày **đã chọn ngày điểm danh** (thường là Chúa Nhật).
- [ ] F3. Thêm nút **Tuần / Tháng** + cột **Thống kê** (có mặt / tổng số buổi, vd 5/7) chỉ hiện ở chế độ tuần/tháng. Hiển thị lưới ngày S-M-T-W-T-F-S.
- [ ] F4. Nút **checkbox "Sắp xếp chuyên cần"**: check → xếp theo độ siêng năng; bỏ check → xếp tên ABC.
- [ ] F5. Trang **Việc Thiêng liêng**: tạo nhiều "việc" (Đi lễ, Đọc kinh...) thành các **ô check**; nút **Setting (⚙)** để thêm/bớt cột việc. Hiển thị đủ ngày theo tuần/tháng.

## G. Điểm số (Grades) — redesign (UX hiện tại khó dùng)
- [ ] G1. **Bảng điểm cả lớp** (hiện chỉ xem từng người). Nút **"Tổng quát"** → xem bảng gồm mọi cột + điểm TB (giống bản PDF nhưng chỉ xem).
- [ ] G2. Nút **Setting (⚙)**: quản lý **các cột điểm** đã tạo + **hệ số** (sửa được). VD: KT15' hs1, KT1 tiết hs1, HK1 hs2, HK2 hs2, điểm cộng hs1.
- [ ] G3. Nhập điểm **inline** trong bảng: bấm Sửa → thành Lưu, hoặc auto-lưu khi click ra ngoài.
- [ ] G4. Nút **checkbox "Sắp xếp theo thứ hạng"**: check → xếp theo hạng; bỏ check → tên ABC.

## H. Chọn trả bài (RandomPicker)
- [ ] H1. Nút **"Chưa thuộc bài"**: bấm → học viên không qua lượt nhưng vẫn nằm trong danh sách chọn lần sau.
- [ ] H2. Chữ "Không lặp lại người đã chọn" cho **rõ/đậm hơn**.

## I. Trang Admin — Quản lý giáo viên (mở rộng)
- [ ] I1. Tab **"Quản lý giáo viên"**: thêm **thông tin cá nhân GLV** (ngày sinh, địa chỉ, khu vực, cấp GLV [cấp 1/2, để trống cha tự điền], nghề nghiệp, đồng hành lớp nào, SĐT).
- [ ] I2. Sắp xếp thứ tự cột: quản lý lớp nào.
- [ ] I3. Tab **"Thông báo đến GV"**: ô nội dung + tích chọn người nhận + gửi + **lịch sử tin nhắn đã gửi**.
- [ ] I4. Tab **"Kiểm toán"**: nhập **thu/chi** đơn giản (tên nội dung, thu, chi, ngày) + **thống kê cân đối** (âm/dương). Admin chỉ **xem/thống kê** thu chi các lớp, không can thiệp.

## J. Trang Giáo lý viên (member) — quyền hạn
- [ ] J1. GLV chỉ **quản lý MỘT lớp duy nhất**, không can thiệp nội dung chung.
- [ ] J2. GLV có 3 mục: quản lý giáo viên (xem thông tin cá nhân của mình), thông báo đến GV (**chỉ nhận, không trả lời**), kiểm toán (nhập thu chi lớp mình).

## K. Game học
- [ ] K1. Trang game chỉ hiện **thumbnail + tên game**; bấm → **popup mô tả** + nút Play điều hướng sang tên miền khác (vd wecatholic).
- [ ] K2. Tài khoản **Free**: các game **xám hết, không truy cập được** (Pro mới mở).

---
## ⚠ Ghi chú kiến trúc quan trọng
- Repo có **2 tầng dữ liệu**: backend Express+SQLite (`server/`) VÀ adapter localStorage (`client/src/localApi.js`) cho bản demo Vercel. Mỗi thay đổi schema/API phải sửa **cả hai** nếu muốn đồng bộ.
- Nhiều feature trong feedback (thông báo admin↔GV, tài khoản con, kiểm toán chia sẻ, khóa gói Pro thật) **chỉ hoạt động thật khi có backend + DB chung**. Trên localStorage chỉ giả lập UI theo từng máy — không chia sẻ dữ liệu giữa người dùng.
