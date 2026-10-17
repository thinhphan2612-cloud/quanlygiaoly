// Bài tập thực hành trong trang Hướng dẫn sử dụng.
// Mỗi bước: route (trang cần mở), target (giá trị data-tour của phần tử được tô sáng), title, body,
// action: 'click' = người dùng bấm đúng phần tử thì tự sang bước sau; wait = thời gian chờ phần tử xuất hiện (ms).
// writes: bài có bước ghi dữ liệu thật (được nhắc rõ ở bước đó, người dùng tự quyết có bấm Lưu hay không).
export const TOUR_GROUPS = ['Thiết lập giáo xứ', 'Việc hằng ngày', 'Thi & cuối năm'];

export const TOURS = [
  {
    id: 'setup-parish', group: 'Thiết lập giáo xứ', roles: ['admin'], minutes: 1, writes: true,
    title: 'Điền thông tin giáo xứ',
    desc: 'Tên và logo giáo xứ hiện trên đầu ứng dụng và trên chứng chỉ, nên làm đầu tiên.',
    steps: [
      { route: '/settings', target: 'parish-name', title: 'Tên giáo xứ', body: 'Nhập đầy đủ tên giáo xứ, ví dụ "Giáo xứ Tân Định". Bên cạnh là ô Giáo phận.' },
      { route: '/settings', target: 'parish-logo', title: 'Logo giáo xứ', body: 'Tải lên logo (ảnh vuông càng tốt). Logo hiện cạnh tên giáo xứ ở góc trái và trên giấy chứng nhận.' },
      { route: '/settings', target: 'parish-save', title: 'Lưu thông tin', body: 'Bấm "Lưu thông tin giáo xứ" để ghi lại. Lưu ý: thao tác này lưu thật vào giáo xứ của bạn.' },
    ],
  },
  {
    id: 'create-class', group: 'Thiết lập giáo xứ', roles: ['admin'], minutes: 2, writes: true,
    title: 'Tạo lớp học',
    desc: 'Tạo các lớp theo khối / ngành trước, rồi mới nạp học viên vào từng lớp.',
    steps: [
      { route: '/classes', target: 'class-add', action: 'click', title: 'Thêm lớp mới', body: 'Bấm "+ Thêm lớp" để mở form tạo lớp.' },
      { route: '/classes', target: 'class-form-name', title: 'Đặt tên lớp', body: 'Nhập tên lớp, ví dụ "Khai tâm 1". Bạn có thể điền thêm niên khóa, phòng học, lịch học và giáo lý viên phụ trách.' },
      { route: '/classes', target: 'class-form-save', title: 'Lưu lớp', body: 'Bấm "Lưu" sẽ tạo lớp thật. Nếu chỉ đang tập, bấm "Hủy" để đóng form rồi bấm "Hoàn thành" ở khung này.' },
    ],
  },
  {
    id: 'add-teacher', group: 'Thiết lập giáo xứ', roles: ['admin'], pro: true, minutes: 2, writes: true,
    title: 'Tạo tài khoản giáo lý viên',
    desc: 'Mỗi giáo lý viên có tài khoản riêng và chỉ thấy lớp mình phụ trách.',
    steps: [
      { route: '/teachers', target: 'teacher-add', action: 'click', title: 'Thêm giáo lý viên', body: 'Bấm "+ Thêm giáo lý viên" để mở form.' },
      { route: '/teachers', target: 'teacher-form-email', title: 'Email đăng nhập', body: 'Nhập email giáo lý viên sẽ dùng để đăng nhập. Điền thêm họ tên (ô phía trên) và mật khẩu ban đầu (ô phía dưới).' },
      { route: '/teachers', target: 'teacher-form-save', title: 'Tạo tài khoản', body: 'Bấm "Tạo tài khoản" sẽ tạo thật, giáo lý viên đăng nhập được ngay; sau đó vào trang Lớp học để gán lớp. Nếu chỉ đang tập, bấm "Hủy" rồi bấm "Hoàn thành" ở khung này.' },
    ],
  },
  {
    id: 'import-students', group: 'Thiết lập giáo xứ', roles: ['admin', 'teacher'], minutes: 3, writes: true,
    title: 'Nhập học viên từ Excel',
    desc: 'Nạp nhanh cả danh sách lớp bằng file Excel thay vì thêm từng em.',
    steps: [
      { route: '/students', target: 'stu-import', action: 'click', title: 'Mở Nhập hàng loạt', body: 'Bấm "Nhập hàng loạt" để mở công cụ nhập từ Excel.' },
      { route: '/students', target: 'import-class', title: 'Chọn lớp', body: 'Chọn lớp sẽ xếp các em vào. Nên nạp theo từng lớp để danh sách gọn gàng.' },
      { route: '/students', target: 'import-template', title: 'Tải form mẫu', body: 'Tải file Excel mẫu, điền danh sách học viên đúng theo các cột có sẵn.' },
      { route: '/students', target: 'import-upload', title: 'Tải file lên', body: 'Chọn file đã điền. Hệ thống hiện bảng xem trước để bạn kiểm tra từng dòng.' },
      { route: '/students', target: 'import-confirm', title: 'Nhập vào hệ thống', body: 'Kiểm tra bảng xem trước rồi bấm "Nhập". Thao tác này thêm học viên thật. Nếu chỉ đang tập, đóng cửa sổ rồi bấm "Hoàn thành" ở khung này.' },
    ],
  },
  {
    id: 'find-student', group: 'Việc hằng ngày', roles: ['admin', 'teacher'], minutes: 1,
    title: 'Tìm và xem hồ sơ học viên',
    desc: 'Tra cứu nhanh một em, lọc theo lớp và chọn cột thông tin muốn xem.',
    steps: [
      { route: '/students', target: 'stu-search', title: 'Tìm theo tên', body: 'Gõ vài chữ trong tên để lọc ngay danh sách.' },
      { route: '/students', target: 'stu-filter', title: 'Lọc và sắp xếp', body: 'Lọc theo lớp, theo bí tích, hoặc sắp xếp theo chuyên cần.' },
      { route: '/students', target: 'stu-cols', title: 'Chọn cột hiển thị', body: 'Chọn những cột muốn xem (phụ huynh, địa chỉ, ngày rửa tội...). Lựa chọn được nhớ theo tài khoản.' },
      { route: '/students', target: 'stu-name', title: 'Mở hồ sơ', body: 'Bấm vào tên một em để mở hồ sơ chi tiết: thông tin gia đình, bí tích, điểm danh, điểm số.' },
    ],
  },
  {
    id: 'attendance', group: 'Việc hằng ngày', roles: ['admin', 'teacher'], minutes: 2, writes: true,
    title: 'Điểm danh một buổi học',
    desc: 'Việc làm mỗi buổi: chọn lớp, đánh dấu từng em rồi lưu.',
    steps: [
      { route: '/attendance', target: 'att-class', title: 'Chọn lớp', body: 'Chọn lớp cần điểm danh. Lần sau mở trang sẽ tự chọn sẵn lớp này.' },
      { route: '/attendance', target: 'att-date', title: 'Chọn ngày', body: 'Mặc định là hôm nay. Bấm ‹ › để lùi hoặc tiến một tuần khi điểm danh bù buổi trước.' },
      { route: '/attendance', target: 'att-status', title: 'Đánh dấu từng em', body: 'Bấm Có mặt, Trễ, Vắng (không phép) hoặc Có phép. Bấm lại lần nữa để bỏ chọn. Có nút "Đánh dấu tất cả có mặt" ở phía trên cho nhanh.', missingText: 'Lớp này chưa có học viên nên chưa có gì để điểm danh. Bấm Tiếp để xem bước sau.' },
      { route: '/attendance', target: 'att-summary', title: 'Xem tổng kết', body: 'Dòng tổng kết cập nhật ngay khi bạn bấm, dễ đối chiếu sĩ số.' },
      { route: '/attendance', target: 'att-save', title: 'Tự động lưu', body: 'Điểm danh được tự lưu ngay sau mỗi lần bấm, dòng này cho biết đã lưu lúc mấy giờ. Trong lúc làm bài tập, thay đổi không được lưu nên bạn cứ bấm thử.' },
    ],
  },
  {
    id: 'grades', group: 'Việc hằng ngày', roles: ['admin', 'teacher'], minutes: 2, writes: true,
    title: 'Nhập điểm cho lớp',
    desc: 'Tạo cột điểm rồi nhập điểm trực tiếp trên bảng.',
    steps: [
      { route: '/grades', target: 'grades-class', title: 'Chọn lớp', body: 'Chọn lớp cần nhập điểm.' },
      { route: '/grades', target: 'grades-cols', title: 'Cột điểm', body: 'Tạo các cột điểm như "Kiểm tra 15 phút", "Thi học kỳ 1" kèm hệ số. Mỗi lớp có bộ cột riêng.' },
      { route: '/grades', target: 'grades-table', title: 'Nhập điểm', body: 'Gõ điểm vào từng ô rồi bấm Enter để xuống em kế tiếp. Điểm được lưu ngay khi rời khỏi ô (lưu thật). Điểm trung bình và thứ hạng tự tính.', missingText: 'Lớp này chưa có cột điểm hoặc chưa có học viên nên chưa hiện bảng điểm. Tạo cột điểm trước rồi làm lại bài này.' },
      { route: '/grades', target: 'grades-export', title: 'Xuất bảng điểm', body: 'Xuất ra Excel hoặc PDF để in hoặc gửi ban giáo lý.' },
    ],
  },
  {
    id: 'random', group: 'Việc hằng ngày', roles: ['admin', 'teacher'], minutes: 1,
    title: 'Chọn học sinh trả bài',
    desc: 'Bốc thăm ngẫu nhiên bằng cuộc đua vui nhộn, chiếu lên màn hình cho cả lớp xem.',
    steps: [
      { route: '/random', target: 'random-class', title: 'Chọn lớp', body: 'Chọn lớp đang học.' },
      { route: '/random', target: 'random-start', action: 'click', title: 'Bắt đầu đua', body: 'Bấm "Bắt đầu đua". Em về đích đầu tiên là người lên trả bài.' },
      { route: '/random', target: 'random-notlearned', wait: 30000, title: 'Ghi nhận chưa thuộc bài', body: 'Nếu em chưa thuộc bài, bấm "Chưa thuộc bài" để ghi nhận. Bấm "Bắt đầu đua" lần nữa để chọn em tiếp theo.' },
    ],
  },
  {
    id: 'exam', group: 'Thi & cuối năm', roles: ['admin', 'teacher'], pro: true, minutes: 3, writes: true,
    title: 'Tạo đề thi online',
    desc: 'Soạn đề trắc nghiệm từ ngân hàng hơn 1.000 câu, học viên làm bài trên điện thoại.',
    steps: [
      { route: '/exams', target: 'exam-add', action: 'click', title: 'Tạo đề mới', body: 'Bấm "+ Tạo đề" để mở trang soạn đề.' },
      { route: '/exams', target: 'exam-title', title: 'Tên đề', body: 'Đặt tên đề, ví dụ "Kiểm tra 15 phút Bài 5".' },
      { route: '/exams', target: 'exam-class', title: 'Lớp thi', body: 'Chọn lớp sẽ làm đề này.' },
      { route: '/exams', target: 'exam-random', title: 'Bốc câu hỏi', body: 'Chọn chủ đề và số câu rồi bấm "Bốc ngẫu nhiên", hoặc tick chọn từng câu trong ngân hàng.' },
      { route: '/exams', target: 'exam-save', title: 'Tạo đề', body: 'Bấm "Tạo đề" để lưu đề (lưu thật), sau đó mở phòng thi và gửi mã cho học viên. Nếu chỉ đang tập, bấm "Hoàn thành" ở khung này rồi quay lại danh sách đề.' },
    ],
  },
  {
    id: 'end-year', group: 'Thi & cuối năm', roles: ['admin'], pro: true, minutes: 2,
    title: 'Xét lên lớp và kết thúc năm học',
    desc: 'Quy trình cuối năm: giáo lý viên gửi kết quả, quản trị duyệt rồi chuyển sang năm mới.',
    steps: [
      { route: '/classes', target: 'class-promotion', title: 'Mở kỳ xét lên lớp', body: 'Cuối năm, bấm "Mở kỳ xét lên lớp" để giáo lý viên gửi kết quả lên lớp / ở lại của từng em. Bài tập này chỉ xem, không cần bấm.' },
      { route: '/', target: 'dash-reviews', title: 'Duyệt kết quả', body: 'Kết quả giáo lý viên gửi lên hiện ở trang Tổng quan để bạn duyệt hoặc trả lại.', missingText: 'Hiện chưa có lớp nào gửi kết quả nên mục duyệt chưa hiện. Bấm Tiếp để xem bước cuối.' },
      { route: '/grades', target: 'grades-endyear', title: 'Kết thúc năm học', body: 'Khi mọi lớp đã được duyệt, bấm nút ⋯ này rồi chọn "Kết thúc năm học, lên lớp" để chuyển cả giáo xứ sang năm mới. Chỉ làm một lần mỗi năm, đừng bấm khi đang tập.' },
    ],
  },
];
