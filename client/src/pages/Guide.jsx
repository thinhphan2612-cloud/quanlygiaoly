import { useEffect, useMemo, useState } from 'react';
import { IconSearch } from '../components/Icons.jsx';

// Bỏ dấu tiếng Việt để tìm kiếm không dấu.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Render text: mọi cụm trong “...” (tên tab/nút/chức năng) hiển thị thành chip dạng nút.
function ui(text) {
  const out = []; const re = /[“"]([^”"]+)[”"]/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span className="gd-ui" key={k++}>{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Nội dung hướng dẫn — mỗi mục: vai trò, từ khóa, tóm tắt, các bước, mẹo.
// roles: 'admin' = Cha sở / quản trị giáo xứ; 'teacher' = Giáo lý viên.
const GUIDE = [
  {
    id: 'batdau', title: 'Bắt đầu nhanh', roles: ['admin'],
    tags: 'thiết lập cài đặt khởi tạo bắt đầu quickstart onboarding giáo xứ thứ tự lớp glv học viên',
    summary: 'Thứ tự thiết lập một giáo xứ mới: “thông tin giáo xứ” → “tạo lớp” → “tạo giáo lý viên & gán lớp” → “nạp học viên theo từng lớp”.',
    steps: [
      'Vào “Cài đặt quản lý” (menu tài khoản góc trên phải): điền tên giáo xứ, giáo phận, tải logo. Logo và tên hiện trên đầu ứng dụng và trên chứng chỉ.',
      'Vào “Lớp học”: tạo TRƯỚC các lớp theo khối/ngành (vd Khai tâm, Rước lễ, Thêm sức…). Nên tạo đủ lớp rồi mới nạp học viên.',
      'Vào “Giáo lý viên”: tạo tài khoản cho từng GLV rồi gán vào lớp phụ trách.',
      'Vào “Học viên”: nạp học viên theo TỪNG LỚP. Dùng “Nhập hàng loạt”, chọn đúng lớp cần nạp rồi tải file mẫu Excel đã điền lên (xem mục “Nhập học viên hàng loạt”).',
      'Xong phần khung, mỗi buổi học chỉ cần: “Điểm danh” → “Điểm số” → cuối năm “Lưu trữ” & lên lớp.',
    ],
    tips: [
      'Tạo lớp trước rồi nạp học viên theo từng lớp. Cách này nhanh và gọn hơn nạp cả giáo xứ rồi chia lớp cho từng em.',
      'Hoàn tất Cài đặt (tên + logo) trước khi xuất chứng chỉ/giấy khen, vì các mẫu lấy dữ liệu từ đó.',
    ],
  },
  {
    id: 'tongquan', title: 'Tổng quan (Dashboard)', roles: ['admin', 'teacher'],
    tags: 'dashboard tổng quan trang chủ thống kê số liệu chỉ số',
    summary: 'Màn hình đầu tiên sau khi đăng nhập: các chỉ số nhanh (số lớp, số học viên, điểm danh…) và lối tắt tới việc thường làm.',
    steps: [
      'Xem nhanh tổng số lớp, học viên và tình hình điểm danh gần đây.',
      'Bấm vào các thẻ để đi thẳng tới trang tương ứng.',
    ],
    tips: ['Giáo lý viên chỉ thấy số liệu của các lớp mình được phân công; quản trị thấy toàn giáo xứ.'],
  },
  {
    id: 'hocvien', title: 'Học viên', roles: ['admin', 'teacher'],
    tags: 'học viên hồ sơ thêm sửa xóa ảnh gia đình bí tích rửa tội thêm sức import danh sách nhập hàng loạt',
    summary: 'Quản lý hồ sơ từng học viên: thông tin cá nhân, ảnh, gia đình và các bí tích đã lãnh nhận.',
    steps: [
      'Bấm “Thêm học viên”, điền họ tên, ngày sinh, lớp và các thông tin cần thiết. Có thể tải ảnh đại diện.',
      'Có sẵn danh sách cả lớp? Dùng “Nhập hàng loạt” để nạp nhanh từ Excel (xem mục “Nhập học viên hàng loạt”).',
      'Mở hồ sơ chi tiết (bấm vào tên học viên) để cập nhật thông tin gia đình (cha, mẹ, người đỡ đầu) và các bí tích (rửa tội, thêm sức…).',
      'Dùng ô tìm kiếm và bộ lọc theo lớp để tra cứu nhanh.',
    ],
    tips: [
      'Thông tin gia đình & bí tích trong hồ sơ được dùng lại khi xuất chứng chỉ hôn nhân, nên nhập càng đầy đủ càng đỡ phải gõ lại.',
    ],
  },
  {
    id: 'nhaphangloat', title: 'Nhập học viên hàng loạt', roles: ['admin', 'teacher'],
    tags: 'nhập hàng loạt import excel csv danh sách file mẫu tải lên dán nạp học viên theo lớp bulk',
    summary: 'Nạp nhanh cả danh sách học viên từ Excel thay vì thêm từng em. Giáo xứ thường đã có sẵn danh sách nên đây là cách nhanh nhất. Nên tạo lớp trước rồi nạp theo từng lớp.',
    steps: [
      'Tạo lớp trước ở mục “Lớp học”. Nên tạo đủ các lớp rồi mới nạp học viên.',
      'Vào “Học viên” → bấm “Nhập hàng loạt” → bấm “Tải form mẫu (Excel)”.',
      'Mở file mẫu và điền danh sách: “Tên thánh” và “Họ và tên” ở 2 cột riêng, ngày sinh, giới tính, cha/mẹ… Các cột chi tiết chứng chỉ để trống, điền sau ở hồ sơ từng em.',
      'Ở ô “Xếp vào lớp”, chọn đúng lớp cần nạp; rồi bấm “Tải lên Excel / CSV” chọn file vừa điền (hoặc dán trực tiếp từ Excel).',
      'Xem bảng “Xem trước” để kiểm tra, rồi bấm “Nhập … học viên”. Làm lần lượt cho từng lớp.',
    ],
    tips: [
      'Chọn lớp TRƯỚC khi nhập để cả danh sách vào đúng lớp, khỏi phải chia lớp cho từng em sau đó.',
      'Mỗi lớp làm một đợt (một file, hoặc một lần dán) cho gọn và dễ kiểm tra.',
    ],
  },
  {
    id: 'lophoc', title: 'Lớp học', roles: ['admin', 'teacher'],
    tags: 'lớp học tạo lớp khối ngành phân công giáo lý viên chuyển lớp',
    summary: 'Tạo và tổ chức các lớp giáo lý theo khối/ngành, phân giáo lý viên phụ trách.',
    steps: [
      'Bấm “Tạo lớp”, đặt tên lớp (vd Khai tâm, Rước lễ, Thêm sức, Bao đồng…) và chọn giáo lý viên phụ trách.',
      'Một lớp có thể có nhiều giáo lý viên (gói Pro). Mỗi GLV chỉ thao tác được trên lớp mình phụ trách.',
      'Mở một lớp để xem danh sách học viên, điểm danh và điểm số của riêng lớp đó.',
    ],
    tips: ['Đặt tên lớp nhất quán theo niên khóa để việc lên lớp cuối năm và lưu trữ được gọn gàng.'],
  },
  {
    id: 'giaolyvien', title: 'Giáo lý viên', roles: ['admin'], pro: true,
    tags: 'giáo lý viên glv tài khoản tạo tài khoản phân quyền xếp lớp mời email mật khẩu',
    summary: 'Cha sở tự tạo tài khoản cho từng giáo lý viên và xếp họ vào đúng lớp phụ trách. Chỉ quản trị giáo xứ dùng được.',
    steps: [
      'Vào “Giáo lý viên” → “Tạo tài khoản”: nhập email, họ tên (và mật khẩu tạm nếu được yêu cầu). Hệ thống tạo tài khoản GLV thuộc giáo xứ của bạn.',
      'Xếp GLV vào một hoặc nhiều lớp. Từ đó họ đăng nhập và chỉ thấy, thao tác được trên lớp được phân.',
      'Có thể chỉnh lại phân công hoặc gỡ tài khoản khi GLV nghỉ.',
    ],
    tips: [
      'Mỗi GLV chỉ thấy phần việc của mình. Dữ liệu các lớp khác được ẩn, giữ riêng tư và tránh nhầm lẫn.',
    ],
  },
  {
    id: 'diemdanh', title: 'Điểm danh', roles: ['admin', 'teacher'],
    tags: 'điểm danh vắng có mặt trễ vắng có phép buổi học ghi chú lý do việc thiêng liêng đi lễ đọc kinh thống kê tuần tháng chuyên cần bỏ trạng thái xóa ngày',
    summary: 'Điểm danh từng buổi theo lớp với bốn trạng thái, xem thống kê chuyên cần theo tuần hoặc tháng, và (gói Pro) theo dõi việc thiêng liêng của học viên.',
    steps: [
      'Chọn “lớp” và “ngày” ở đầu trang. Có hai tab: “Giáo lý” (điểm danh buổi học) và “Việc Thiêng liêng”. Có ba chế độ xem: “Ngày”, “Tuần”, “Tháng”.',
      'Ở chế độ “Ngày”, mỗi học viên có bốn trạng thái: “Có mặt”, “Trễ”, “Vắng không phép”, “Vắng có phép”. Chọn “Vắng có phép” sẽ hiện ô nhập lý do nghỉ.',
      'Bấm một trạng thái để chọn; bấm lại đúng trạng thái đó để bỏ chọn. Nút “Đánh dấu tất cả có mặt” đặt nhanh cả lớp, bấm lại thành “Bỏ đánh dấu tất cả”.',
      'Bấm “Lưu điểm danh” để lưu. Em nào để trống trạng thái thì buổi đó của em coi như chưa điểm danh (không bị tính là có mặt). Nếu bỏ hết trạng thái rồi lưu thì ngày đó trở lại chưa điểm danh.',
      'Chuyển sang “Tuần” hoặc “Tháng” để xem thống kê: tỷ lệ đi học trung bình, bảng lưới theo từng ngày, nhóm chuyên cần (đi học từ 80%) và nhóm cần nhắc nhở (dưới 50%). Vắng có phép không bị trừ vào tỷ lệ chuyên cần.',
      'Tab “Việc Thiêng liêng” (gói Pro): bấm “Quản lý việc” để thêm các việc như đi lễ, đọc kinh, xưng tội; sau đó tích cho từng em theo ngày. Cũng có thống kê theo tuần và tháng.',
    ],
    tips: [
      'Xuất phiếu điểm danh hoặc bảng thống kê ra Excel hoặc PDF bằng nút ở góc bảng.',
      'Điểm danh đều đặn giúp thống kê và thi đua cuối kỳ chính xác, không phải cộng tay.',
    ],
  },
  {
    id: 'diemso', title: 'Điểm số', roles: ['admin', 'teacher'],
    tags: 'điểm số bảng điểm nhập điểm kiểm tra xuất excel pdf thi đua xếp hạng',
    summary: 'Nhập và quản lý điểm của học viên theo lớp; xuất bảng điểm ra Excel/PDF.',
    steps: [
      'Chọn lớp, nhập điểm theo các cột kiểm tra. Bảng tự tính và sắp xếp.',
      'Xuất bảng điểm ra Excel hoặc PDF để in hoặc lưu.',
      'Điểm từ bài thi online (nếu dùng) được tự động đưa vào đây, không cần nhập tay.',
    ],
    tips: ['Kết hợp điểm số + điểm danh + việc thiêng liêng để làm bảng thi đua cuối kỳ.'],
  },
  {
    id: 'dethi', title: 'Đề thi & Thi online', roles: ['admin', 'teacher'], pro: true,
    tags: 'đề thi thi online trắc nghiệm mã thi tự chấm câu hỏi custom tự soạn preview tải đề pdf docx',
    summary: 'Soạn đề trắc nghiệm, phát mã cho học viên thi online, hệ thống tự chấm và cập nhật thẳng vào bảng điểm.',
    steps: [
      'Vào “Đề thi” → tạo đề: chọn từ ngân hàng câu hỏi có sẵn hoặc tự soạn câu hỏi riêng cho lớp.',
      'Xem trước (preview) toàn bộ đề; có thể tải đề ra PDF/DOCX để in nếu cần thi giấy.',
      'Phát mã thi cho học viên. Học viên mở link, nhập mã và làm bài trắc nghiệm online.',
      'Nộp bài xong hệ thống tự chấm và ghi điểm vào bảng điểm của lớp, không cần chấm tay.',
    ],
    tips: ['Tự soạn câu hỏi sát bài đã dạy để kiểm tra đúng trọng tâm của lớp mình.'],
  },
  {
    id: 'chungchi', title: 'Chứng chỉ & Giấy khen', roles: ['admin'], pro: true,
    tags: 'chứng chỉ giấy khen hôn nhân giáo lý khung frame xuất in mẫu template',
    summary: 'Xuất chứng chỉ giáo lý hôn nhân và giấy khen cho học viên, chọn khung mẫu sẵn. Chỉ quản trị dùng được.',
    steps: [
      'Vào “Chứng chỉ”, chọn loại: chứng chỉ giáo lý hôn nhân hoặc giấy khen.',
      'Chọn học viên (thông tin cá nhân/gia đình được điền tự động từ hồ sơ) và chọn khung mẫu.',
      'Xem trước rồi xuất để in.',
    ],
    tips: [
      'Điền đủ hồ sơ học viên (và tên/logo giáo xứ trong Cài đặt) trước khi xuất để chứng chỉ hiển thị đầy đủ, đẹp.',
    ],
  },
  {
    id: 'trabai', title: 'Chọn trả bài (bốc thăm)', roles: ['admin', 'teacher'],
    tags: 'chọn trả bài bốc thăm ngẫu nhiên random gọi tên kiểm tra bài cũ',
    summary: 'Bốc thăm ngẫu nhiên một học viên trong lớp để trả bài cho công bằng và sinh động.',
    steps: [
      'Chọn lớp, bấm bốc thăm; hệ thống chọn ngẫu nhiên một học viên.',
    ],
    tips: ['Dùng đầu giờ để kiểm tra bài cũ, tạo không khí và sự công bằng.'],
  },
  {
    id: 'game', title: 'Game học giáo lý', roles: ['admin', 'teacher'],
    tags: 'game trò chơi học giáo lý ai là triệu phú chiếc nón kỳ diệu tự tạo câu hỏi nội dung',
    summary: 'Bộ game học giáo lý biên soạn sẵn, hoặc tự tạo nội dung câu hỏi cho riêng lớp mình.',
    steps: [
      'Vào “Game học”, chọn một game có sẵn để chơi cùng lớp.',
      'Với game hỗ trợ, mở phần “Tạo câu hỏi” để tự nhập nội dung câu hỏi theo bài đang dạy.',
    ],
    tips: ['Dùng game để ôn tập cuối buổi, học viên hứng thú và nhớ bài lâu hơn.'],
  },
  {
    id: 'store', title: 'Ephata Store', roles: ['admin', 'teacher'],
    tags: 'ephata store cửa hàng tính năng mở rộng mua sắm công giáo tài nguyên',
    summary: 'Cửa hàng Công giáo tích hợp: mở khóa thêm tính năng và tài nguyên cho việc dạy giáo lý.',
    steps: [
      'Vào “Ephata Store” để xem các tính năng/tài nguyên có thể thêm.',
      'Đăng nhập Ephata Store (menu tài khoản) dùng chung tài khoản để đồng bộ.',
    ],
    tips: ['Tính năng đã sở hữu sẽ hiển thị “Đã kích hoạt”.'],
  },
  {
    id: 'thuchi', title: 'Thu chi', roles: ['admin', 'teacher'], pro: true,
    tags: 'thu chi kiểm toán quỹ tài chính sổ sách thống kê tiền lớp phụ trách',
    summary: 'Ghi và theo dõi các khoản thu chi, kiểm toán minh bạch. Giáo lý viên quản lý thu chi cho lớp mình phụ trách; quản trị xem toàn giáo xứ.',
    steps: [
      'Vào “Thu chi”, thêm khoản thu hoặc chi kèm nội dung, số tiền, ngày.',
      'Giáo lý viên ghi thu chi cho lớp mình phụ trách; quản trị ghi khoản chung của giáo xứ và xem tổng hợp toàn bộ (lọc theo từng lớp).',
      'Xem tổng hợp số dư và lịch sử để đối soát.',
    ],
    tips: ['Ghi ngay khi phát sinh để cuối kỳ không phải nhớ lại.'],
  },
  {
    id: 'xetduyet', title: 'Kỳ xét duyệt lớp cuối năm', roles: ['admin', 'teacher'], pro: true,
    tags: 'xét duyệt kỳ xét lên lớp chốt lớp cuối năm gửi duyệt cần xem lại phê duyệt kết thúc năm học quy trình',
    summary: 'Quy trình cuối năm gồm bốn bước: quản trị mở kỳ xét lên lớp, mỗi giáo lý viên chốt lớp và gửi lên, quản trị duyệt từng lớp, khi tất cả lớp đã duyệt thì mới lên lớp cho cả giáo xứ.',
    steps: [
      'Quản trị mở kỳ: vào “Lớp học” bấm “📢 Mở kỳ xét lên lớp”. Khi mở, các lớp giáo lý trong năm mới gửi kết quả lên được, có dòng “Đang mở” báo trạng thái. Bấm lại “🔒 Đóng kỳ xét lên lớp” để đóng.',
      'Giáo lý viên chốt lớp: ở lớp mình phụ trách bấm “🏁 Kết thúc lớp”, chọn kết quả từng em (lên lớp hoặc ở lại; lớp ngoài thì đậu hoặc không đạt), rồi bấm “Gửi duyệt”. Lớp chuyển sang “Chờ duyệt”. Có thể sửa và gửi lại khi quản trị chưa duyệt.',
      'Quản trị duyệt: vào “Tổng quan”, mục lớp chờ duyệt liệt kê các lớp đã gửi. Mỗi lớp bấm “Duyệt” để đồng ý, hoặc “Yêu cầu xem lại” kèm ghi chú để trả về cho giáo lý viên sửa. Trang hiện số “X/Y lớp đã duyệt”.',
      'Giáo lý viên theo dõi: trên “Tổng quan” của giáo lý viên có mục chốt lớp cuối năm, hiện “Chờ duyệt”, “Đã duyệt”, hoặc “Cần xem lại” kèm ghi chú của quản trị. Nếu bị trả lại thì sửa rồi gửi lại.',
      'Lên lớp cho cả giáo xứ: khi tất cả lớp giáo lý trong năm đã duyệt, vào “Cài đặt quản lý” bấm “Kết thúc năm học & lên lớp”. Hệ thống áp kết quả từng em: lên lớp thì chuyển lên bậc kế (điểm bắt đầu lại), ở lại thì giữ nguyên lớp; học viên lớp tốt nghiệp được lên lớp sẽ ra trường. Dữ liệu năm cũ đóng băng, tra cứu ở tab “Lưu trữ”.',
    ],
    tips: [
      'Chức năng “Kết thúc năm học & lên lớp” chỉ chạy khi đã duyệt hết các lớp giáo lý trong năm. Nếu còn lớp chưa duyệt, hệ thống báo lỗi và liệt kê các lớp còn thiếu, chưa chuyển học viên sang năm mới.',
      'Lớp giáo lý ngoại thường (hôn nhân, dự tòng) được duyệt riêng và không ảnh hưởng tới việc lên lớp cuối năm.',
      'Trước khi lên lớp, nhớ gắn nhãn lớp tốt nghiệp ở trang “Lớp học” để hệ thống biết lớp nào ra trường.',
    ],
  },
  {
    id: 'luutru', title: 'Lưu trữ niên khóa & Lên lớp', roles: ['admin'], pro: true,
    tags: 'lưu trữ niên khóa năm học lên lớp tự động kết thúc năm archive tốt nghiệp chuyển năm',
    summary: 'Cuối năm học: tự động cho học viên lên lớp và lưu trữ dữ liệu niên khóa cũ để tra cứu về sau. Chỉ quản trị dùng được.',
    steps: [
      'Vào “Lưu trữ”, chạy chức năng kết thúc niên khóa: học viên được đưa lên lớp kế tiếp theo cấu hình.',
      'Dữ liệu năm cũ (điểm danh, điểm số…) được lưu trữ theo niên khóa, có thể xem lại bất cứ lúc nào.',
    ],
    tips: [
      'Chỉ chạy lên lớp khi đã hoàn tất điểm số và chứng chỉ của năm hiện tại, vì thao tác này chuyển toàn bộ học viên sang năm mới.',
    ],
  },
  {
    id: 'thongbao', title: 'Gửi thông báo', roles: ['admin'], pro: true,
    tags: 'thông báo gửi tin nhắn nhắc nhở giáo lý viên chuông',
    summary: 'Quản trị soạn và gửi thông báo tới giáo lý viên trong giáo xứ. Chỉ quản trị dùng được.',
    steps: [
      'Vào “Gửi thông báo”, chọn người nhận, nhập tiêu đề và nội dung rồi gửi.',
      'Giáo lý viên nhận thông báo ở chuông góc trên phải; chuông hiển thị số thông báo chưa đọc.',
    ],
    tips: ['Khi quản trị mở kỳ xét lên lớp, giáo lý viên thấy trạng thái duyệt hoặc cần xem lại ngay trên Tổng quan của họ.'],
  },
  {
    id: 'caidat', title: 'Cài đặt quản lý', roles: ['admin'],
    tags: 'cài đặt settings thông tin giáo xứ logo giáo phận xét duyệt lớp niên khóa thêm quản trị viên admin',
    summary: 'Thông tin giáo xứ (tên, giáo phận, logo), thêm quản trị viên và các thiết lập vận hành. Chỉ quản trị.',
    steps: [
      'Mở menu tài khoản (góc trên phải) → “Cài đặt quản lý”.',
      'Cập nhật tên giáo xứ, giáo phận, logo; các thiết lập niên khóa và kỳ xét duyệt lớp.',
      'Gói Pro: mục “Quản trị viên giáo xứ” cho phép thêm quản trị viên khác bằng cách nhập họ tên, email và mật khẩu tạm. Các quản trị viên có quyền ngang nhau (toàn quyền trên giáo xứ).',
    ],
    tips: ['Tên và logo ở đây xuất hiện trên đầu ứng dụng và trên chứng chỉ/giấy khen.', 'Nên cho quản trị viên mới đổi mật khẩu sau khi đăng nhập lần đầu.'],
  },
  {
    id: 'goi', title: 'Gói dịch vụ & Nâng cấp', roles: ['admin'],
    tags: 'gói pro khởi động nâng cấp thanh toán mã khuyến mãi giảm giá backtoschool niên khóa số lớp',
    summary: 'Gói Pro tính theo giáo xứ mỗi niên khóa, chia mức theo số lớp; nhập mã khuyến mãi để nâng Pro miễn phí.',
    steps: [
      'Bấm “Xem gói & nâng cấp” ở thẻ gói (thanh bên trái) để xem các mức Pro theo số lớp.',
      'Nếu có mã nâng Pro miễn phí (vd BACKTOSCHOOL): nhập vào ô “🎁 Có mã khuyến mãi?” ở bước chọn gói → Pro kích hoạt ngay.',
      'Nếu thanh toán: chọn mức, tạo đơn và chuyển khoản theo mã QR; Pro kích hoạt sau khi đối soát.',
    ],
    tips: [
      'Ô “Mã giảm giá” ở bước thanh toán chỉ dành cho mã giảm %/giảm tiền. Mã nâng Pro miễn phí phải nhập ở ô “🎁 Có mã khuyến mãi?” ở bước chọn gói.',
    ],
  },
  {
    id: 'giahan', title: 'Gia hạn & chính sách dữ liệu', roles: ['admin'], pro: true,
    tags: 'gia hạn hết hạn nhắc nhở cộng dồn khóa tài khoản mất dữ liệu xóa data sao lưu backup miễn trừ trách nhiệm chính sách',
    summary: 'Cách hệ thống nhắc gia hạn, quy tắc cộng dồn thời gian, và chính sách dữ liệu khi gói Pro hết hạn mà không gia hạn.',
    steps: [
      'Nhắc trước hạn: từ 30 ngày trước khi hết hạn, hệ thống nhắc qua email và banner trong ứng dụng, lặp lại mỗi 3 ngày cho tới khi gia hạn. Hạn còn lại cũng hiển thị ngay cạnh ảnh đại diện.',
'Gia hạn hoặc đổi gói mọi lúc: bắt đầu một chu kỳ 1 năm mới tính từ hôm nay. Phần còn thừa của gói hiện tại được quy đổi thành tiền (credit) và trừ vào số phải trả, không mất phần chưa dùng. Ví dụ đang dùng gói nhỏ còn 6 tháng mà lên gói lớn hơn thì chỉ trả phần chênh sau khi trừ credit.',
      'Gia hạn: bấm nút “Gia hạn ngay” trên banner (hoặc “Xem gói & nâng cấp”) → hiện mã QR thanh toán; sau khi đối soát, Pro được kích hoạt và banner biến mất.',
    ],
    tips: [
      'Nếu KHÔNG gia hạn: khi hết hạn, ứng dụng bị khóa bằng banner yêu cầu gia hạn. Dữ liệu giáo xứ sẽ bị xóa sau 30 ngày kể từ ngày hết hạn. Hãy gia hạn hoặc tải/sao lưu dữ liệu (xuất Excel/PDF, tải bản lưu trữ) trước thời hạn để tránh mất mát.',
      'Miễn trừ trách nhiệm: Giáo Lý Số không chịu trách nhiệm về việc mất dữ liệu do giáo xứ không gia hạn đúng hạn hoặc không sao lưu dữ liệu kịp thời trong thời gian 30 ngày kể từ khi hết hạn.',
    ],
  },
];

function Badge({ children, tone }) {
  return <span className={`gd-badge ${tone || ''}`}>{children}</span>;
}

export default function Guide() {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState(GUIDE[0].id);
  const nq = norm(q.trim());

  const filtered = useMemo(() => {
    if (!nq) return GUIDE;
    return GUIDE.filter((s) => {
      const hay = norm([s.title, s.tags, s.summary, ...(s.steps || []), ...(s.tips || [])].join(' '));
      return nq.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [nq]);

  // Nếu mục đang chọn không còn trong kết quả lọc, chuyển về mục đầu tiên.
  useEffect(() => {
    if (filtered.length && !filtered.some((s) => s.id === activeId)) setActiveId(filtered[0].id);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrollspy: tự làm nổi bật mục đang hiển thị khi cuộn (trừ 74px topbar).
  useEffect(() => {
    const els = filtered.map((s) => document.getElementById('gd-' + s.id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting);
      if (vis.length) {
        vis.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveId(vis[0].target.id.replace('gd-', ''));
      }
    }, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [filtered]);

  const jump = (id) => {
    setActiveId(id);
    document.getElementById('gd-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="guide-wrap">
      <div className="guide-head">
        <h1>Hướng dẫn sử dụng</h1>
        <p className="muted">Giới thiệu các chức năng và quy trình vận hành của Giáo Lý Số. Mục có nhãn <b>PRO</b> là tính năng của gói Pro. Gõ từ khóa để tìm nhanh (không cần dấu).</p>
        <div className="guide-search">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm chức năng… vd: điểm danh, thi online, chứng chỉ, lên lớp" autoFocus />
          {q && <button className="gd-clear" onClick={() => setQ('')} aria-label="Xóa">✕</button>}
        </div>
      </div>

      <div className="guide-body">
        <aside className="guide-toc">
          <div className="gd-toc-title">Mục lục</div>
          {(nq ? filtered : GUIDE).map((s) => (
            <button key={s.id} className={activeId === s.id ? 'active' : ''} onClick={() => jump(s.id)}>{s.title}</button>
          ))}
          {nq && filtered.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '6px 4px' }}>Không có kết quả</div>}
        </aside>

        <div className="guide-main">
          {nq && (
            <div className="muted" style={{ marginBottom: 12, fontSize: 13.5 }}>
              {filtered.length > 0 ? `Tìm thấy ${filtered.length} mục cho “${q}”.` : `Không tìm thấy mục nào cho “${q}”. Thử từ khóa khác như “điểm”, “thi”, “lớp”, “gói”.`}
            </div>
          )}

          {filtered.map((s) => (
            <section className={`gd-card${activeId === s.id ? ' active' : ''}`} id={'gd-' + s.id} key={s.id}>
              <div className="gd-card-head">
                <h2>{s.title}</h2>
                <span className="gd-badges">
                  {s.roles.includes('admin') && !s.roles.includes('teacher')
                    ? <Badge tone="admin">Quản trị</Badge>
                    : <Badge>Quản trị &amp; GLV</Badge>}
                  {s.pro && <Badge tone="pro">PRO</Badge>}
                </span>
              </div>
              <p className="gd-summary">{ui(s.summary)}</p>
              {s.steps?.length > 0 && (
                <>
                  <div className="gd-sub">Quy trình</div>
                  <ol className="gd-steps">{s.steps.map((t, i) => <li key={i}>{ui(t)}</li>)}</ol>
                </>
              )}
              {s.tips?.map((t, i) => (
                <div className="gd-tip" key={i}><b>Mẹo:</b> {ui(t)}</div>
              ))}
            </section>
          ))}

          <div className="gd-foot">
            Cần hỗ trợ thêm? Dùng “💬 Góp ý / liên hệ tác giả” ở thanh bên, hoặc Zalo <b>0964 013 126</b>.
          </div>
        </div>
      </div>
    </div>
  );
}
