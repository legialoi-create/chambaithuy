import React, { useState, useEffect, useRef } from 'react';
import {
  StudentSubmission,
  SubmissionPage,
  UncertainSegment,
  ExamSession,
} from '../types';
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  History,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Save,
  Clock,
  Layers,
  Wand2,
  Copy,
  Check,
  SpellCheck,
  Sliders,
  Loader2,
  Users,
} from 'lucide-react';
import {
  transformImage,
  enhanceVietnameseHandwritingImage,
  expandVietnameseAbbreviations,
  auditVietnameseDiacritics,
} from '../utils/imageProcessing';

interface TranscriptVerifierProps {
  submission: StudentSubmission;
  onSaveSubmission: (updated: StudentSubmission) => void;
  onProceedToGrading: () => void;
  isMobile: boolean;
  session?: ExamSession;
  onSaveSession?: (updatedSession: ExamSession) => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  submissions?: StudentSubmission[];
  activeSubmissionId?: string;
  onSelectSubmission?: (id: string) => void;
}

export const TranscriptVerifier: React.FC<TranscriptVerifierProps> = ({
  submission,
  onSaveSubmission,
  onProceedToGrading,
  isMobile,
  session,
  onSaveSession,
  showToast,
  submissions,
  activeSubmissionId,
  onSelectSubmission,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState<'image' | 'text'>('text');
  const [editedText, setEditedText] = useState(
    submission.editedTranscription || submission.originalTranscription || ''
  );
  const [studentName, setStudentName] = useState(submission.studentName);
  const [className, setClassName] = useState(submission.className);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeImageFilter, setActiveImageFilter] = useState<'original' | 'ink' | 'grid' | 'sharpen'>('original');
  const [isFilteringImage, setIsFilteringImage] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    totalWords: number;
    suggestedCorrections: { snippet: string; suggestion: string }[];
  } | null>(null);

  const autoTranscribedRef = useRef<string>('');
  const currentPage = submission.pages[currentPageIndex] || submission.pages[0];

  // Sync state when active submission changes
  useEffect(() => {
    setEditedText(submission.editedTranscription || submission.originalTranscription || '');
    setStudentName(submission.studentName);
    setClassName(submission.className);
    setCurrentPageIndex(0);
    setAuditResult(null);
  }, [submission.id]);

  // Automatically trigger reconstruction on mount if student has pages but no text yet
  useEffect(() => {
    const hasText = Boolean(submission.editedTranscription || submission.originalTranscription);
    const hasPages = submission.pages && submission.pages.length > 0;
    if (hasPages && !hasText && autoTranscribedRef.current !== submission.id) {
      autoTranscribedRef.current = submission.id;
      handleRunTranscription();
    }
  }, [submission.id, submission.pages.length]);

  // Rotate or flip current page image
  const handleTransformPage = async (rotationDelta: number, toggleFlip: boolean) => {
    if (!currentPage) return;
    const newRot = (currentPage.rotation + rotationDelta) % 360;
    const newFlip = toggleFlip ? !currentPage.flippedH : currentPage.flippedH;

    const transformed = await transformImage(currentPage.imageData, {
      rotation: newRot,
      flippedH: newFlip,
    });

    const updatedPages = [...submission.pages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      rotation: newRot,
      flippedH: newFlip,
      imageData: transformed,
    };

    onSaveSubmission({
      ...submission,
      pages: updatedPages,
    });
  };

  // Apply Vietnamese handwriting image filter
  const handleApplyImageFilter = async (mode: 'original' | 'ink' | 'grid' | 'sharpen') => {
    if (!currentPage) return;
    setActiveImageFilter(mode);

    if (mode === 'original') return;

    setIsFilteringImage(true);
    try {
      const modeKey = mode === 'ink' ? 'enhance_ink' : mode === 'grid' ? 'remove_grid' : 'sharpen';
      const filtered = await enhanceVietnameseHandwritingImage(currentPage.imageData, modeKey);

      const updatedPages = [...submission.pages];
      updatedPages[currentPageIndex] = {
        ...currentPage,
        imageData: filtered,
      };

      onSaveSubmission({
        ...submission,
        pages: updatedPages,
      });
    } catch (err) {
      console.error('Lỗi lọc ảnh:', err);
    } finally {
      setIsFilteringImage(false);
    }
  };

  // Expand abbreviations in text
  const handleExpandAbbreviations = () => {
    const { expandedText, replacementsCount } = expandVietnameseAbbreviations(editedText);
    setEditedText(expandedText);
    alert(
      replacementsCount > 0
        ? `Đã chuẩn hóa ${replacementsCount} từ viết tắt môn Ngữ văn (ptbđ, bptt, nvat, nd, nt...)`
        : 'Không phát hiện từ viết tắt cần chuẩn hóa trong bài làm.'
    );
  };

  // Audit diacritics
  const handleAuditDiacritics = () => {
    const audit = auditVietnameseDiacritics(editedText);
    setAuditResult(audit);
  };

  // Copy text to clipboard
  const handleCopyText = () => {
    navigator.clipboard?.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger Gemini Handwriting OCR & Layout Reconstruction
  const handleRunTranscription = async () => {
    if (!submission.pages || submission.pages.length === 0) {
      alert('Không có ảnh trang bài làm để nhận dạng.');
      return;
    }

    setIsTranscribing(true);
    try {
      const payload = {
        images: submission.pages.map((p) => ({
          pageNumber: p.pageNumber,
          data: p.imageData,
        })),
        existingStudentInfo: {
          studentName: submission.studentName,
          className: submission.className,
        },
      };

      const res = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi nhận dạng chữ viết tay.');
      }

      const data = await res.json();

      const updatedPages: SubmissionPage[] = submission.pages.map((p, idx) => {
        const pageResult = data.pages?.find((dp: any) => dp.pageNumber === p.pageNumber) || data.pages?.[idx];
        return {
          ...p,
          pageStatus: pageResult?.pageStatus || 'clear',
          pageText: pageResult?.pageText || '',
          uncertainSegments: pageResult?.uncertainSegments || [],
        };
      });

      const auditEntry = {
        timestamp: new Date().toISOString(),
        note: `Nhận dạng & Tái tạo chữ viết tay AI lúc ${new Date().toLocaleTimeString('vi-VN')}`,
      };

      const hasUnclear = updatedPages.some((p) => p.pageStatus === 'needs_check' || p.pageStatus === 'unreadable');

      const updatedSub: StudentSubmission = {
        ...submission,
        studentName: data.studentName && data.studentName !== 'Chưa xác định' ? data.studentName : submission.studentName,
        className: data.className || submission.className,
        schoolOrCode: data.schoolOrCode || submission.schoolOrCode,
        pages: updatedPages,
        originalTranscription: data.rawTranscription || '',
        editedTranscription: data.rawTranscription || '',
        status: hasUnclear ? 'needs_transcript_review' : 'ready_to_grade',
        transcriptConfirmed: false,
        transcriptAuditLog: [auditEntry, ...(submission.transcriptAuditLog || [])],
      };

      setEditedText(data.rawTranscription || '');
      setStudentName(updatedSub.studentName);
      setClassName(updatedSub.className);
      onSaveSubmission(updatedSub);

      // If exam prompt was detected in the images, automatically populate examPrompt
      if (data.hasExamPrompt && data.detectedExamPrompt && data.detectedExamPrompt.trim().length > 15) {
        const detectedPrompt = data.detectedExamPrompt.trim();
        if (session && onSaveSession) {
          onSaveSession({
            ...session,
            examPrompt: detectedPrompt,
            updatedAt: new Date().toISOString(),
          });
          showToast?.('📝 Đã tự động nhận diện và cập nhật Đề bài kiểm tra từ ảnh chụp vào ô Đề thi!', 'success');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Không thể nhận dạng bài viết tay.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Save changes & Confirm transcript
  const handleConfirmTranscript = () => {
    const isTextModified = editedText !== submission.originalTranscription;
    const auditEntry = {
      timestamp: new Date().toISOString(),
      note: isTextModified
        ? 'Giáo viên đã hiệu chỉnh và xác nhận bản tái tạo'
        : 'Giáo viên xác nhận nguyên trạng bản tái tạo AI',
    };

    const updatedSub: StudentSubmission = {
      ...submission,
      studentName,
      className,
      editedTranscription: editedText,
      transcriptConfirmed: true,
      status: submission.gradingResult ? 'graded_proposed' : 'ready_to_grade',
      transcriptAuditLog: [auditEntry, ...(submission.transcriptAuditLog || [])],
    };

    onSaveSubmission(updatedSub);
  };

  // Word count & line count
  const wordCount = editedText.trim() ? editedText.trim().split(/\s+/).length : 0;
  const lineCount = editedText ? editedText.split('\n').length : 0;

  // Quick apply an alternative suggested reading
  const handleApplySuggestion = (targetSnippet: string, chosenReading: string) => {
    const newText = editedText.replace(targetSnippet, chosenReading);
    setEditedText(newText);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-140px)] min-h-[580px] overflow-hidden relative pb-16 md:pb-0">
      {/* MULTI-STUDENT SELECTOR RIBBON (When multiple students exist in session) */}
      {submissions && submissions.length > 1 && onSelectSubmission && (
        <div className="bg-slate-900 text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 shrink-0">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Danh sách bài thi</span>
            <span>({submissions.length} HS):</span>
          </div>

          {/* Scrollable student pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {submissions.map((sub, idx) => {
              const isCurrent = sub.id === submission.id;
              const isTranscribed = Boolean((sub.editedTranscription || sub.originalTranscription || '').trim());

              return (
                <button
                  key={sub.id}
                  onClick={() => onSelectSubmission(sub.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300 scale-105'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`${sub.studentName} (${sub.anonymousCode})`}
                >
                  <span>{idx + 1}. {sub.studentName || 'Học sinh'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isCurrent
                      ? 'bg-amber-950/20 text-slate-950 font-black'
                      : isTranscribed
                      ? 'bg-emerald-900/80 text-emerald-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {sub.pages.length} tr
                  </span>
                  {isTranscribed && <CheckCircle className={`w-3 h-3 ${isCurrent ? 'text-slate-950' : 'text-emerald-400'}`} />}
                </button>
              );
            })}
          </div>

          {/* Prev / Next navigation arrows */}
          <div className="flex items-center gap-1 shrink-0 ml-auto pl-2 border-l border-slate-700">
            <button
              onClick={() => {
                const currentIndex = submissions.findIndex((s) => s.id === submission.id);
                if (currentIndex > 0) onSelectSubmission(submissions[currentIndex - 1].id);
              }}
              disabled={submissions.findIndex((s) => s.id === submission.id) <= 0}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
              title="Học sinh trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1">
              {submissions.findIndex((s) => s.id === submission.id) + 1}/{submissions.length}
            </span>
            <button
              onClick={() => {
                const currentIndex = submissions.findIndex((s) => s.id === submission.id);
                if (currentIndex < submissions.length - 1) onSelectSubmission(submissions[currentIndex + 1].id);
              }}
              disabled={submissions.findIndex((s) => s.id === submission.id) >= submissions.length - 1}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
              title="Học sinh tiếp theo"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold text-xs font-mono">
            {submission.anonymousCode}
          </span>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="font-bold text-slate-900 text-xs sm:text-sm px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 bg-transparent focus:bg-white max-w-[140px] sm:max-w-[200px]"
            placeholder="Tên học sinh"
          />
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="text-xs font-semibold text-slate-600 px-1.5 py-0.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-amber-500 bg-transparent focus:bg-white w-14"
            placeholder="Lớp"
          />
        </div>

        {/* Desktop Quick Action Buttons */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl text-xs flex items-center gap-1 transition-colors"
            title="Lịch sử chỉnh sửa"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Automatic AI Transcription Status Badge */}
          {isTranscribing ? (
            <div className="px-3.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-xl text-xs flex items-center gap-2 animate-pulse shadow-xs">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              <span>AI đang tự động tái tạo bài làm...</span>
            </div>
          ) : editedText.trim() ? (
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>AI đã tự động tái tạo</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 font-medium rounded-xl text-xs flex items-center gap-1.5">
              <span>Đang chờ trang ảnh bài thi...</span>
            </div>
          )}

          <button
            onClick={handleConfirmTranscript}
            className={`px-3.5 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs ${
              submission.transcriptConfirmed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{submission.transcriptConfirmed ? 'Đã xác nhận' : 'Xác nhận bản chép'}</span>
          </button>

          <button
            onClick={onProceedToGrading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <span>Sang 4. Chấm điểm</span>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher (Image vs Text) */}
      <div className="md:hidden flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveMobileTab('image')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeMobileTab === 'image'
              ? 'border-amber-600 text-amber-800 bg-amber-50/50'
              : 'border-transparent text-slate-500'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Ảnh bài thi ({currentPageIndex + 1}/{submission.pages.length})
        </button>
        <button
          onClick={() => setActiveMobileTab('text')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeMobileTab === 'text'
              ? 'border-amber-600 text-amber-800 bg-amber-50/50'
              : 'border-transparent text-slate-500'
          }`}
        >
          <FileText className="w-4 h-4" />
          Bản chép tái tạo ({wordCount} từ)
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Document Image View */}
        {(!isMobile || activeMobileTab === 'image') && (
          <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-900/95 relative select-none">
            {/* Image Enhancement Toolbar */}
            <div className="p-2 sm:p-2.5 bg-black/50 backdrop-blur-sm flex flex-wrap items-center justify-between text-white text-xs z-10 border-b border-white/10 gap-2">
              {/* Vietnamese handwriting filter modes */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <span className="text-[10px] text-slate-400 font-bold uppercase hidden lg:inline mr-1">Bộ lọc ảnh:</span>
                <button
                  onClick={() => handleApplyImageFilter('original')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activeImageFilter === 'original' ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  Gốc
                </button>
                <button
                  onClick={() => handleApplyImageFilter('ink')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activeImageFilter === 'ink' ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                  title="Tăng tương phản nét chữ mực và dấu thanh tiếng Việt"
                >
                  ✨ Đậm nét mực
                </button>
                <button
                  onClick={() => handleApplyImageFilter('grid')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activeImageFilter === 'grid' ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                  title="Tẩy bớt nền ô ly và đường kẻ ngang"
                >
                  📄 Tẩy nền ô ly
                </button>
                <button
                  onClick={() => handleApplyImageFilter('sharpen')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activeImageFilter === 'sharpen' ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  Sắc nét
                </button>
              </div>

              {/* Transformation actions */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px]"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={() => handleTransformPage(90, false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"
                  title="Xoay 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleTransformPage(0, true)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"
                  title="Lật ngang"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Image Viewer */}
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
              {currentPage ? (
                <div
                  className="transition-transform duration-150"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={currentPage.imageData}
                    alt={`Bài làm trang ${currentPageIndex + 1}`}
                    className="max-h-[66vh] max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
                  />
                </div>
              ) : (
                <div className="text-slate-400 text-sm">Chưa có ảnh trang này</div>
              )}
            </div>

            {/* Pagination Controls */}
            {submission.pages.length > 1 && (
              <div className="p-2.5 bg-black/50 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-4 text-xs text-white">
                <button
                  disabled={currentPageIndex === 0}
                  onClick={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs">
                  Trang {currentPageIndex + 1} / {submission.pages.length}
                </span>
                <button
                  disabled={currentPageIndex === submission.pages.length - 1}
                  onClick={() => setCurrentPageIndex((i) => Math.min(submission.pages.length - 1, i + 1))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Editable Reconstructed Transcript */}
        {(!isMobile || activeMobileTab === 'text') && (
          <div className="flex-1 flex flex-col bg-white">
            {/* Reconstruction Toolbar */}
            <div className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700">
                  {wordCount} từ • {lineCount} dòng
                </span>
                {submission.transcriptConfirmed && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Đã duyệt
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExpandAbbreviations}
                  className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Chuẩn hóa chữ viết tắt môn Văn (ptbđ, bptt, nvat...)"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chuẩn hoá từ viết tắt</span>
                </button>

                <button
                  onClick={handleAuditDiacritics}
                  className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Kiểm tra các từ có thể thiếu dấu thanh tiếng Việt"
                >
                  <SpellCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Soát dấu chữ</span>
                </button>

                <button
                  onClick={handleCopyText}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Sao chép toàn bộ văn bản bài làm"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>

            {/* Diacritics Audit Alert (if found suggestions) */}
            {auditResult && auditResult.suggestedCorrections.length > 0 && (
              <div className="p-2.5 bg-sky-50 border-b border-sky-200 text-xs text-sky-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-[11px]">
                  <SpellCheck className="w-3.5 h-3.5 text-sky-600" />
                  Phát hiện từ nghi vấn thiếu dấu tiếng Việt (Bấm để sửa):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {auditResult.suggestedCorrections.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleApplySuggestion(item.snippet, item.suggestion);
                        setAuditResult({
                          ...auditResult,
                          suggestedCorrections: auditResult.suggestedCorrections.filter((_, i) => i !== idx),
                        });
                      }}
                      className="px-2 py-0.5 bg-white border border-sky-300 rounded-md text-[11px] font-medium hover:bg-sky-100 flex items-center gap-1"
                    >
                      <span className="line-through text-slate-400">{item.snippet}</span>
                      <span>&rarr;</span>
                      <strong className="text-sky-800">{item.suggestion}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick-suggest chips for uncertain segments on mobile */}
            {currentPage?.uncertainSegments && currentPage.uncertainSegments.length > 0 && (
              <div className="p-2.5 bg-amber-50/90 border-b border-amber-200 space-y-1.5 text-xs">
                <p className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Gợi ý giải đoán chữ mờ (Chạm để áp dụng vào bài):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {currentPage.uncertainSegments.map((seg: UncertainSegment, sIdx: number) => (
                    <div
                      key={sIdx}
                      className="p-1.5 bg-white rounded-xl border border-amber-200 shadow-xs flex flex-wrap items-center gap-1"
                    >
                      <span className="text-[10px] text-slate-500 font-mono italic">
                        "{seg.originalSnippet}" &rarr;
                      </span>
                      {seg.suggestedReadings.map((reading: string, rIdx: number) => (
                        <button
                          key={rIdx}
                          onClick={() => handleApplySuggestion(seg.originalSnippet, reading)}
                          className="px-2 py-0.5 bg-amber-100 active:bg-amber-300 text-amber-900 font-bold rounded text-[11px]"
                        >
                          {reading}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Transcript Area */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-sans leading-relaxed text-slate-800 resize-none shadow-inner"
                placeholder="Nội dung bản chép tái tạo bài làm của học sinh sẽ hiển thị ở đây. Thầy cô có thể đọc, sửa chữa hoặc bấm 'Tái tạo lại bài làm (AI)'..."
              />
            </div>
          </div>
        )}
      </div>

      {/* MOBILE STICKY ACTION BAR: Easy Thumb Controls on Phone */}
      <div className="md:hidden fixed bottom-14 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 flex items-center justify-between gap-2 shadow-lg z-30">
        {isTranscribing ? (
          <div className="flex-1 py-2 px-3 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>AI đang tự động tái tạo...</span>
          </div>
        ) : (
          <button
            onClick={handleConfirmTranscript}
            className={`flex-1 py-2.5 px-3 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all ${
              submission.transcriptConfirmed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-emerald-600 active:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{submission.transcriptConfirmed ? 'Đã xác nhận' : 'Xác nhận bản chép'}</span>
          </button>
        )}

        <button
          onClick={onProceedToGrading}
          className="py-2.5 px-4 bg-slate-900 active:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md active:scale-95 shrink-0"
        >
          <span>Sang 4. Chấm</span>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>
    </div>
  );
};

