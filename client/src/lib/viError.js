// Dịch thông báo lỗi kỹ thuật (Postgres / Supabase / Auth) sang tiếng Việt dễ hiểu.
// Thông báo vốn đã là tiếng Việt (hoặc không khớp mẫu nào) thì giữ nguyên.
export function viError(raw) {
  const m = String(raw ?? '').trim();
  if (!m) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const has = (re) => re.test(m);

  // --- Đăng nhập / tài khoản ---
  if (has(/invalid login credentials/i)) return 'Email hoặc mật khẩu không đúng.';
  if (has(/email not confirmed/i)) return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư (kể cả mục Spam).';
  if (has(/already (been )?registered|user already exists|email_exists/i)) return 'Email này đã được dùng cho một tài khoản khác. Vui lòng dùng email khác.';
  if (has(/password should be at least|password.*too short|at least 6/i)) return 'Mật khẩu quá ngắn (tối thiểu 6 ký tự).';
  if (has(/new password should be different|different from the old/i)) return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (has(/for security purposes.*after|only request this after/i)) return 'Vì lý do bảo mật, vui lòng thử lại sau ít giây.';
  if (has(/unable to validate email|invalid email/i)) return 'Địa chỉ email không hợp lệ.';
  if (has(/signups? not allowed|signup is disabled/i)) return 'Chức năng đăng ký hiện đang tạm khóa.';
  if (has(/jwt|token.*(expired|invalid)|auth session missing|not authenticated|session.*(expired|missing)/i)) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

  // --- Cơ sở dữ liệu (Postgres / RLS) ---
  if (has(/row-level security|violates row-level/i)) return 'Bạn không có quyền thao tác trên dữ liệu này. Nếu là giáo lý viên, bạn chỉ làm việc được trong lớp mình phụ trách.';
  if (has(/permission denied/i)) return 'Bạn không có quyền thực hiện thao tác này.';
  if (has(/duplicate key|already exists|unique constraint/i)) return 'Dữ liệu đã tồn tại (bị trùng). Vui lòng kiểm tra lại.';
  if (has(/foreign key/i)) return 'Không thể thực hiện vì dữ liệu này đang liên kết với mục khác.';
  if (has(/not-null|null value in column|violates not-null/i)) return 'Còn thiếu thông tin bắt buộc. Vui lòng điền đầy đủ.';
  if (has(/check constraint|invalid input|out of range/i)) return 'Dữ liệu nhập chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (has(/column .* does not exist|could not find|schema cache/i)) return 'Có mục dữ liệu chưa được cập nhật trên hệ thống. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';

  // --- Mạng / máy chủ ---
  if (has(/failed to fetch|network ?error|network request failed|load failed/i)) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  if (has(/timeout|timed out/i)) return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
  if (has(/rate limit|too many requests/i)) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  if (has(/internal server error|bad gateway|service unavailable/i)) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.';

  // Đã là tiếng Việt (có dấu) -> giữ nguyên
  if (/[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(m)) return m;
  // Chuỗi thuần ASCII còn lại (khả năng cao là lỗi kỹ thuật tiếng Anh) -> thông báo chung
  if (/^[\x00-\x7F]*$/.test(m)) return 'Thao tác không thành công. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
  return m;
}
