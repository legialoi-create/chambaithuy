import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Check,
  ArrowRight,
  Save,
  School,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { ExamSession } from '../types';

interface SessionConfigViewProps {
  session: ExamSession;
  onSaveSession: (updatedSession: ExamSession) => void;
  onNavigateToOrganizer: () => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const SessionConfigView: React.FC<SessionConfigViewProps> = ({
  session,
  onSaveSession,
  onNavigateToOrganizer,
  showToast,
}) => {
  const [title, setTitle] = useState(session.title);
  const [school, setSchool] = useState(session.school);
  const [gradeLevel, setGradeLevel] = useState(session.gradeLevel);
  const [className, setClassName] = useState(session.className);
  const [durationMinutes, setDurationMinutes] = useState(session.durationMinutes);
  const [roundingRule, setRoundingRule] = useState(session.roundingRule);

  // Save session configuration
  const handleSaveOnly = () => {
    const updated: ExamSession = {
      ...session,
      title,
      school,
      gradeLevel,
      className,
      durationMinutes,
      roundingRule,
      updatedAt: new Date().toISOString(),
    };
    onSaveSession(updated);
    showToast?.('Đã lưu cấu hình đợt chấm thành công!', 'success');
  };

  const handleSaveAndContinue = () => {
    handleSaveOnly();
    onNavigateToOrganizer();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-amber-600/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full border border-white/30">
                  Bước 1 Khởi Tạo
                </span>
                <span className="text-xs text-amber-100 font-semibold">Chương trình GDPT 2018 THCS</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight mt-0.5">
                1. Cấu Hình Đợt Chấm Ngữ Văn THCS
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 mt-1 max-w-2xl leading-relaxed">
                Thiết lập thông tin bài kiểm tra, khối lớp và quy cách làm tròn trước khi thu nạp bài học sinh. Đề thi, đáp án và tiêu chí chấm chi tiết được quản lý trực tiếp tại màn hình Chấm chi tiết.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndContinue}
              className="px-5 py-3 bg-white hover:bg-amber-50 text-amber-950 font-extrabold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <span>Tiếp tục: Sang 2. Đưa bài học sinh vào</span>
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 sm:p-7 space-y-6">
          {/* THCS Quick Presets Selection */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 space-y-3">
            <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Chọn nhanh mẫu đợt kiểm tra THCS (Chương trình GDPT 2018):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 6');
                  setSchool('THCS Lê Lợi');
                  setGradeLevel('Lớp 6 (THCS)');
                  setClassName('6A1');
                  showToast?.('Đã nạp mẫu kiểm tra Ngữ văn Lớp 6', 'info');
                }}
                className={`p-3.5 bg-white hover:bg-amber-100/50 border rounded-2xl text-left text-xs transition-all shadow-2xs ${
                  gradeLevel.includes('6') ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/50 font-bold' : 'border-slate-200'
                }`}
              >
                <span className="font-black block text-slate-900 text-sm">Lớp 6</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Đọc hiểu & Trải nghiệm</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 7');
                  setSchool('THCS Trưng Vương');
                  setGradeLevel('Lớp 7 (THCS)');
                  setClassName('7B');
                  showToast?.('Đã nạp mẫu kiểm tra Ngữ văn Lớp 7', 'info');
                }}
                className={`p-3.5 bg-white hover:bg-amber-100/50 border rounded-2xl text-left text-xs transition-all shadow-2xs ${
                  gradeLevel.includes('7') ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/50 font-bold' : 'border-slate-200'
                }`}
              >
                <span className="font-black block text-slate-900 text-sm">Lớp 7</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Thơ & Đoạn văn biểu cảm</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 8');
                  setSchool('THCS Nguyễn Du');
                  setGradeLevel('Lớp 8 (THCS)');
                  setClassName('8A2');
                  showToast?.('Đã nạp mẫu kiểm tra Ngữ văn Lớp 8', 'info');
                }}
                className={`p-3.5 bg-white hover:bg-amber-100/50 border rounded-2xl text-left text-xs transition-all shadow-2xs ${
                  gradeLevel.includes('8') ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/50 font-bold' : 'border-slate-200'
                }`}
              >
                <span className="font-black block text-slate-900 text-sm">Lớp 8</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Truyện ngắn & Tự sự</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 9');
                  setSchool('THCS Chu Văn An');
                  setGradeLevel('Lớp 9 (THCS)');
                  setClassName('9A1');
                  showToast?.('Đã nạp mẫu kiểm tra Ngữ văn Lớp 9', 'info');
                }}
                className={`p-3.5 bg-white hover:bg-amber-100/50 border rounded-2xl text-left text-xs transition-all shadow-2xs ${
                  gradeLevel.includes('9') ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/50 font-bold' : 'border-slate-200'
                }`}
              >
                <span className="font-black block text-slate-900 text-sm">Lớp 9</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Nghị luận xã hội & Văn học</span>
              </button>
            </div>
          </div>

          {/* Input Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên bài kiểm tra THCS
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-900"
                placeholder="Ví dụ: Kiểm tra Đánh giá Định kỳ Ngữ văn 9"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <School className="w-4 h-4 text-amber-600" />
                Trường THCS
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                placeholder="Trường THCS Chu Văn An"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Khối Lớp
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white font-semibold"
                >
                  <option value="Lớp 6 (THCS)">Lớp 6 (THCS)</option>
                  <option value="Lớp 7 (THCS)">Lớp 7 (THCS)</option>
                  <option value="Lớp 8 (THCS)">Lớp 8 (THCS)</option>
                  <option value="Lớp 9 (THCS)">Lớp 9 (THCS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lớp
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                  placeholder="9A1"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Thời gian làm bài (Phút)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                Quy tắc làm tròn điểm tổng
              </label>
              <select
                value={roundingRule}
                onChange={(e) => setRoundingRule(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
              >
                <option value={0.1}>Làm tròn đến 0,1 điểm (Mặc định)</option>
                <option value={0.25}>Làm tròn đến 0,25 điểm</option>
                <option value={0.5}>Làm tròn đến 0,5 điểm</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-5 sm:px-7 py-4 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Khối lớp: <strong className="text-slate-800 font-bold">{gradeLevel}</strong> • Lớp: <strong className="text-slate-800 font-bold">{className}</strong>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveOnly}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Save className="w-4 h-4" />
              <span>Lưu đợt chấm</span>
            </button>

            <button
              onClick={handleSaveAndContinue}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Lưu & Sang 2. Đưa bài học sinh vào</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
