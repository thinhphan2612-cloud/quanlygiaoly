// Câu có đáp án chỉ tới vị trí các đáp án khác ("Cả A và B đều đúng", "Tất cả các ý trên"...)
// thì KHÔNG được xáo thứ tự đáp án, nếu không chữ A/B và "ở trên" sẽ sai nghĩa.
// Đã kiểm trên ngân hàng 1001 câu: bắt đúng 264 câu, không bắt nhầm câu có chữ "trên" theo nghĩa thường.
// Không dùng lookbehind (?<!...): Safari dưới 16.4 (iPhone cũ của học viên) không hỗ trợ, sẽ hỏng cả trang thi.
const LETTER = /(^|[^\p{L}\p{N}])[A-F]\s*(,|và|hoặc)\s*[A-F](?![\p{L}\p{N}])|(^|[^\p{L}\p{N}])(Câu|Ý|Đáp án|câu|ý|đáp án)\s+[A-F](?![\p{L}\p{N}])/u;
const WORDS = /(^|[^\p{L}])(ý|câu|đáp án|điều|việc)\s+(ở\s+|kể\s+)?trên(?![\p{L}])|(^|[^\p{L}])kể\s+trên(?![\p{L}])|tất cả\s+(các|những)\s+\p{L}+\s+trên(?![\p{L}])|tất cả\s+(các\s+)?(ý|câu|đáp án|điều)(?![\p{L}])|tất cả\s+đều\s+(đúng|sai)|cả\s+(hai|ba|bốn|2|3|4)\s+(đều\s+(đúng|sai)|ý|câu|đáp án|điều)(?![\p{L}])|không\s+(có\s+)?(ý|câu|đáp án|điều)\s+nào/iu;

// Đáp án nào phải đứng yên khi xáo:
//  - có "Cả A và B", "Câu B và C"... -> giữ nguyên TẤT CẢ (chữ cái chỉ đúng khi không xáo);
//  - chỉ có "Tất cả các ý trên", "Không ý nào"... -> ghim riêng đáp án đó, các đáp án còn lại vẫn xáo.
export function pinnedOptions(options) {
  const os = (options || []).map(String);
  if (os.some((o) => LETTER.test(o))) return os.map((_, i) => i);
  return os.map((o, i) => (WORDS.test(o) ? i : -1)).filter((i) => i >= 0);
}
// Không xáo được đáp án nào (để hiện nhãn ở trang soạn đề)
export const keepOptionOrder = (options) => (options || []).length > 0 && pinnedOptions(options).length >= options.length;
