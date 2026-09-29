import React from 'react';
import { X, BookOpen, Camera, CheckCircle2, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Quy Trình & Hướng Dẫn Sử Dụng Chuẩn
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Nguyên Tắc Cốt Lõi Về Độ Chính Xác & Công Bằng
            </h4>
            <p className="text-amber-800">
              1. Tách riêng quá trình nhận dạng chữ viết tay (OCR) và quá trình chấm điểm.
              <br />
              2. Không tự đoán chữ không đọc được rồi dùng phần đoán để trừ điểm học sinh.
              <br />
              3. Điểm số dựa trên tiêu chí và bằng chứng trích dẫn thực tế trong bài làm.
              <br />
              4. Giáo viên có quyền sửa bản chép, điều chỉnh điểm và luôn là người duyệt kết quả cuối cùng.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              Quy trình 6 bước khép kín
            </h4>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 1: Thiết lập đợt chấm & Tiêu chí</p>
                <p className="text-slate-500 mt-0.5">
                  Nhập tên bài thi, khối lớp, đề bài và đáp án. Nếu chưa có đáp án, AI sẽ tự động phân tích đề để đề xuất bảng tiêu chí chuẩn mực trên thang 10.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 2: Chụp hoặc tải bài làm</p>
                <p className="text-slate-500 mt-0.5">
                  • <strong>Trên điện thoại:</strong> Dùng camera sau để chụp liên tục các trang của một học sinh. Khi xong bài, nhấn <em>"Kết thúc bài – Sang học sinh tiếp theo"</em>.
                  <br />
                  • <strong>Trên máy tính:</strong> Kéo thả hàng loạt ảnh hoặc file PDF, dán ảnh (Ctrl+V) tiện lợi.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 3: Nhận dạng chữ viết tay tiếng Việt</p>
                <p className="text-slate-500 mt-0.5">
                  AI trích xuất họ tên, lớp, giữ nguyên lỗi chính tả, ngắt dòng, nhận biết chữ gạch xóa, chữ chèn thêm. Các chữ mờ được đánh dấu là <code>[không đọc rõ]</code> kèm 2-3 phương án gợi ý.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 4: Kiểm tra và xác nhận bản chép</p>
                <p className="text-slate-500 mt-0.5">
                  Đối chiếu ảnh gốc cạnh bản chép (trên PC) hoặc chuyển đổi tab linh hoạt (trên điện thoại). Giáo viên sửa lỗi nhận dạng nếu có và nhấn <em>"Xác nhận bản chép"</em>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 5: Chấm chi tiết & Đề xuất điểm</p>
                <p className="text-slate-500 mt-0.5">
                  Hệ thống chấm từng câu theo bằng chứng trích xuất nguyên văn, chấp nhận cách cảm thụ độc lập hợp lý. Phân tách rõ <em>"Lỗi cần sửa"</em> và <em>"Gợi ý bài viết hay hơn"</em>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Bước 6: Giáo viên duyệt & Xuất bảng điểm</p>
                <p className="text-slate-500 mt-0.5">
                  Giáo viên ghi lời phê, điều chỉnh điểm nếu muốn và bấm <em>"Duyệt kết quả"</em>. Sau đó xuất bảng điểm Excel (.xlsx), phiếu nhận xét từng học sinh (.doc), hoặc sao lưu toàn bộ đợt chấm.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs"
          >
            Đã hiểu, quay lại làm việc
          </button>
        </div>
      </div>
    </div>
  );
};
