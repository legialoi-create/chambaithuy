import React, { useState } from 'react';
import {
  StudentSubmission,
  SubmissionPage,
  STATUS_LABELS,
} from '../types';
import {
  Layers,
  Trash2,
  MoveRight,
  Split,
  Merge,
  ArrowUp,
  ArrowDown,
  Plus,
  Eye,
  FileText,
  User,
  Check,
  AlertTriangle,
  Camera,
} from 'lucide-react';

interface PaperOrganizerProps {
  submissions: StudentSubmission[];
  activeSubmissionId: string;
  onSelectSubmission: (id: string) => void;
  onUpdateSubmissions: (updated: StudentSubmission[]) => void;
  onDeleteSubmission: (id: string) => void;
  onAddNewStudent: () => void;
  onOpenCapture: () => void;
  isMobile: boolean;
}

export const PaperOrganizer: React.FC<PaperOrganizerProps> = ({
  submissions,
  activeSubmissionId,
  onSelectSubmission,
  onUpdateSubmissions,
  onDeleteSubmission,
  onAddNewStudent,
  onOpenCapture,
  isMobile,
}) => {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<StudentSubmission | null>(null);
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);

  const currentSub = submissions.find((s) => s.id === activeSubmissionId) || submissions[0];

  // Move page up
  const handleMovePageUp = (index: number) => {
    if (!currentSub || index <= 0) return;
    const newPages = [...currentSub.pages];
    const temp = newPages[index];
    newPages[index] = newPages[index - 1];
    newPages[index - 1] = temp;
    // Renumber
    newPages.forEach((p, idx) => (p.pageNumber = idx + 1));

    const updatedSubmissions = submissions.map((s) =>
      s.id === currentSub.id ? { ...s, pages: newPages } : s
    );
    onUpdateSubmissions(updatedSubmissions);
  };

  // Move page down
  const handleMovePageDown = (index: number) => {
    if (!currentSub || index >= currentSub.pages.length - 1) return;
    const newPages = [...currentSub.pages];
    const temp = newPages[index];
    newPages[index] = newPages[index + 1];
    newPages[index + 1] = temp;
    // Renumber
    newPages.forEach((p, idx) => (p.pageNumber = idx + 1));

    const updatedSubmissions = submissions.map((s) =>
      s.id === currentSub.id ? { ...s, pages: newPages } : s
    );
    onUpdateSubmissions(updatedSubmissions);
  };

  // Delete a page
  const handleDeletePage = (pageId: string) => {
    setConfirmDeletePageId(pageId);
  };

  const handleExecuteDeletePage = () => {
    if (!currentSub || !confirmDeletePageId) return;
    const newPages = currentSub.pages
      .filter((p) => p.id !== confirmDeletePageId)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    const updatedSubmissions = submissions.map((s) =>
      s.id === currentSub.id ? { ...s, pages: newPages } : s
    );
    onUpdateSubmissions(updatedSubmissions);
    if (selectedPageId === confirmDeletePageId) setSelectedPageId(null);
    setConfirmDeletePageId(null);
  };

  // Split selected page to create a new student submission
  const handleSplitToNewStudent = (page: SubmissionPage) => {
    if (!currentSub) return;
    const newCode = `NV-${String(submissions.length + 1).padStart(3, '0')}`;
    const newSub: StudentSubmission = {
      id: `sub-${Date.now()}`,
      sessionId: currentSub.sessionId,
      anonymousCode: newCode,
      studentName: 'Chưa xác định',
      className: currentSub.className,
      pages: [{ ...page, pageNumber: 1 }],
      status: 'waiting_transcription',
      originalTranscription: '',
      editedTranscription: '',
      transcriptConfirmed: false,
      transcriptAuditLog: [{ timestamp: new Date().toISOString(), note: `Tách từ bài ${currentSub.anonymousCode}` }],
    };

    // Remove page from original
    const remainingPages = currentSub.pages
      .filter((p) => p.id !== page.id)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    const updated = submissions.map((s) =>
      s.id === currentSub.id ? { ...s, pages: remainingPages } : s
    );

    onUpdateSubmissions([...updated, newSub]);
    onSelectSubmission(newSub.id);
  };

  // Move page to existing student
  const handleTransferPage = (page: SubmissionPage, destSubId: string) => {
    if (!destSubId || destSubId === currentSub?.id) return;
    const dest = submissions.find((s) => s.id === destSubId);
    if (!dest) return;

    const remainingPages = currentSub.pages
      .filter((p) => p.id !== page.id)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    const newDestPages = [
      ...dest.pages,
      { ...page, pageNumber: dest.pages.length + 1 },
    ];

    const updated = submissions.map((s) => {
      if (s.id === currentSub.id) return { ...s, pages: remainingPages };
      if (s.id === destSubId) return { ...s, pages: newDestPages };
      return s;
    });

    onUpdateSubmissions(updated);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      {/* MOBILE HORIZONTAL STUDENT CAROUSEL (Top of organizer on phones) */}
      <div className="md:hidden border-b border-slate-200 bg-slate-50/80 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            Chọn học sinh ({submissions.length})
          </span>
          <button
            onClick={onAddNewStudent}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Bài mới
          </button>
        </div>

        {/* Horizontal scrollable chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {submissions.map((sub) => {
            const isSelected = sub.id === currentSub?.id;
            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubmission(sub.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{sub.studentName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sub.pages.length} trang
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteSub(sub);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    isSelected ? 'text-amber-200 hover:text-white hover:bg-amber-700' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                  }`}
                  title={`Xóa học sinh ${sub.studentName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP SIDEBAR: Student Papers List */}
      <div className="hidden md:flex w-80 border-r border-slate-200 bg-slate-50/70 p-4 space-y-3 flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              Danh sách bài nộp ({submissions.length})
            </h3>
            <p className="text-[11px] text-slate-500">Chọn bài để quản lý trang</p>
          </div>
          <button
            onClick={onAddNewStudent}
            className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
            title="Bắt đầu bài mới"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {submissions.map((sub) => {
            const isSelected = sub.id === currentSub?.id;
            const statusBadge = STATUS_LABELS[sub.status];

            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubmission(sub.id)}
                className={`p-3 rounded-2xl cursor-pointer border transition-all text-xs group relative ${
                  isSelected
                    ? 'bg-white border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400'
                    : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold font-mono text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded">
                    {sub.anonymousCode}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[10px] font-semibold">
                      {sub.pages.length} trang
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteSub(sub);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={`Xóa học sinh ${sub.studentName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 truncate">{sub.studentName}</h4>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge.badgeColor}`}>
                    {statusBadge.label}
                  </span>
                  {sub.teacherApprovedScore !== undefined ? (
                    <span className="font-bold text-emerald-700 font-mono text-xs">
                      {sub.teacherApprovedScore}đ
                    </span>
                  ) : sub.gradingResult ? (
                    <span className="font-bold text-slate-600 font-mono text-xs">
                      {sub.gradingResult.proposedTotalScore}đ*
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Area: Page Reordering, Split & Merge */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col space-y-4 sm:space-y-6">
        {/* Paper Header */}
        {currentSub && (
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold text-xs font-mono">
                  {currentSub.anonymousCode}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900">{currentSub.studentName}</h3>
                <span className="text-xs text-slate-500">({currentSub.className})</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Bài làm gồm <strong>{currentSub.pages.length} trang</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setConfirmDeleteSub(currentSub)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors active:scale-95 shadow-2xs"
                title="Xóa toàn bộ bài làm của học sinh này"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Xóa học sinh này</span>
                <span className="sm:hidden">Xóa</span>
              </button>

              <button
                onClick={onOpenCapture}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20 active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp thêm trang</span>
              </button>
            </div>
          </div>
        )}

        {/* Pages Grid */}
        <div className="flex-1">
          {currentSub?.pages.length === 0 ? (
            <div className="py-12 sm:py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl p-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">Chưa có trang bài làm cho học sinh này</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Nhấn <strong>"BẬT CAMERA CHỤP BÀI"</strong> hoặc <strong>"Chụp thử trang bài THCS mẫu"</strong> ở đầu trang để nạp trang bài thi viết tay.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {currentSub?.pages.map((page, index) => {
                const isSelected = selectedPageId === page.id;

                return (
                  <div
                    key={page.id}
                    onClick={() => setSelectedPageId(page.id)}
                    className={`rounded-2xl border bg-white p-3 space-y-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 shadow-lg ring-2 ring-amber-400/50'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Header of page card */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Trang {page.pageNumber}
                      </span>
                      {page.isCloseUpDetail && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                          Ảnh chụp cận
                        </span>
                      )}

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={index === 0}
                          onClick={() => handleMovePageUp(index)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          title="Chuyển lên trước"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === currentSub.pages.length - 1}
                          onClick={() => handleMovePageDown(index)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          title="Chuyển xuống sau"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePage(page.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Xóa trang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail Image */}
                    <div className="h-56 sm:h-64 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
                      <img
                        src={page.imageData}
                        alt={`Trang ${page.pageNumber}`}
                        className="max-h-full max-w-full object-contain rounded"
                        style={{
                          transform: `rotate(${page.rotation}deg) scaleX(${page.flippedH ? -1 : 1})`,
                        }}
                      />
                    </div>

                    {/* Transfer / Split action tools */}
                    <div
                      className="pt-2 border-t border-slate-100 space-y-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleSplitToNewStudent(page)}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          title="Tách trang này thành bài làm của một học sinh mới"
                        >
                          <Split className="w-3.5 h-3.5 text-amber-600" />
                          Tách bài mới
                        </button>

                        {submissions.length > 1 && (
                          <div className="flex items-center gap-1">
                            <select
                              value={targetStudentId}
                              onChange={(e) => {
                                handleTransferPage(page, e.target.value);
                                setTargetStudentId('');
                              }}
                              className="px-2 py-1 text-[11px] bg-slate-100 rounded-lg border border-slate-200 text-slate-700 max-w-[120px]"
                            >
                              <option value="">Chuyển sang...</option>
                              {submissions
                                .filter((s) => s.id !== currentSub.id)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.anonymousCode} - {s.studentName}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM DELETE STUDENT MODAL */}
      {confirmDeleteSub && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Xác nhận xóa học sinh?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Thầy/cô có chắc chắn muốn xóa bài làm của học sinh{' '}
                  <strong className="text-slate-900 font-bold">
                    {confirmDeleteSub.studentName} ({confirmDeleteSub.anonymousCode})
                  </strong>{' '}
                  gồm <strong className="text-slate-900">{confirmDeleteSub.pages.length} trang</strong> bài thi không?
                </p>
                <p className="text-[11px] text-rose-600 font-semibold mt-1">
                  ⚠️ Toàn bộ hình ảnh bài làm, bản chép và kết quả chấm điểm của em này sẽ bị xóa khỏi đợt chấm.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteSub(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSubmission(confirmDeleteSub.id);
                  setConfirmDeleteSub(null);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa học sinh này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE PAGE MODAL */}
      {confirmDeletePageId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Xóa trang này khỏi bài làm?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Trang ảnh sẽ bị gỡ bỏ vĩnh viễn.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeletePageId(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteDeletePage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Xác nhận xóa trang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
