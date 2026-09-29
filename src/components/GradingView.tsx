import React, { useState, useEffect, useRef } from 'react';
import {
  StudentSubmission,
  ExamSession,
  CriterionScore,
  EssayErrorItem,
  Rubric,
} from '../types';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Award,
  FileDown,
  Edit3,
  ThumbsUp,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Plus,
  Minus,
  Upload,
  FileText,
  BookOpen,
  Trash2,
  RefreshCw,
  Camera,
  Layers,
  Users,
  Loader2,
} from 'lucide-react';
import { exportStudentReportToWord, exportTranscriptionText } from '../utils/export';

interface GradingViewProps {
  submission: StudentSubmission;
  session: ExamSession;
  onSaveSubmission: (updated: StudentSubmission) => void;
  onSaveSession?: (updatedSession: ExamSession) => void;
  onBackToTranscript: () => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onNavigateTab?: (tab: 'config' | 'organizer' | 'transcript' | 'grading' | 'gradebook') => void;
  submissions?: StudentSubmission[];
  activeSubmissionId?: string;
  onSelectSubmission?: (id: string) => void;
  onBatchGrade?: () => Promise<void>;
  isBatchWorking?: boolean;
  globalStatusMessage?: string | null;
}

export const GradingView: React.FC<GradingViewProps> = ({
  submission,
  session,
  onSaveSubmission,
  onSaveSession,
  onBackToTranscript,
  showToast,
  onNavigateTab,
  submissions,
  activeSubmissionId,
  onSelectSubmission,
  onBatchGrade,
  isBatchWorking,
  globalStatusMessage,
}) => {
  // Grading & Progress state
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStepMessage, setGradingStepMessage] = useState<string | null>(null);
  const [gradingErrorMessage, setGradingErrorMessage] = useState<string | null>(null);

  // Exam Prompt & Answer Key state
  const [isExamDocOpen, setIsExamDocOpen] = useState(true);
  const [examPrompt, setExamPrompt] = useState(session.examPrompt || '');
  const [answerKeyText, setAnswerKeyText] = useState(session.answerKeyText || '');
  const [isExtractingPrompt, setIsExtractingPrompt] = useState(false);
  const [isExtractingKey, setIsExtractingKey] = useState(false);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);

  // Manual essay input state (if student has neither pages nor transcript)
  const [manualEssayInput, setManualEssayInput] = useState('');
  const [showManualInputBox, setShowManualInputBox] = useState(false);

  // Teacher score adjustments
  const [teacherScore, setTeacherScore] = useState<number>(
    submission.teacherApprovedScore !== undefined
      ? submission.teacherApprovedScore
      : submission.gradingResult?.proposedTotalScore || 0
  );
  const [teacherNotes, setTeacherNotes] = useState(
    submission.teacherNotes || submission.gradingResult?.teacherFeedbackSummary || ''
  );
  const [adjustmentReason, setAdjustmentReason] = useState(
    submission.teacherAdjustmentReason || ''
  );
  const [isApproved, setIsApproved] = useState(submission.status === 'approved');
  const [copiedComment, setCopiedComment] = useState(false);

  // Sync state when active submission or its grading result changes
  useEffect(() => {
    setTeacherScore(
      submission.teacherApprovedScore !== undefined
        ? submission.teacherApprovedScore
        : submission.gradingResult?.proposedTotalScore || 0
    );
    setTeacherNotes(
      submission.teacherNotes || submission.gradingResult?.teacherFeedbackSummary || ''
    );
    setAdjustmentReason(submission.teacherAdjustmentReason || '');
    setIsApproved(submission.status === 'approved');
    setGradingErrorMessage(null);
    setGradingStepMessage(null);
  }, [submission.id, submission.gradingResult?.proposedTotalScore, submission.status]);

  // Sync exam prompt & answer key when session updates
  useEffect(() => {
    setExamPrompt(session.examPrompt || '');
    setAnswerKeyText(session.answerKeyText || '');
  }, [session.examPrompt, session.answerKeyText]);

  // Hidden file inputs
  const examPromptFileInputRef = useRef<HTMLInputElement>(null);
  const answerKeyFileInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (showToast) {
      showToast(msg, type);
    }
  };

  // Save changes to Exam Prompt or Answer Key
  const handleUpdateExamDocs = (newPrompt: string, newAnswerKey: string) => {
    setExamPrompt(newPrompt);
    setAnswerKeyText(newAnswerKey);
    if (onSaveSession) {
      onSaveSession({
        ...session,
        examPrompt: newPrompt,
        answerKeyText: newAnswerKey,
        hasOfficialAnswerKey: Boolean(newAnswerKey.trim()),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Upload & Extract Exam Prompt Document (Image, PDF, TXT)
  const handleExamPromptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingPrompt(true);
    setGradingErrorMessage(null);

    try {
      if (file.type.startsWith('text/')) {
        const text = await file.text();
        handleUpdateExamDocs(text, answerKeyText);
        notify('Đã tải lên và lưu nội dung Đề bài.', 'success');
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const res = await fetch('/api/gemini/extract-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: base64Data,
                docType: 'exam_prompt',
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Lỗi trích xuất đề bài.');
            }

            const data = await res.json();
            const extracted = data.extractedText || '';
            handleUpdateExamDocs(extracted, answerKeyText);
            notify('Đã dùng AI trích xuất nội dung Đề thi từ tệp tải lên.', 'success');
          } catch (err: any) {
            setGradingErrorMessage(err.message || 'Không thể trích xuất đề thi.');
          } finally {
            setIsExtractingPrompt(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err: any) {
      setGradingErrorMessage(err.message || 'Lỗi khi đọc tệp đề thi.');
    } finally {
      setIsExtractingPrompt(false);
      if (examPromptFileInputRef.current) examPromptFileInputRef.current.value = '';
    }
  };

  // Upload & Extract Answer Key Document (Image, PDF, TXT)
  const handleAnswerKeyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingKey(true);
    setGradingErrorMessage(null);

    try {
      if (file.type.startsWith('text/')) {
        const text = await file.text();
        handleUpdateExamDocs(examPrompt, text);
        notify('Đã tải lên và lưu nội dung Đáp án & Hướng dẫn chấm.', 'success');
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const res = await fetch('/api/gemini/extract-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: base64Data,
                docType: 'answer_key',
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Lỗi trích xuất đáp án.');
            }

            const data = await res.json();
            const extracted = data.extractedText || '';
            handleUpdateExamDocs(examPrompt, extracted);
            notify('Đã dùng AI trích xuất Đáp án & Biểu điểm từ tệp tải lên.', 'success');
          } catch (err: any) {
            setGradingErrorMessage(err.message || 'Không thể trích xuất đáp án.');
          } finally {
            setIsExtractingKey(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err: any) {
      setGradingErrorMessage(err.message || 'Lỗi khi đọc tệp đáp án.');
    } finally {
      setIsExtractingKey(false);
      if (answerKeyFileInputRef.current) answerKeyFileInputRef.current.value = '';
    }
  };

  // Generate Rubric from Exam Prompt & Answer Key
  const handleAutoBuildRubric = async () => {
    if (!examPrompt.trim() && !answerKeyText.trim()) {
      notify('Vui lòng nhập hoặc tải Đề bài / Đáp án trước khi tạo Rubric.', 'warning');
      return;
    }

    setIsGeneratingRubric(true);
    try {
      const res = await fetch('/api/gemini/generate-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examPrompt,
          answerKeyText,
          gradeLevel: session.gradeLevel || 'THCS',
          examTitle: session.title,
          maxScore: 10,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi khi tạo ma trận chấm.');
      }

      const generatedRubric: Rubric = await res.json();
      if (onSaveSession) {
        onSaveSession({
          ...session,
          rubric: {
            ...generatedRubric,
            version: (session.rubric?.version || 1) + 1,
          },
          updatedAt: new Date().toISOString(),
        });
      }
      notify('Đã cập nhật Ma trận Rubric 10 điểm bám sát Đề & Đáp án!', 'success');
    } catch (err: any) {
      setGradingErrorMessage(err.message || 'Không thể tạo ma trận chấm.');
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // Load realistic THCS literature exam & answer key sample
  const handleLoadSampleThcsDocs = () => {
    const samplePrompt = `ĐỀ KIỂM TRA MÔN NGỮ VĂN - CẤP THCS (LỚP 9)
Thời gian làm bài: 90 phút

I. PHẦN ĐỌC HIỂU (4.0 điểm)
Đọc đoạn thơ sau trong bài "Mùa xuân nho nhỏ" của nhà thơ Thanh Hải:

"Ta làm con chim hót
Ta làm một cành hoa
Ta nhập vào hòa ca
Một nốt trầm xao xuyến.

Một mùa xuân nho nhỏ
Lặng lẽ dâng cho đời
Dù là tuổi hai mươi
Dù là khi tóc bạc."

Thực hiện các yêu cầu sau:
Câu 1 (0.5 điểm): Xác định thể thơ và phương thức biểu đạt chính của đoạn thơ.
Câu 2 (0.5 điểm): Tác giả đã dùng những hình ảnh nào để thể hiện ước nguyện của mình?
Câu 3 (1.0 điểm): Nêu và phân tích tác dụng của điệp ngữ "Ta làm", "Dù là" trong đoạn thơ.
Câu 4 (2.0 điểm): Từ ước nguyện chân thành của nhà thơ Thanh Hải, em hãy rút ra bài học lẽ sống cao đẹp cho bản thân.

II. PHẦN LÀM VĂN (6.0 điểm)
Cảm nhận của em về khát vọng cống hiến thầm lặng và tình yêu quê hương đất nước tha thiết của nhà thơ Thanh Hải qua đoạn thơ trên. Từ đó, hãy liên hệ với trách nhiệm của thế hệ trẻ hôm nay đối với đất nước.`;

    const sampleAnswerKey = `ĐÁP ÁN VÀ BIỂU ĐIỂM CHẤM MÔN NGỮ VĂN THCS (LỚP 9)
Thang điểm tổng: 10.0 điểm

I. PHẦN ĐỌC HIỂU (4.0 điểm)
- Câu 1 (0.5đ): Thể thơ 5 chữ; Phương thức biểu đạt chính: Biểu cảm. (Mỗi ý đúng 0.25đ).
- Câu 2 (0.5đ): Các hình ảnh: "con chim hót", "một cành hoa", "nốt trầm xao xuyến".
- Câu 3 (1.0đ):
  + Điệp từ "Ta làm", "Dù là" tạo nhịp điệu tha thiết, dồn dập, khẳng định quyết tâm và ước nguyện cống hiến bền bỉ, suốt cả cuộc đời (từ tuổi hai mươi đến khi tóc bạc). (1.0đ)
- Câu 4 (2.0đ):
  + Nêu rõ bài học: Lẽ sống cống hiến khiêm nhường, thầm lặng, không phô trương; sống có ích cho cộng đồng. (1.0đ)
  + Lý giải thuyết phục, có liên hệ bản thân chân thành. (1.0đ)

II. PHẦN LÀM VĂN (6.0 điểm)
1. Mở bài (1.0đ): Dẫn dắt tác giả Thanh Hải, hoàn cảnh sáng tác đặc biệt trên giường bệnh và nêu vấn đề khát vọng cống hiến.
2. Thân bài (4.0đ):
   - Luận điểm 1: Ước nguyện hóa thân khiêm nhường (con chim, cành hoa, nốt trầm). (1.5đ)
   - Luận điểm 2: Quan niệm sống cống hiến "Lặng lẽ dâng cho đời" không kể thời gian tuổi tác. (1.5đ)
   - Luận điểm 3: Đánh giá nghệ thuật (thể thơ, giọng điệu tâm tình, hình ảnh giản dị mà giàu sức khái quát) và liên hệ trách nhiệm tuổi trẻ hôm nay. (1.0đ)
3. Kết bài (0.5đ): Khẳng định lại giá trị trường tồn của thi phẩm và xúc cảm bản thân.
4. Kỹ năng & Sáng tạo (0.5đ): Bố cục mạch lạc, chuẩn chính tả, ngữ pháp tiếng Việt, hành văn biểu cảm.`;

    handleUpdateExamDocs(samplePrompt, sampleAnswerKey);
    notify('Đã nạp Đề thi & Đáp án chuẩn THCS (Mùa xuân nho nhỏ - Lớp 9)!', 'success');
  };

  // Main Action: Trigger Gemini Grading with Multi-Step Pipeline
  const handleRunGrading = async () => {
    setGradingErrorMessage(null);
    setIsGrading(true);

    try {
      let currentText = (submission.editedTranscription || submission.originalTranscription || '').trim();

      // Step 1: If no transcript, check if pages exist and transcribe first
      if (!currentText) {
        if (submission.pages && submission.pages.length > 0) {
          setGradingStepMessage(
            `Bước 1/2: Đang tự động nhận dạng chữ viết tay từ ${submission.pages.length} trang ảnh bài làm...`
          );

          const ocrRes = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              images: submission.pages.map((p) => ({
                pageNumber: p.pageNumber,
                data: p.imageData,
              })),
              existingStudentInfo: {
                studentName: submission.studentName,
                className: submission.className,
              },
            }),
          });

          if (!ocrRes.ok) {
            const err = await ocrRes.json();
            throw new Error(err.error || 'Lỗi nhận dạng ảnh bài làm.');
          }

          const ocrData = await ocrRes.json();
          currentText = (ocrData.rawTranscription || '').trim();

          if (!currentText) {
            throw new Error('Ảnh bài làm bị mờ hoặc không nhận dạng được chữ viết.');
          }

          // Update submission with transcript
          const updatedWithTranscript: StudentSubmission = {
            ...submission,
            studentName: ocrData.studentName && ocrData.studentName !== 'Chưa xác định' ? ocrData.studentName : submission.studentName,
            className: ocrData.className || submission.className,
            originalTranscription: currentText,
            editedTranscription: currentText,
            status: 'ready_to_grade',
            transcriptAuditLog: [
              {
                timestamp: new Date().toISOString(),
                note: `Tự động nhận dạng OCR trước khi chấm lúc ${new Date().toLocaleTimeString('vi-VN')}`,
              },
              ...(submission.transcriptAuditLog || []),
            ],
          };

          // If exam prompt was detected on the student test paper image, automatically populate exam prompt
          if (ocrData.hasExamPrompt && ocrData.detectedExamPrompt && ocrData.detectedExamPrompt.trim().length > 15) {
            const detectedPrompt = ocrData.detectedExamPrompt.trim();
            handleUpdateExamDocs(detectedPrompt, answerKeyText);
            notify('📝 AI đã tự động trích xuất Đề bài từ ảnh vào mục Đề thi!', 'success');
          }

          onSaveSubmission(updatedWithTranscript);
        } else if (manualEssayInput.trim()) {
          // Use manual essay input
          currentText = manualEssayInput.trim();
          const updatedWithManual: StudentSubmission = {
            ...submission,
            originalTranscription: currentText,
            editedTranscription: currentText,
            status: 'ready_to_grade',
          };
          onSaveSubmission(updatedWithManual);
        } else {
          // No content to grade
          setShowManualInputBox(true);
          throw new Error(
            'Học sinh chưa có ảnh chụp bài làm hoặc bản chép. Vui lòng bấm [📸 Bật máy ảnh chụp] hoặc dán nội dung bài làm bên dưới để chấm.'
          );
        }
      }

      // Step 2: Run AI Grading
      setGradingStepMessage('Bước 2/2: Đang đối chiếu bài làm với Đề thi & Đáp án, trích xuất bằng chứng...');

      const gradingRes = await fetch('/api/gemini/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentTranscript: currentText,
          rubric: session.rubric,
          examPrompt,
          answerKeyText,
          studentName: submission.studentName,
          roundingRule: session.roundingRule || 0.1,
        }),
      });

      if (!gradingRes.ok) {
        const err = await gradingRes.json();
        throw new Error(err.error || 'Lỗi khi chấm điểm bài thi.');
      }

      const result = await gradingRes.json();
      const hasFlagged = result.criteriaScores?.some((c: any) => c.flaggedForReview);

      const updatedSub: StudentSubmission = {
        ...submission,
        originalTranscription: currentText,
        editedTranscription: currentText,
        gradingResult: {
          ...result,
          rubricVersionUsed: session.rubric?.version || 1,
        },
        status: hasFlagged ? 'needs_teacher_review' : 'graded_proposed',
        teacherNotes: result.teacherFeedbackSummary,
      };

      setTeacherScore(result.proposedTotalScore);
      setTeacherNotes(result.teacherFeedbackSummary);
      setIsApproved(false);
      onSaveSubmission(updatedSub);
      notify(`Đã chấm xong bài của ${submission.studentName}: ${result.proposedTotalScore} điểm!`, 'success');
    } catch (err: any) {
      setGradingErrorMessage(err.message || 'Không thể thực hiện chấm bài.');
    } finally {
      setIsGrading(false);
      setGradingStepMessage(null);
    }
  };

  // Adjust individual criterion score manually
  const handleUpdateCriterionScore = (idx: number, newScore: number) => {
    if (!submission.gradingResult) return;
    const updatedScores = [...submission.gradingResult.criteriaScores];
    const item = updatedScores[idx];
    const clamped = Math.max(0, Math.min(item.maxScore, Math.round(newScore * 10) / 10));
    updatedScores[idx] = { ...item, awardedScore: clamped };

    const rawTotal = updatedScores.reduce((sum, c) => sum + c.awardedScore, 0);
    const factor = 1 / (session.roundingRule || 0.1);
    const rounded = Math.round(rawTotal * factor) / factor;
    const finalScore = Math.min(10, Math.max(0, rounded));

    const updatedSub: StudentSubmission = {
      ...submission,
      gradingResult: {
        ...submission.gradingResult,
        criteriaScores: updatedScores,
        rawCalculatedScore: Math.round(rawTotal * 100) / 100,
        proposedTotalScore: finalScore,
      },
    };

    setTeacherScore(finalScore);
    onSaveSubmission(updatedSub);
  };

  // Teacher Final Approval
  const handleApprove = () => {
    const updatedSub: StudentSubmission = {
      ...submission,
      teacherApprovedScore: teacherScore,
      teacherNotes,
      teacherAdjustmentReason: adjustmentReason,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    };

    setIsApproved(true);
    onSaveSubmission(updatedSub);
    notify(`Đã xác nhận điểm chính thức: ${teacherScore}đ cho ${submission.studentName}.`, 'success');
  };

  const handleCopyComment = () => {
    navigator.clipboard.writeText(teacherNotes);
    setCopiedComment(true);
    setTimeout(() => setCopiedComment(false), 2000);
  };

  // Sample student essay for quick testing if empty
  const handleLoadSampleEssayForStudent = () => {
    const sampleEssay = `I. PHẦN ĐỌC HIỂU
Câu 1: Đoạn thơ được viết theo thể thơ 5 chữ (ngũ ngôn). Phương thức biểu đạt chính là biểu cảm kết hợp miêu tả.
Câu 2: Tác giả Thanh Hải đã sử dụng các hình ảnh giản dị, thanh khiết của thiên nhiên để thể hiện ước nguyện của mình: "con chim hót", "một cành hoa", "một nốt trầm xao xuyến".
Câu 3: Phép điệp từ "Ta làm", "Dù là" tạo âm hưởng tha thiết, trầm lắng mà dứt khoát. Nhấn mạnh tâm nguyện tha thiết, bền bỉ và trách nhiệm sống cống hiến không ngừng nghỉ suốt cuộc đời, bất kể tuổi tác ("khi tóc bạc").
Câu 4: Bài học lẽ sống: Mỗi con người cần sống khiêm nhường, biết cống hiến những gì tinh túy, đẹp đẽ nhất cho quê hương đất nước mà không màng danh lợi hay đòi hỏi đền đáp.

II. PHẦN LÀM VĂN
Thanh Hải viết "Mùa xuân nho nhỏ" vào tháng 11/1980, khi ông đang nằm trên giường bệnh những ngày cuối đời. Trong hoàn cảnh sinh ly tử biệt ấy, nhà thơ không hề bi lụy mà trái lại bừng lên một tình yêu tha thiết với cuộc sống và quê hương đất nước.
Khát vọng của ông thật khiêm nhường: làm "con chim hót" mang lại niềm vui, làm "cành hoa" tô điểm sắc hương cho đời, làm "nốt trầm" hòa vào bản hòa ca lớn của dân tộc. Điệp từ "Ta làm" chuyển từ đại từ "Tôi" ở đầu bài sang "Ta" khẳng định sự hòa quyện giữa cá nhân với tập thể.
Đặc biệt, hình ảnh "Mùa xuân nho nhỏ" là một ẩn dụ sáng tạo độc đáo: mỗi người là một mùa xuân riêng góp phần tạo nên mùa xuân bất tận của đất nước. Lối sống "lặng lẽ dâng cho đời" từ tuổi hai mươi đến khi đầu bạc nhắc nhở thế hệ trẻ hôm nay phải biết sống có trách nhiệm, rèn đức luyện tài để xây dựng quê hương giàu đẹp.`;

    const updatedSub: StudentSubmission = {
      ...submission,
      originalTranscription: sampleEssay,
      editedTranscription: sampleEssay,
      status: 'ready_to_grade',
    };
    onSaveSubmission(updatedSub);
    setShowManualInputBox(false);
    notify('Đã nạp bài làm mẫu học sinh THCS thành công!', 'success');
  };

  const gradingResult = submission.gradingResult;
  const majorErrors = gradingResult?.errors?.filter((e) => e.isMajor) || [];
  const minorSuggestions = gradingResult?.errors?.filter((e) => !e.isMajor) || [];
  const hasTranscript = Boolean((submission.editedTranscription || submission.originalTranscription || '').trim());
  const hasPages = Boolean(submission.pages && submission.pages.length > 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col space-y-5 p-3.5 sm:p-6 pb-28 md:pb-8">
      {/* MULTI-STUDENT SELECTOR RIBBON (When multiple students exist in session) */}
      {submissions && submissions.length > 1 && onSelectSubmission && (
        <div className="bg-slate-900 text-white -mx-3.5 sm:-mx-6 -mt-3.5 sm:-mt-6 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto border-b border-slate-800 shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 shrink-0">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Danh sách bài thi</span>
            <span>({submissions.length} HS):</span>
          </div>

          {/* Scrollable student pills with live grading scores */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {submissions.map((sub, idx) => {
              const isCurrent = sub.id === submission.id;
              const isGraded = Boolean(sub.gradingResult);
              const score = sub.teacherApprovedScore !== undefined
                ? sub.teacherApprovedScore
                : sub.gradingResult?.proposedTotalScore;

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
                  {isGraded ? (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                      isCurrent
                        ? 'bg-amber-950/20 text-slate-950'
                        : sub.status === 'approved'
                        ? 'bg-emerald-900 text-emerald-300'
                        : 'bg-amber-900/80 text-amber-300'
                    }`}>
                      {score}đ
                    </span>
                  ) : (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isCurrent ? 'bg-amber-950/20 text-slate-950' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {sub.pages.length} tr
                    </span>
                  )}
                  {isGraded && (
                    <CheckCircle className={`w-3 h-3 ${isCurrent ? 'text-slate-950' : 'text-emerald-400'}`} />
                  )}
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

      {/* 1. TOP HEADER SUMMARY & NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-slate-50 border border-amber-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToTranscript}
            className="p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shrink-0 shadow-xs"
            title="Quay lại kiểm tra bản chép"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-200 text-amber-950 rounded-full font-bold text-xs font-mono">
                {submission.anonymousCode}
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {submission.studentName}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium flex items-center gap-2">
              <span>Lớp {submission.className || session.className || 'THCS'}</span>
              <span>•</span>
              <span>Đã chụp: <strong className="text-slate-800">{submission.pages.length} trang</strong></span>
              <span>•</span>
              <span className={hasTranscript ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                {hasTranscript ? '✓ Đã có bản chép' : 'Chưa có bản chép (AI tự quét khi bấm chấm)'}
              </span>
            </p>
          </div>
        </div>

        {/* Score Badge & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          <div className="text-right mr-1">
            <span className="text-[10.5px] text-slate-500 block font-semibold">Tổng điểm đề xuất</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono tracking-tight">
              {gradingResult ? `${gradingResult.proposedTotalScore}đ` : 'Chưa chấm'}
            </span>
          </div>

          {/* BATCH GRADE ALL STUDENTS BUTTON */}
          {submissions && submissions.length > 1 && onBatchGrade && (
            <button
              onClick={onBatchGrade}
              disabled={isBatchWorking || isGrading}
              className="px-3.5 py-3 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
              title="Tự động chấm toàn bộ tất cả bài thi của học sinh trong đợt này"
            >
              {isBatchWorking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>{globalStatusMessage || 'Đang chấm tất cả...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>⚡ Chấm tất cả ({submissions.length} bài)</span>
                </>
              )}
            </button>
          )}

          {/* SINGLE STUDENT GRADE BUTTON */}
          <button
            onClick={handleRunGrading}
            disabled={isGrading || isBatchWorking}
            className="px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 transition-all disabled:opacity-50"
            title="Bắt đầu phân tích và chấm điểm với Gemini AI"
          >
            <Sparkles className={`w-4 h-4 ${isGrading ? 'animate-spin' : ''}`} />
            <span>{isGrading ? 'Đang chấm bài...' : gradingResult ? 'Chấm lại bài này' : 'Bắt đầu chấm với AI'}</span>
          </button>
        </div>
      </div>

      {/* 2. DEDICATED SECTION: HỒ SƠ ĐỀ BÀI & ĐÁP ÁN / HƯỚNG DẪN CHẤM (THCS) */}
      <div className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden transition-all">
        {/* Accordion Header */}
        <div
          onClick={() => setIsExamDocOpen(!isExamDocOpen)}
          className="p-3.5 sm:p-4 bg-slate-100/90 hover:bg-slate-200/70 cursor-pointer flex flex-wrap items-center justify-between gap-2 select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <span>HỒ SƠ ĐỀ THI & ĐÁP ÁN / HƯỚNG DẪN CHẤM (THCS)</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {isExamDocOpen ? '(Bấm để thu gọn)' : '(Bấm để mở rộng & xem/tải tài liệu)'}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold border ${
                    examPrompt.trim()
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {examPrompt.trim() ? '✓ Đã có Đề bài' : '○ Chưa có Đề bài (tùy chọn)'}
                </span>
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold border ${
                    answerKeyText.trim()
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {answerKeyText.trim() ? '✓ Đã có Đáp án / Biểu điểm' : '○ Chưa có Đáp án (tùy chọn)'}
                </span>
                <span className="text-[10.5px] text-slate-500 font-medium">
                  {session.rubric?.criteria?.length || 0} tiêu chí chấm (10đ)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSampleThcsDocs();
              }}
              className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
              title="Nạp nhanh đề thi và đáp án mẫu THCS để kiểm tra ngay"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Nạp Đề & Đáp án mẫu THCS</span>
            </button>
            <div className="p-1 rounded-lg text-slate-500">
              {isExamDocOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Accordion Body: Side-by-Side Upload & Editor Cards */}
        {isExamDocOpen && (
          <div className="p-3.5 sm:p-5 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* BOX 1: ĐỀ BÀI KIỂM TRA */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 flex flex-col space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    1. Đề bài (Đề thi Ngữ văn)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => examPromptFileInputRef.current?.click()}
                    disabled={isExtractingPrompt}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
                    title="Tải tệp ảnh chụp đề thi hoặc PDF, Word, TXT"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isExtractingPrompt ? 'Đang trích xuất...' : 'Tải lên Đề thi'}</span>
                  </button>
                  {examPrompt.trim() && (
                    <button
                      onClick={() => handleUpdateExamDocs('', answerKeyText)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Xóa nội dung đề bài"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={examPrompt}
                onChange={(e) => handleUpdateExamDocs(e.target.value, answerKeyText)}
                rows={6}
                placeholder="Dán hoặc nhập nội dung Đề bài tại đây (Phần Đọc hiểu, các câu hỏi và Phần Làm văn), hoặc bấm [Tải lên Đề thi] ở trên để AI tự trích xuất..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Chấp nhận: Ảnh JPG/PNG (chụp đề thi), PDF, Word, TXT</span>
                <span className="font-semibold text-slate-700">{examPrompt.length} ký tự</span>
              </div>
            </div>

            {/* BOX 2: ĐÁP ÁN & BIỂU ĐIỂM (HƯỚNG DẪN CHẤM) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 flex flex-col space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    2. Đáp án & Biểu điểm / Hướng dẫn chấm
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => answerKeyFileInputRef.current?.click()}
                    disabled={isExtractingKey}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
                    title="Tải tệp ảnh chụp biểu điểm hoặc tài liệu đáp án"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isExtractingKey ? 'Đang trích xuất...' : 'Tải lên Đáp án'}</span>
                  </button>
                  {answerKeyText.trim() && (
                    <button
                      onClick={() => handleUpdateExamDocs(examPrompt, '')}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Xóa nội dung đáp án"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={answerKeyText}
                onChange={(e) => handleUpdateExamDocs(examPrompt, e.target.value)}
                rows={6}
                placeholder="Dán hoặc nhập Đáp án / Biểu điểm chi tiết (các ý bắt buộc, điểm từng câu, các phương án chấp nhận được)... hoặc bấm [Tải lên Đáp án] ở trên để AI tự đọc..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                <button
                  type="button"
                  onClick={handleAutoBuildRubric}
                  disabled={isGeneratingRubric || (!examPrompt.trim() && !answerKeyText.trim())}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[11px] flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  title="Tự động phân bổ thang điểm 10 theo đúng Đề và Đáp án này"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingRubric ? 'Đang tạo Rubric...' : '⚡ Tạo Rubric từ Đề & Đáp án'}</span>
                </button>
                <span className="font-semibold text-slate-700">{answerKeyText.length} ký tự</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Inputs for Document Extraction */}
      <input
        ref={examPromptFileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleExamPromptFileUpload}
        className="hidden"
      />
      <input
        ref={answerKeyFileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleAnswerKeyFileUpload}
        className="hidden"
      />

      {/* 3. STEP PROGRESS OR ERROR ALERTS */}
      {gradingStepMessage && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500 text-slate-950 border border-amber-300 shadow-md flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin shrink-0 text-slate-950" />
          <div className="min-w-0">
            <span className="block font-black text-xs sm:text-sm tracking-tight">
              {gradingStepMessage}
            </span>
            <span className="block text-[11px] text-amber-950 font-medium">
              Hệ thống đang xử lý tự động, thầy cô vui lòng đợi trong giây lát...
            </span>
          </div>
        </div>
      )}

      {gradingErrorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-rose-950">Chưa thể chấm điểm:</span>
              <p className="text-rose-800 mt-0.5 leading-relaxed">{gradingErrorMessage}</p>
            </div>
          </div>
          <button
            onClick={handleRunGrading}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shrink-0 shadow-xs"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 4. MANUAL ESSAY INPUT PANEL (IF STUDENT HAS NO CONTENT YET) */}
      {showManualInputBox && !hasTranscript && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border-2 border-dashed border-amber-300 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>DÁN HOẶC NHẬP NỘI DUNG BÀI LÀM CỦA HỌC SINH</span>
            </h4>
            <button
              onClick={handleLoadSampleEssayForStudent}
              className="text-[11px] font-bold px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
            >
              ⚡ Nạp bài làm mẫu học sinh THCS
            </button>
          </div>

          <textarea
            rows={5}
            value={manualEssayInput}
            onChange={(e) => setManualEssayInput(e.target.value)}
            placeholder="Dán toàn bộ văn bản bài làm của học sinh tại đây (hoặc quay lại tab Máy ảnh để chụp ảnh giấy thi)..."
            className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              💡 Thầy cô có thể dán trực tiếp bài làm từ Word, tin nhắn Zalo hoặc bài gõ tay.
            </span>
            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('organizer')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chụp / Nạp bài làm</span>
                </button>
              )}
              <button
                onClick={handleRunGrading}
                disabled={!manualEssayInput.trim() && !hasTranscript && !hasPages}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs shadow-md disabled:opacity-50"
              >
                Chấm bài này ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MAIN WORKSPACE: NOT GRADED YET VS GRADED RESULTS */}
      {!gradingResult ? (
        <div className="p-8 sm:p-14 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Bài làm của {submission.studentName} ({submission.anonymousCode}) chưa được chấm điểm
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Hệ thống sẽ đối chiếu nguyên văn bài làm của học sinh với Đề kiểm tra và Đáp án hướng dẫn chấm ở trên, trích xuất bằng chứng câu chữ xác thực và phát hiện lỗi.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleRunGrading}
              disabled={isGrading}
              className="px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl shadow-amber-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isGrading ? 'Đang chấm điểm...' : 'Bắt đầu chấm với AI'}</span>
            </button>

            {!hasTranscript && (
              <button
                onClick={handleLoadSampleEssayForStudent}
                className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-2xl text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Nạp bài làm mẫu học sinh</span>
              </button>
            )}

            {!hasTranscript && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('organizer')}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Quản lý & Chụp bài làm</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* GRADED RESULT PRESENTATION */
        <div className="space-y-6">
          {/* Section A: Criteria Breakdown (Mobile Card Layout vs Desktop Table) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Tiêu chí chấm & Bằng chứng xác thực
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Tổng cộng: <strong>{gradingResult.proposedTotalScore} / 10đ</strong>
              </span>
            </div>

            {/* MOBILE CARD VIEW: Thumb-friendly cards with stepper buttons */}
            <div className="space-y-3 md:hidden">
              {gradingResult.criteriaScores?.map((cs, idx) => (
                <div
                  key={cs.criterionId || idx}
                  className={`p-3.5 rounded-2xl border ${
                    cs.flaggedForReview
                      ? 'bg-amber-50/60 border-amber-300'
                      : 'bg-white border-slate-200 shadow-xs'
                  } space-y-2.5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        {cs.section}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{cs.questionOrPart}</h4>
                    </div>

                    {/* Stepper Buttons for Mobile Thumb Tuning */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => handleUpdateCriterionScore(idx, cs.awardedScore - 0.25)}
                        className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-xs active:scale-90"
                        title="Trừ 0.25đ"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-black text-amber-700 font-mono min-w-[36px] text-center">
                        {cs.awardedScore}/{cs.maxScore}
                      </span>
                      <button
                        onClick={() => handleUpdateCriterionScore(idx, cs.awardedScore + 0.25)}
                        className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-xs active:scale-90"
                        title="Cộng 0.25đ"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {cs.evidenceQuote && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700 italic">
                      <span className="font-semibold text-slate-500 not-italic block mb-0.5 text-[10px]">
                        Trích dẫn chứng thực:
                      </span>
                      "{cs.evidenceQuote}"
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600 leading-relaxed">{cs.rationale}</p>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Phần thi / Yêu cầu</th>
                    <th className="py-3 px-4">Trích dẫn bằng chứng từ bài làm</th>
                    <th className="py-3 px-4">Giải thích cho điểm</th>
                    <th className="py-3 px-4 text-center w-36">Điểm số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradingResult.criteriaScores?.map((cs, idx) => (
                    <tr
                      key={cs.criterionId || idx}
                      className={cs.flaggedForReview ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-3.5 px-4 align-top">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          {cs.section}
                        </span>
                        <span className="font-bold text-slate-900 block">{cs.questionOrPart}</span>
                        <span className="text-[10.5px] text-slate-500 mt-0.5 block max-w-xs">
                          {cs.achievementLevel && (
                            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-slate-200 text-slate-700 font-bold text-[9.5px] mr-1">
                              {cs.achievementLevel}
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        {cs.evidenceQuote ? (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 italic">
                            "{cs.evidenceQuote}"
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Không có trích dẫn trực tiếp</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-slate-600 text-[11px] leading-relaxed">
                        {cs.rationale}
                        {cs.flaggedForReview && (
                          <div className="mt-1 text-amber-700 font-bold flex items-center gap-1 text-[10.5px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Cần giáo viên đối chiếu ảnh gốc</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                          <button
                            onClick={() => handleUpdateCriterionScore(idx, cs.awardedScore - 0.25)}
                            className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-2xs hover:bg-slate-50"
                            title="Giảm 0.25đ"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-amber-700 font-mono min-w-[40px]">
                            {cs.awardedScore} / {cs.maxScore}
                          </span>
                          <button
                            onClick={() => handleUpdateCriterionScore(idx, cs.awardedScore + 0.25)}
                            className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-2xs hover:bg-slate-50"
                            title="Tăng 0.25đ"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Strengths & Corrections / Improvement Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-emerald-600" />
                Điểm mạnh nổi bật của bài làm
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-800">
                {gradingResult.strengths?.map((str, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Errors to fix */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Lỗi cần khắc phục & Gợi ý cải thiện
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {gradingResult.errors?.map((err, i) => (
                  <div key={i} className="text-xs bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span className="uppercase">{err.errorType}</span>
                      <span>{err.location}</span>
                    </div>
                    <p className="text-slate-800 italic text-[11px] mb-1">"{err.originalQuote}"</p>
                    <p className="text-amber-900 text-[11px]">{err.explanation}</p>
                    {err.suggestion && (
                      <p className="text-emerald-700 text-[10.5px] mt-1 font-medium">
                        💡 Gợi ý: {err.suggestion}
                      </p>
                    )}
                  </div>
                ))}
                {(!gradingResult.errors || gradingResult.errors.length === 0) && (
                  <p className="text-xs text-slate-500 italic">Không phát hiện lỗi nghiêm trọng.</p>
                )}
              </div>
            </div>
          </div>

          {/* Section C: Teacher Final Approval & Comments */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              Quyết định điểm chính thức của giáo viên
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Điểm phê duyệt cuối cùng:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={teacherScore}
                    onChange={(e) => setTeacherScore(Number(e.target.value))}
                    className="w-24 px-3 py-2 text-sm font-mono font-black text-amber-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-500">/ 10 điểm</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Lý do điều chỉnh (nếu có khác biệt với AI đề xuất):
                </label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Ví dụ: Khuyến khích cảm xúc chân thành (+0.25đ)..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Lời phê giáo viên (sẵn sàng chép vào sổ điểm / bài thi):
                  </label>
                  <button
                    onClick={handleCopyComment}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                  >
                    {copiedComment ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedComment ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportStudentReportToWord(session, submission)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">Xuất phiếu</span> Word
                </button>
                <button
                  onClick={() => exportTranscriptionText(submission)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-slate-600" />
                  Bản chép (.txt)
                </button>
              </div>

              <button
                onClick={handleApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                {isApproved ? 'Cập nhật phê duyệt' : 'Xác nhận duyệt điểm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
