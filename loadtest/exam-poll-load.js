// =====================================================================
//  k6 load test — mô phỏng N học viên thi online cùng lúc, mỗi em poll
//  RPC exam_public mỗi 2.5s (đúng nhịp ExamTake.jsx dùng khi làm bài).
//  Đây là request LẶP chiếm ~toàn bộ tải lúc thi -> đại diện tốt để chọn
//  compute Supabase. Script CHỈ ĐỌC (không ghi DB, không tạo rác).
//
//  Chạy:
//    k6 run \
//      -e SUPABASE_URL=https://xxxx.supabase.co \
//      -e ANON_KEY=eyJhbGciOi... \
//      -e EXAM_CODE=ABC123 \
//      -e VUS=1000 -e DURATION=2m \
//      loadtest/exam-poll-load.js
//
//  Lấy SUPABASE_URL + ANON_KEY từ client/.env.local (VITE_SUPABASE_URL,
//  VITE_SUPABASE_ANON_KEY). EXAM_CODE = mã 1 đề bất kỳ đang tồn tại
//  (không cần 'started' — poll trạng thái chạy ở mọi trạng thái).
// =====================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.ANON_KEY;
const CODE = __ENV.EXAM_CODE;
const VUS = Number(__ENV.VUS || 1000);          // số học viên mô phỏng
const POLL_SEC = Number(__ENV.POLL_SEC || 2.5); // nhịp poll của mỗi em
const DURATION = __ENV.DURATION || '2m';

if (!URL || !KEY || !CODE) {
  throw new Error('Thiếu env: cần SUPABASE_URL, ANON_KEY, EXAM_CODE');
}

const RATE = Math.round(VUS / POLL_SEC); // ví dụ 1000 em / 2.5s = 400 request/giây
const okRate = new Rate('poll_ok');
const rpcMs = new Trend('rpc_ms', true);

export const options = {
  scenarios: {
    exam_poll: {
      executor: 'constant-arrival-rate',
      rate: RATE,               // số poll mỗi giây (ổn định, không phụ thuộc độ trễ)
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: VUS,     // đủ VU để giữ nhịp kể cả khi server chậm
      maxVUs: VUS * 2,
    },
  },
  thresholds: {
    // Khớp ngưỡng đèn báo trong app: đỏ khi p95 > 800ms, lỗi > 1%.
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    poll_ok: ['rate>0.99'],
  },
};

const endpoint = `${URL}/rest/v1/rpc/exam_public`;
const params = {
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  },
  tags: { name: 'exam_public' },
};
const body = JSON.stringify({ p_code: CODE });

// Kiểm tra mã đề tồn tại trước khi dội tải (tránh test nhầm mã sai).
export function setup() {
  const r = http.post(endpoint, body, params);
  if (r.status !== 200) throw new Error(`exam_public lỗi ${r.status}: ${r.body}`);
  if (r.body === 'null') throw new Error(`Không tìm thấy đề với EXAM_CODE=${CODE}`);
  console.log(`OK: mô phỏng ${VUS} em, ~${RATE} poll/giây trong ${DURATION}.`);
}

export default function () {
  const r = http.post(endpoint, body, params);
  rpcMs.add(r.timings.duration);
  const good = check(r, {
    'status 200': (res) => res.status === 200,
    'có dữ liệu đề': (res) => res.body && res.body !== 'null',
  });
  okRate.add(good);
  // Không cần sleep: constant-arrival-rate tự giữ nhịp RATE poll/giây.
}
