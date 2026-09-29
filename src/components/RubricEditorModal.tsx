import React, { useState, useRef } from 'react';
import { X, Sparkles, Plus, Trash2, Check, AlertTriangle, FileText, BookOpen, Layers, Upload } from 'lucide-react';
import { ExamSession, Rubric, RubricCriterion } from '../types';

interface RubricEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ExamSession;
  onSaveSession: (updatedSession: ExamSession) => void;
}

export const RubricEditorModal: React.FC<RubricEditorModalProps> = ({
  isOpen,
  onClose,
  session,
  onSaveSession,
}) => {
  const [title, setTitle] = useState(session.title);
  const [school, setSchool] = useState(session.school);
  const [gradeLevel, setGradeLevel] = useState(session.gradeLevel);
  const [className, setClassName] = useState(session.className);
  const [durationMinutes, setDurationMinutes] = useState(session.durationMinutes);
  const [examPrompt, setExamPrompt] = useState(session.examPrompt);
  const [answerKeyText, setAnswerKeyText] = useState(session.answerKeyText);
  const [roundingRule, setRoundingRule] = useState(session.roundingRule);
  const [rubric, setRubric] = useState<Rubric>(session.rubric);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [isExtractingPrompt, setIsExtractingPrompt] = useState(false);
  const [isExtractingKey, setIsExtractingKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'prompt' | 'rubric'>('info');

  const promptFileRef = useRef<HTMLInputElement>(null);
  const keyFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Compute total max points of criteria
  const currentTotal = rubric.criteria.reduce((sum, c) => sum + (Number(c.maxScore) || 0), 0);
  const roundedTotal = Math.round(currentTotal * 100) / 100;
  const isScoreValid = Math.abs(roundedTotal - 10) < 0.01;

  // Handle AI rubric proposal
  const handleGenerateRubricWithAI = async () => {
    if (!examPrompt.trim() && !answerKeyText.trim()) {
      alert('Vui lòng nhập Đề kiểm tra hoặc Đáp án để AI xây dựng hướng dẫn chấm.');
      return;
    }

    setIsGeneratingRubric(true);
    try {
      const response = await fetch('/api/gemini/generate-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examPrompt,
          answerKeyText,
          gradeLevel,
          examTitle: title,
          maxScore: 10,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Lỗi tạo hướng dẫn chấm.');
      }

      const generatedRubric: Rubric = await response.json();
      setRubric({
        ...generatedRubric,
        version: (rubric.version || 1) + 1,
      });
      setActiveTab('rubric');
    } catch (err: any) {
      alert(err.message || 'Không thể tạo hướng dẫn chấm.');
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // Add new criterion
  const handleAddCriterion = () => {
    const newCrit: RubricCriterion = {
      id: `crit-${Date.now()}`,
      section: 'Phần II: Làm văn',
      questionOrPart: 'Tiêu chí mới',
      requirement: 'Mô tả yêu cầu cần đạt của học sinh...',
      maxScore: 0.5,
      acceptableAnswers: ['Các ý trả lời được chấp nhận'],
      scoringGuide: 'Đạt tối đa khi...',
    };
    setRubric({
      ...rubric,
      criteria: [...rubric.criteria, newCrit],
    });
  };

  // Update a criterion
  const handleUpdateCriterion = (index: number, field: keyof RubricCriterion, val: any) => {
    const updated = [...rubric.criteria];
    updated[index] = { ...updated[index], [field]: val };
    setRubric({ ...rubric, criteria: updated });
  };

  // Delete criterion
  const handleDeleteCriterion = (index: number) => {
    const updated = rubric.criteria.filter((_, i) => i !== index);
    setRubric({ ...rubric, criteria: updated });
  };

  const handleSave = () => {
    onSaveSession({
      ...session,
      title,
      school,
      gradeLevel,
      className,
      durationMinutes,
      examPrompt,
      answerKeyText,
      hasOfficialAnswerKey: Boolean(answerKeyText.trim()),
      roundingRule,
      rubric,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-4xl h-[92vh] sm:h-auto sm:max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              Cấu Hình Đợt Chấm & Hướng Dẫn Chấm
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý thông tin bài kiểm tra, đề thi, đáp án và thang điểm chi tiết trên thang 10
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex gap-4 bg-white text-sm font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'info'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            1. Thông tin đợt chấm
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'prompt'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            2. Đề thi & Đáp án
          </button>
          <button
            onClick={() => setActiveTab('rubric')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'rubric'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            3. Hướng dẫn chấm ({rubric.criteria.length} tiêu chí)
            {isScoreValid ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* THCS Quick Presets Selection */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-xs font-bold text-amber-900 block">
                  ⚡ Chọn nhanh mẫu đề kiểm tra THCS (Chương trình GDPT 2018):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 6 (GDPT 2018)');
                      setSchool('THCS Lê Lợi');
                      setGradeLevel('Lớp 6 (THCS)');
                      setClassName('6A1');
                      setExamPrompt(
                        'I. ĐỌC HIỂU (4.0 điểm): Đọc truyện ngụ ngôn "Ếch ngồi đáy giếng" và trả lời 4 câu hỏi...\nII. VIẾT (6.0 điểm): Kể lại một trải nghiệm đáng nhớ của em với người thân trong gia đình.'
                      );
                      setAnswerKeyText(
                        'I. Đọc hiểu (4.0đ): Xác định ngôi kể, nhân vật, bài học khiêm tốn.\nII. Viết (6.0đ): Bố cục bài tự sự 3 phần, cảm xúc chân thực.'
                      );
                    }}
                    className="p-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left text-xs transition-colors"
                  >
                    <span className="font-bold block text-slate-900">Lớp 6</span>
                    <span className="text-[10px] text-slate-500">Ngụ ngôn / Trải nghiệm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 7 (GDPT 2018)');
                      setSchool('THCS Trưng Vương');
                      setGradeLevel('Lớp 7 (THCS)');
                      setClassName('7B');
                      setExamPrompt(
                        'I. ĐỌC HIỂU (4.0 điểm): Đọc bài thơ "Tiếng gà trưa" (Xuân Quỳnh) và thực hiện các yêu cầu...\nII. VIẾT (6.0 điểm): Viết đoạn văn ghi lại cảm xúc của em sau khi đọc bài thơ "Tiếng gà trưa".'
                      );
                      setAnswerKeyText(
                        'I. Đọc hiểu (4.0đ): Thể thơ 5 chữ, biện pháp điệp từ, tình cảm bà cháu.\nII. Viết (6.0đ): Đoạn văn biểu cảm, cảm xúc trong sáng.'
                      );
                    }}
                    className="p-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left text-xs transition-colors"
                  >
                    <span className="font-bold block text-slate-900">Lớp 7</span>
                    <span className="text-[10px] text-slate-500">Thơ / Đoạn biểu cảm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 8 (GDPT 2018)');
                      setSchool('THCS Nguyễn Du');
                      setGradeLevel('Lớp 8 (THCS)');
                      setClassName('8A2');
                      setExamPrompt(
                        'I. ĐỌC HIỂU (4.0 điểm): Đọc đoạn trích "Gió lạnh đầu mùa" (Thạch Lam)...\nII. VIẾT (6.0 điểm): Kể lại một việc tốt thể hiện lòng nhân ái.'
                      );
                      setAnswerKeyText(
                        'I. Đọc hiểu (4.0đ): Ngôi kể 3, hành động cho áo ấm, thông điệp sẻ chia.\nII. Viết (6.0đ): Bài văn tự sự THCS, diễn biến và ý nghĩa.'
                      );
                    }}
                    className="p-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left text-xs transition-colors ring-2 ring-amber-500"
                  >
                    <span className="font-bold block text-amber-900">Lớp 8 (Đang chọn)</span>
                    <span className="text-[10px] text-amber-700">Truyện ngắn / Việc tốt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Kiểm tra Đánh giá Định kỳ Ngữ văn 9 (GDPT 2018)');
                      setSchool('THCS Chu Văn An');
                      setGradeLevel('Lớp 9 (THCS)');
                      setClassName('9A3');
                      setExamPrompt(
                        'I. ĐỌC HIỂU (4.0 điểm): Đọc văn bản nhật dụng bàn về tinh thần tự lập...\nII. VIẾT (6.0 điểm): Viết bài văn nghị luận xã hội về ý chí vượt khó của học sinh.'
                      );
                      setAnswerKeyText(
                        'I. Đọc hiểu (4.0đ): Luận điểm, thao tác lập luận.\nII. Viết (6.0đ): Nghị luận xã hội, dẫn chứng thực tế, bài học hành động.'
                      );
                    }}
                    className="p-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left text-xs transition-colors"
                  >
                    <span className="font-bold block text-slate-900">Lớp 9</span>
                    <span className="text-[10px] text-slate-500">Nghị luận xã hội</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên bài kiểm tra THCS
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                  placeholder="Ví dụ: Kiểm tra Đánh giá Định kỳ Ngữ văn 8"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trường THCS
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="THCS Nguyễn Du"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Khối & Lớp
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="Lớp 12"
                  />
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="12A1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Đề kiểm tra (Văn bản hoặc trích đoạn ngữ liệu)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => promptFileRef.current?.click()}
                      disabled={isExtractingPrompt}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-lg text-xs flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isExtractingPrompt ? 'Đang đọc...' : 'Tải file đề thi'}</span>
                    </button>
                    <span className="text-xs text-slate-500 hidden sm:inline">Phân tách rõ Đọc hiểu và Làm văn</span>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={examPrompt}
                  onChange={(e) => setExamPrompt(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-sans leading-relaxed"
                  placeholder="Nhập đầy đủ ngữ liệu đọc hiểu và các câu hỏi, yêu cầu làm văn, hoặc tải tệp ảnh/PDF đề bài..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    Đáp án / Hướng dẫn chấm có sẵn (Tùy chọn)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => keyFileRef.current?.click()}
                      disabled={isExtractingKey}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-xs flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isExtractingKey ? 'Đang đọc...' : 'Tải file đáp án'}</span>
                    </button>
                    <span className="text-xs text-slate-500 hidden sm:inline">Nếu chưa có, AI sẽ tự đề xuất</span>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={answerKeyText}
                  onChange={(e) => setAnswerKeyText(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-sans leading-relaxed"
                  placeholder="Nhập biểu điểm, đáp án mẫu hoặc gợi ý chấm của giáo viên, hoặc tải tệp ảnh biểu điểm..."
                />
              </div>

              <input
                ref={promptFileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setIsExtractingPrompt(true);
                  try {
                    if (f.type.startsWith('text/')) {
                      setExamPrompt(await f.text());
                    } else {
                      const r = new FileReader();
                      r.onload = async () => {
                        const res = await fetch('/api/gemini/extract-document', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ image: r.result, docType: 'exam_prompt' }),
                        });
                        const d = await res.json();
                        if (d.extractedText) setExamPrompt(d.extractedText);
                        setIsExtractingPrompt(false);
                      };
                      r.readAsDataURL(f);
                      return;
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsExtractingPrompt(false);
                  }
                }}
                className="hidden"
              />

              <input
                ref={keyFileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setIsExtractingKey(true);
                  try {
                    if (f.type.startsWith('text/')) {
                      setAnswerKeyText(await f.text());
                    } else {
                      const r = new FileReader();
                      r.onload = async () => {
                        const res = await fetch('/api/gemini/extract-document', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ image: r.result, docType: 'answer_key' }),
                        });
                        const d = await res.json();
                        if (d.extractedText) setAnswerKeyText(d.extractedText);
                        setIsExtractingKey(false);
                      };
                      r.readAsDataURL(f);
                      return;
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsExtractingKey(false);
                  }
                }}
                className="hidden"
              />

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Tự động tạo ma trận & tiêu chí chấm
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Hệ thống sẽ phân tích đề và đáp án để chia nhỏ các tiêu chí chuẩn xác trên thang 10
                  </p>
                </div>
                <button
                  onClick={handleGenerateRubricWithAI}
                  disabled={isGeneratingRubric}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingRubric ? 'Đang phân tích...' : 'Tạo tiêu chí với AI'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'rubric' && (
            <div className="space-y-4">
              {/* Header Status of Rubric */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{rubric.title}</h3>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                        rubric.sourceType === 'teacher_provided'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {rubric.sourceType === 'teacher_provided'
                        ? 'Đáp án do giáo viên cung cấp'
                        : 'Hướng dẫn chấm do AI đề xuất – Giáo viên cần duyệt'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Phiên bản {rubric.version} • Tổng điểm các tiêu chí:{' '}
                    <strong className={isScoreValid ? 'text-emerald-700' : 'text-amber-700'}>
                      {roundedTotal} / 10 điểm
                    </strong>
                  </p>
                </div>

                {!isScoreValid && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100/70 px-3 py-1.5 rounded-xl border border-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Tổng điểm chưa tròn 10.0 (Hiện tại: {roundedTotal}đ)
                  </div>
                )}
              </div>

              {/* Criteria List */}
              <div className="space-y-3">
                {rubric.criteria.map((criterion, index) => (
                  <div
                    key={criterion.id || index}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={criterion.section}
                          onChange={(e) => handleUpdateCriterion(index, 'section', e.target.value)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 rounded-lg border border-slate-200 text-slate-700 w-44"
                          placeholder="Phần thi..."
                        />
                        <input
                          type="text"
                          value={criterion.questionOrPart}
                          onChange={(e) => handleUpdateCriterion(index, 'questionOrPart', e.target.value)}
                          className="px-2.5 py-1 text-xs font-bold text-slate-900 border border-slate-200 rounded-lg flex-1"
                          placeholder="Câu hỏi / Tiêu chí..."
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-slate-500 font-medium">Điểm tối đa:</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="10"
                          value={criterion.maxScore}
                          onChange={(e) => handleUpdateCriterion(index, 'maxScore', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg text-center"
                        />
                        <button
                          onClick={() => handleDeleteCriterion(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          title="Xóa tiêu chí"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Yêu cầu cần đạt:
                      </label>
                      <textarea
                        rows={2}
                        value={criterion.requirement}
                        onChange={(e) => handleUpdateCriterion(index, 'requirement', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Các cách trả lời / cảm thụ được chấp nhận (cách nhau bằng dấu phẩy):
                      </label>
                      <input
                        type="text"
                        value={criterion.acceptableAnswers?.join('; ') || ''}
                        onChange={(e) =>
                          handleUpdateCriterion(
                            index,
                            'acceptableAnswers',
                            e.target.value.split(';').map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs text-slate-700 rounded-lg border border-slate-200"
                        placeholder="Nêu đúng phương thức nghị luận; diễn đạt tương đương..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddCriterion}
                className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-2xl text-xs font-bold text-slate-600 hover:text-amber-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm tiêu chí chấm mới
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            Lưu đợt chấm & Tiêu chí
          </button>
        </div>
      </div>
    </div>
  );
};
