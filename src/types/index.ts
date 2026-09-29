export type SubmissionStatus =
  | 'receiving' // Đang tiếp nhận
  | 'waiting_transcription' // Chờ nhận dạng
  | 'transcribing' // Đang nhận dạng
  | 'needs_transcript_review' // Cần kiểm tra bản chép
  | 'ready_to_grade' // Sẵn sàng chấm
  | 'grading' // Đang chấm
  | 'graded_proposed' // Có điểm đề xuất
  | 'needs_teacher_review' // Cần giáo viên kiểm tra
  | 'approved' // Đã duyệt
  | 'error'; // Xử lý lỗi

export interface UncertainSegment {
  originalSnippet: string;
  suggestedReadings: string[];
  reason?: string;
}

export interface SubmissionPage {
  id: string;
  pageNumber: number;
  imageData: string; // base64
  rotation: number; // 0, 90, 180, 270
  flippedH: boolean;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  pageStatus: 'clear' | 'needs_check' | 'unreadable';
  pageText?: string;
  uncertainSegments?: UncertainSegment[];
  isCloseUpDetail?: boolean;
  parentPageNumber?: number;
}

export interface RubricCriterion {
  id: string;
  section: string;
  questionOrPart: string;
  requirement: string;
  maxScore: number;
  acceptableAnswers: string[];
  scoringGuide?: string;
}

export interface Rubric {
  title: string;
  sourceType: 'teacher_provided' | 'ai_proposed';
  version: number;
  totalMaxScore: number;
  criteria: RubricCriterion[];
  notes?: string;
}

export interface CriterionScore {
  criterionId: string;
  section: string;
  questionOrPart: string;
  requirement?: string;
  maxScore: number;
  awardedScore: number;
  evidenceQuote: string;
  achievementLevel: string;
  rationale: string;
  flaggedForReview?: boolean;
}

export interface EssayErrorItem {
  location: string;
  originalQuote: string;
  errorType: string;
  isMajor: boolean; // true = Lỗi cần sửa, false = Gợi ý để bài viết tốt hơn
  explanation: string;
  suggestion: string;
}

export interface GradingResult {
  criteriaScores: CriterionScore[];
  strengths: string[];
  errors: EssayErrorItem[];
  needsTeacherCheckItems?: Array<{ item: string; reason: string }>;
  teacherFeedbackSummary: string;
  rawCalculatedScore: number;
  proposedTotalScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  rubricVersionUsed: number;
}

export interface StudentSubmission {
  id: string;
  sessionId: string;
  anonymousCode: string; // e.g. "NV-001"
  studentName: string;
  className: string;
  schoolOrCode?: string;
  pages: SubmissionPage[];
  status: SubmissionStatus;
  errorMessage?: string;
  originalTranscription: string;
  editedTranscription: string;
  transcriptConfirmed: boolean;
  transcriptAuditLog: Array<{ timestamp: string; note: string }>;
  gradingResult?: GradingResult;
  teacherApprovedScore?: number;
  teacherNotes?: string;
  teacherAdjustmentReason?: string;
  approvedAt?: string;
}

export interface ExamSession {
  id: string;
  title: string;
  school: string;
  gradeLevel: string;
  className: string;
  durationMinutes: number;
  examPrompt: string;
  answerKeyText: string;
  hasOfficialAnswerKey: boolean;
  studentRoster: string[];
  maxScore: number;
  roundingRule: number; // e.g. 0.1, 0.25, 0.5
  rubric: Rubric;
  createdAt: string;
  updatedAt: string;
}

export type DeviceMode = 'auto' | 'mobile' | 'desktop';

export const STATUS_LABELS: Record<SubmissionStatus, { label: string; badgeColor: string }> = {
  receiving: { label: 'Đang tiếp nhận', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
  waiting_transcription: { label: 'Chờ nhận dạng', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  transcribing: { label: 'Đang nhận dạng...', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse' },
  needs_transcript_review: { label: 'Cần kiểm tra bản chép', badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
  ready_to_grade: { label: 'Sẵn sàng chấm', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  grading: { label: 'Đang chấm điểm...', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse' },
  graded_proposed: { label: 'Có điểm đề xuất', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  needs_teacher_review: { label: 'Cần giáo viên kiểm tra', badgeColor: 'bg-orange-50 text-orange-800 border-orange-300' },
  approved: { label: 'Đã duyệt kết quả', badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  error: { label: 'Xử lý lỗi', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
};
