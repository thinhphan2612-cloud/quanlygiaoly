# Load test thi online (k6)

Mô phỏng nhiều học viên thi cùng lúc để **chọn đúng compute Supabase** trước buổi thi thật.
Script `exam-poll-load.js` bắn đúng request mà mỗi em lặp lại khi làm bài: RPC `exam_public`
mỗi 2.5s. Đây là ~toàn bộ tải lúc thi. Script **chỉ đọc**, không ghi DB.

## 1. Cài k6
- Windows: `winget install k6` hoặc `choco install k6`
- macOS: `brew install k6`
- Hoặc tải tại https://k6.io/docs/get-started/installation/

## 2. Lấy tham số
- `SUPABASE_URL`, `ANON_KEY`: trong `client/.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `EXAM_CODE`: mã của một đề bất kỳ đang tồn tại (tab Thi online → mã QR). Không cần bấm "Bắt đầu".

## 3. Chạy

```bash
k6 run \
  -e SUPABASE_URL=https://xxxx.supabase.co \
  -e ANON_KEY=eyJhbGciOi... \
  -e EXAM_CODE=ABC123 \
  -e VUS=1000 -e DURATION=2m \
  loadtest/exam-poll-load.js
```

PowerShell (Windows) — đặt biến rồi chạy:

```powershell
k6 run --env SUPABASE_URL=https://xxxx.supabase.co --env ANON_KEY=eyJ... --env EXAM_CODE=ABC123 --env VUS=1000 --env DURATION=2m loadtest/exam-poll-load.js
```

Tham số: `VUS` = số em mô phỏng (mặc định 1000), `POLL_SEC` = nhịp poll (2.5),
`DURATION` = thời lượng (2m). Script tự tính `RATE = VUS / POLL_SEC` (1000/2.5 = 400 poll/giây).

## 4. Đọc kết quả

k6 in ra cuối phiên:
- **http_req_duration p(95)/p(99)**: độ trễ. Ngưỡng đặt sẵn: p95 < 800ms, p99 < 2000ms — khớp đèn báo trong app.
- **http_req_failed**: tỉ lệ lỗi (đặt < 1%).
- **poll_ok**: tỉ lệ poll trả đúng dữ liệu đề (> 99%).

Cuối log có dòng `✓/✗` cho từng threshold. Nếu **✗** ở p95 hoặc error rate → compute hiện tại
**chưa đủ** cho mức `VUS` đó → nâng compute rồi chạy lại.

## 5. Cách dò ngưỡng compute (quan trọng)

Chạy bậc thang để tìm trần của compute đang dùng: giữ `DURATION=2m`, tăng dần `VUS`
200 → 400 → 700 → 1000 → 1500. Mức `VUS` cao nhất mà **vẫn pass cả 3 threshold** chính là
sức chịu an toàn thực đo. Song song, mở tab **Quản trị → Giám sát tải** và xem
Dashboard Supabase (Reports → CPU) để đối chiếu.

Từ con số đó, chỉnh lại ngưỡng vàng/đỏ:
- Trong app: hằng `MON` ở `client/src/pages/Admin.jsx`.
- Cảnh báo nền: biến `v_red` trong `supabase/migration_load_monitor.sql`.

## Lưu ý
- Test tạo **tải thật** + tốn **egress** (tính tiền). Chạy lúc vắng, hoặc trên project staging.
- Không dùng bản này để test đường ghi (join/submit) — sẽ tạo attempt rác. Nếu cần test cả
  ghi, làm trên project staging với dữ liệu riêng.
- k6 chạy từ 1 máy: nếu chính máy bạn (CPU/mạng) là nút nghẽn thì số đo sai — chạy từ máy khỏe,
  mạng tốt, hoặc dùng k6 Cloud để bắn từ nhiều vùng.
