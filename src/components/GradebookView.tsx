import React, { useState, useMemo } from 'react';
import {
  StudentSubmission,
  ExamSession,
  STATUS_LABELS,
  SubmissionStatus,
} from '../types';
import {
  Search,
  Filter,
  FileSpreadsheet,
  FileDown,
  Sparkles,
  Eye,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  FileText,
  Trash2,
  Plus,
} from 'lucide-react';
import { exportGradebookToExcel, exportSessionBackupJson } from '../utils/export';

interface GradebookViewProps {
  session: ExamSession;
  submissions: StudentSubmission[];
  onSelectSubmission: (submissionId: string, initialTab?: 'transcript' | 'grading') => void;
  onDeleteSubmission: (submissionId: string) => void;
  onBatchTranscribe: () => void;
  onBatchGrade: () => void;
  isBatchWorking: boolean;
  onAddNewStudent: () => void;
}

export const GradebookView: React.FC<GradebookViewProps> = ({
  session,
  submissions,
  onSelectSubmission,
  onDeleteSubmission,
  onBatchTranscribe,
  onBatchGrade,
  isBatchWorking,
  onAddNewStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtered & Sorted Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Search by name or code
      const matchSearch =
        sub.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.anonymousCode.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      let matchStatus = true;
      if (statusFilter === 'pending_transcription') {
        matchStatus = sub.status === 'waiting_transcription' || sub.status === 'receiving';
      } else if (statusFilter === 'needs_review') {
        matchStatus = sub.status === 'needs_transcript_review' || sub.status === 'needs_teacher_review';
      } else if (statusFilter === 'ready_to_grade') {
        matchStatus = sub.status === 'ready_to_grade';
      } else if (statusFilter === 'graded') {
        matchStatus = sub.status === 'graded_proposed';
      } else if (statusFilter === 'approved') {
        matchStatus = sub.status === 'approved';
      }

      return matchSearch && matchStatus;
    });
  }, [submissions, searchTerm, statusFilter]);

  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = isAnonymousMode ? a.anonymousCode : a.studentName;
        const nameB = isAnonymousMode ? b.anonymousCode : b.studentName;
        return sortDirection === 'asc'
          ? nameA.localeCompare(nameB, 'vi')
          : nameB.localeCompare(nameA, 'vi');
      } else if (sortBy === 'score') {
        const scoreA = a.teacherApprovedScore ?? a.gradingResult?.proposedTotalScore ?? -1;
        const scoreB = b.teacherApprovedScore ?? b.gradingResult?.proposedTotalScore ?? -1;
        return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      } else {
        return a.status.localeCompare(b.status);
      }
    });
  }, [filteredSubmissions, sortBy, sortDirection, isAnonymousMode]);

  // Statistics
  const totalCount = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const needsReviewCount = submissions.filter(
    (s) => s.status === 'needs_transcript_review' || s.status === 'needs_teacher_review'
  ).length;

  const averageScore = useMemo(() => {
    const scoredList = submissions.filter(
      (s) => s.teacherApprovedScore !== undefined || s.gradingResult?.proposedTotalScore !== undefined
    );
    if (scoredList.length === 0) return 0;
    const sum = scoredList.reduce(
      (acc, s) => acc + (s.teacherApprovedScore ?? s.gradingResult?.proposedTotalScore ?? 0),
      0
    );
    return Math.round((sum / scoredList.length) * 10) / 10;
  }, [submissions]);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Tổng số bài làm</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Đã duyệt chính thức</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Cần kiểm tra</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{needsReviewCount}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Điểm trung bình</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">{averageScore} / 10</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Controls Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm họ tên hoặc mã bài..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tất cả trạng thái ({totalCount})</option>
              <option value="pending_transcription">Chờ nhận dạng OCR</option>
              <option value="needs_review">Cần giáo viên kiểm tra ({needsReviewCount})</option>
              <option value="ready_to_grade">Sẵn sàng chấm</option>
              <option value="graded">Có điểm đề xuất</option>
              <option value="approved">Đã duyệt ({approvedCount})</option>
            </select>

            {/* Anonymous Grading Toggle */}
            <button
              onClick={() => setIsAnonymousMode(!isAnonymousMode)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                isAnonymousMode
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Ẩn tên học sinh, chỉ hiện mã bài để chấm khách quan"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Chấm ẩn danh {isAnonymousMode ? '(Bật)' : ''}</span>
            </button>
          </div>

          {/* Action & Export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onAddNewStudent}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-amber-600" />
              Thêm bài học sinh
            </button>

            <button
              onClick={() => exportGradebookToExcel(session, submissions)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất Excel
            </button>

            <button
              onClick={() => exportSessionBackupJson(session, submissions)}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Tải toàn bộ dữ liệu đợt chấm (.json)"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              Sao lưu
            </button>
          </div>
        </div>

        {/* Gradebook Content: Mobile Card List on phones, Full Table on Desktop */}
        
        {/* MOBILE CARD LIST (phones) */}
        <div className="md:hidden divide-y divide-slate-100">
          {sortedSubmissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Không tìm thấy bài làm nào phù hợp.
            </div>
          ) : (
            sortedSubmissions.map((sub, index) => {
              const statusInfo = STATUS_LABELS[sub.status] || {
                label: sub.status,
                badgeColor: 'bg-slate-100 text-slate-700',
              };
              const finalScore = sub.teacherApprovedScore;
              const proposedScore = sub.gradingResult?.proposedTotalScore;

              return (
                <div
                  key={sub.id}
                  onClick={() => onSelectSubmission(sub.id, 'grading')}
                  className="p-4 space-y-2.5 active:bg-amber-50/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono font-bold text-[11px] text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                          {sub.anonymousCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {sub.pages.length} trang
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isAnonymousMode ? '[Học sinh ẩn danh]' : sub.studentName}
                      </h4>
                      <span className="text-slate-500 text-[11px]">
                        Lớp {sub.className || session.className}
                      </span>
                    </div>

                    {/* Scores Badge */}
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-lg font-black text-amber-800 font-mono">
                          {finalScore !== undefined
                            ? `${finalScore}đ`
                            : proposedScore !== undefined
                            ? `${proposedScore}đ*`
                            : '-'}
                        </span>
                        <span className="text-[10px] text-slate-400">/10</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {finalScore !== undefined ? 'Đã duyệt' : 'Đề xuất'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${statusInfo.badgeColor}`}
                    >
                      {statusInfo.label}
                    </span>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectSubmission(sub.id, 'transcript')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Bản chép
                      </button>
                      <button
                        onClick={() => onSelectSubmission(sub.id, 'grading')}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Chấm
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa bài của ${sub.studentName}?`)) {
                            onDeleteSubmission(sub.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 w-12 text-center">STT</th>
                <th className="p-3.5 w-24">Mã bài</th>
                <th
                  className="p-3.5 cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    if (sortBy === 'name') setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                    else {
                      setSortBy('name');
                      setSortDirection('asc');
                    }
                  }}
                >
                  Họ và tên học sinh
                </th>
                <th className="p-3.5 w-20 text-center">Số trang</th>
                <th
                  className="p-3.5 w-28 text-center cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    if (sortBy === 'score') setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                    else {
                      setSortBy('score');
                      setSortDirection('desc');
                    }
                  }}
                >
                  Điểm AI đề xuất
                </th>
                <th className="p-3.5 w-28 text-center">Điểm đã duyệt</th>
                <th className="p-3.5 w-40">Trạng thái</th>
                <th className="p-3.5">Lời phê & Ghi chú</th>
                <th className="p-3.5 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Không tìm thấy bài làm nào phù hợp điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                sortedSubmissions.map((sub, index) => {
                  const statusInfo = STATUS_LABELS[sub.status] || {
                    label: sub.status,
                    badgeColor: 'bg-slate-100 text-slate-700',
                  };
                  const finalScore = sub.teacherApprovedScore;
                  const proposedScore = sub.gradingResult?.proposedTotalScore;

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                      onClick={() => onSelectSubmission(sub.id, 'grading')}
                    >
                      <td className="p-3.5 text-center font-mono text-slate-400 font-bold">
                        {index + 1}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-amber-900">
                        {sub.anonymousCode}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {isAnonymousMode ? (
                          <span className="text-slate-400 italic">[Ẩn danh]</span>
                        ) : (
                          sub.studentName
                        )}
                        <span className="text-slate-400 font-normal text-[11px] block">
                          {sub.className || session.className}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-semibold text-slate-600">
                        {sub.pages.length}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                        {proposedScore !== undefined ? `${proposedScore}` : '-'}
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-amber-700 text-sm">
                        {finalScore !== undefined ? (
                          <span className="text-emerald-700">{finalScore}</span>
                        ) : sub.status === 'approved' ? (
                          proposedScore
                        ) : (
                          <span className="text-slate-300 font-normal text-xs">Chưa duyệt</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusInfo.badgeColor}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate text-[11px] italic">
                        {sub.teacherNotes || sub.gradingResult?.teacherFeedbackSummary || '-'}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onSelectSubmission(sub.id, 'transcript')}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-700"
                            title="Kiểm tra bản chép & ảnh"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSelectSubmission(sub.id, 'grading')}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-700"
                            title="Chấm & duyệt điểm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa bài của ${sub.studentName}?`)) {
                                onDeleteSubmission(sub.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"
                            title="Xóa bài này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
