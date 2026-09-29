import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ExamSession,
  StudentSubmission,
  SubmissionPage,
  DeviceMode,
} from './types';
import {
  getAllSessions,
  saveSession,
  getSubmissionsBySession,
  saveSubmission,
  saveSubmissions,
  deleteSubmission as dbDeleteSubmission,
  resetToSampleData,
} from './utils/storage';
import {
  getSavedDeviceMode,
  saveDeviceMode,
  detectHardwareDevice,
  EffectiveDeviceType,
} from './utils/device';
import { fileToBase64, convertPdfToImages } from './utils/imageProcessing';
import { Header } from './components/Header';
import { SessionConfigView } from './components/SessionConfigView';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { DesktopUploadArea } from './components/DesktopUploadArea';
import { PaperOrganizer } from './components/PaperOrganizer';
import { TranscriptVerifier } from './components/TranscriptVerifier';
import { GradingView } from './components/GradingView';
import { GradebookView } from './components/GradebookView';
import { RubricEditorModal } from './components/RubricEditorModal';
import { UserGuideModal } from './components/UserGuideModal';
import { generateHandwrittenPageImage } from './utils/sampleData';
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Plus,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
  Zap,
  UserCheck,
  Smartphone,
  Monitor,
} from 'lucide-react';

export default function App() {
  // Session & Submission state
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string>('');

  // Workflow navigation tab: 1. Cấu hình đợt chấm, 2. Quản lý bài nộp, 3. Bản chép, 4. Chấm điểm, 5. Bảng điểm
  const [activeTab, setActiveTab] = useState<'config' | 'organizer' | 'transcript' | 'grading' | 'gradebook'>('config');

  // Device detection & manual override
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('auto');
  const [hardwareType, setHardwareType] = useState<EffectiveDeviceType>('desktop');

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Loading & Batch processing status
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isBatchWorking, setIsBatchWorking] = useState(false);
  const [globalStatusMessage, setGlobalStatusMessage] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{ message: string; type?: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 4500);
  };

  // Calculate effective device type
  const effectiveDeviceType: EffectiveDeviceType = useMemo(() => {
    if (deviceMode === 'mobile') return 'mobile';
    if (deviceMode === 'desktop') return 'desktop';
    return hardwareType;
  }, [deviceMode, hardwareType]);

  // Initial load
  useEffect(() => {
    // Detect hardware & load saved device mode
    setHardwareType(detectHardwareDevice());
    setDeviceMode(getSavedDeviceMode());

    // Load sessions and submissions from IndexedDB
    async function loadData() {
      try {
        const loadedSessions = await getAllSessions();
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          const firstSession = loadedSessions[0];
          setCurrentSession(firstSession);
          const loadedSubs = await getSubmissionsBySession(firstSession.id);
          setSubmissions(loadedSubs);
          if (loadedSubs.length > 0) {
            setActiveSubmissionId(loadedSubs[0].id);
          }
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu ban đầu:', err);
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Update current submission object
  const currentSubmission = useMemo(() => {
    return submissions.find((s) => s.id === activeSubmissionId) || submissions[0];
  }, [submissions, activeSubmissionId]);

  // Handle switching device mode
  const handleChangeDeviceMode = (mode: DeviceMode) => {
    setDeviceMode(mode);
    saveDeviceMode(mode);
  };

  // Save session update
  const handleSaveSession = async (updated: ExamSession) => {
    await saveSession(updated);
    setCurrentSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  // Save single submission update
  const handleSaveSubmission = async (updated: StudentSubmission) => {
    await saveSubmission(updated);
    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  // Save multiple submissions (e.g. after reordering or splitting)
  const handleUpdateSubmissions = async (updatedList: StudentSubmission[]) => {
    await saveSubmissions(updatedList);
    setSubmissions(updatedList);
  };

  // Delete submission
  const handleDeleteSubmission = async (submissionId: string) => {
    const targetSub = submissions.find((s) => s.id === submissionId);
    await dbDeleteSubmission(submissionId);
    let remaining = submissions.filter((s) => s.id !== submissionId);

    // If all students were deleted, create a fresh initial student record
    if (remaining.length === 0 && currentSession) {
      const newSub: StudentSubmission = {
        id: `sub-${Date.now()}`,
        sessionId: currentSession.id,
        anonymousCode: 'NV-001',
        studentName: 'Học sinh 1',
        className: currentSession.className || 'THCS',
        pages: [],
        status: 'receiving',
        originalTranscription: '',
        editedTranscription: '',
        transcriptConfirmed: false,
        transcriptAuditLog: [{ timestamp: new Date().toISOString(), note: 'Tạo bài mới sau khi xóa' }],
      };
      await saveSubmission(newSub);
      remaining = [newSub];
    }

    setSubmissions(remaining);
    if (remaining.length > 0) {
      const nextActive = remaining.find((s) => s.id !== submissionId) || remaining[0];
      setActiveSubmissionId(nextActive.id);
    }
    showToast(`Đã xóa bài làm của ${targetSub?.studentName || 'học sinh'}.`, 'info');
  };

  // Reset to realistic test sample data
  const handleResetSampleData = async () => {
    setIsLoadingInitial(true);
    try {
      const sample = await resetToSampleData();
      setSessions([sample.session]);
      setCurrentSession(sample.session);
      setSubmissions(sample.submissions);
      setActiveSubmissionId(sample.submissions[0]?.id || '');
      setActiveTab('organizer');
    } catch (err) {
      console.error('Lỗi khôi phục mẫu:', err);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  // Add a new empty student paper
  const handleAddNewStudent = () => {
    if (!currentSession) return;
    const nextCode = `NV-${String(submissions.length + 1).padStart(3, '0')}`;
    const newSub: StudentSubmission = {
      id: `sub-${Date.now()}`,
      sessionId: currentSession.id,
      anonymousCode: nextCode,
      studentName: `Học sinh ${submissions.length + 1}`,
      className: currentSession.className,
      pages: [],
      status: 'receiving',
      originalTranscription: '',
      editedTranscription: '',
      transcriptConfirmed: false,
      transcriptAuditLog: [
        {
          timestamp: new Date().toISOString(),
          note: `Khởi tạo bài thi ${nextCode}`,
        },
      ],
    };

    saveSubmission(newSub).then(() => {
      setSubmissions((prev) => [...prev, newSub]);
      setActiveSubmissionId(newSub.id);
    });
  };

  // Handle adding pages to active student submission
  const handleAddPageToCurrentStudent = (page: SubmissionPage) => {
    if (!currentSubmission) {
      handleAddNewStudent();
      return;
    }

    const updatedPages = [...currentSubmission.pages, page];
    const updatedSub: StudentSubmission = {
      ...currentSubmission,
      pages: updatedPages,
      status: 'waiting_transcription',
    };

    handleSaveSubmission(updatedSub);
    showToast(`Đã thêm Trang ${page.pageNumber} cho ${currentSubmission.studentName}!`, 'info');
  };

  // Mobile Continuous Capture: "Kết thúc bài – Sang học sinh tiếp theo"
  const handleFinishStudentAndNext = () => {
    if (!currentSession) return;
    const currentName = currentSubmission?.studentName || 'Học sinh';
    const pagesCount = currentSubmission?.pages.length || 0;
    const nextIdx = submissions.length + 1;
    const nextCode = `NV-${String(nextIdx).padStart(3, '0')}`;
    const nextName = `Học sinh ${nextIdx}`;

    const newSub: StudentSubmission = {
      id: `sub-${Date.now()}`,
      sessionId: currentSession.id,
      anonymousCode: nextCode,
      studentName: nextName,
      className: currentSession.className,
      pages: [],
      status: 'receiving',
      originalTranscription: '',
      editedTranscription: '',
      transcriptConfirmed: false,
      transcriptAuditLog: [
        {
          timestamp: new Date().toISOString(),
          note: `Bắt đầu nạp bài mới (${nextCode})`,
        },
      ],
    };

    saveSubmission(newSub).then(() => {
      setSubmissions((prev) => [...prev, newSub]);
      setActiveSubmissionId(newSub.id);
      showToast(
        `🎉 Đã chốt bài của ${currentName} (${pagesCount} trang)! Đã chuyển sang ${nextName} (${nextCode}) sẵn sàng chụp bài mới.`,
        'success'
      );
    });
  };

  // Quick simulate snapping a page for instant test (works on any device without webcam)
  const handleSimulateSnapPage = () => {
    if (!currentSubmission) {
      handleAddNewStudent();
      return;
    }
    const pageNum = currentSubmission.pages.length + 1;
    const lines = [
      `BÀI LÀM KIỂM TRA ĐỊNH KỲ NGỮ VĂN THCS - TRANG ${pageNum}`,
      'Phần I. Đọc hiểu: Đoạn trích "Gió lạnh đầu mùa" (Thạch Lam) thể hiện tình người ấm áp.',
      'Chi tiết hai chị em Lan và Sơn giấu mẹ mang chiếc áo bông cũ cho cái Duyên con chị Tí.',
      'Dù chỉ là manh áo cũ nhưng đã sưởi ấm cho đứa trẻ nghèo trong cơn gió bấc đầu mùa.',
      'Qua đó nhà văn ca ngợi tấm lòng nhân ái, sự sẻ chia chân thành của những tâm hồn trẻ thơ.',
      'Phần II. Viết bài văn: Kể lại một việc tốt em đã làm giúp đỡ các bạn khó khăn ở trường THCS...',
      'Em nhận ra rằng cho đi yêu thương chính là mang lại niềm vui cho bản thân và mọi người.',
    ];
    const simImg = generateHandwrittenPageImage(
      currentSubmission.studentName,
      currentSubmission.className,
      pageNum,
      2,
      lines,
      1,
      'ấm áp'
    );
    const newPage: SubmissionPage = {
      id: `page-${Date.now()}-${pageNum}`,
      pageNumber: pageNum,
      imageData: simImg,
      rotation: 0,
      flippedH: false,
      brightness: 0,
      contrast: 0,
      pageStatus: 'clear',
    };
    const updatedSub: StudentSubmission = {
      ...currentSubmission,
      pages: [...currentSubmission.pages, newPage],
      status: 'waiting_transcription',
    };
    handleSaveSubmission(updatedSub);
    showToast(`📸 Đã chụp và nạp thành công Trang ${pageNum} mẫu THCS cho ${currentSubmission.studentName}!`, 'info');
  };

  // Add multiple uploaded images (from Desktop drag-drop or file pickers)
  const handleAddUploadedImages = (images: string[]) => {
    if (!currentSubmission) {
      handleAddNewStudent();
    }

    const targetSub = currentSubmission || {
      id: `sub-${Date.now()}`,
      sessionId: currentSession?.id || 'session-1',
      anonymousCode: `NV-${String(submissions.length + 1).padStart(3, '0')}`,
      studentName: 'Chưa xác định',
      className: currentSession?.className || '12A',
      pages: [],
      status: 'waiting_transcription',
      originalTranscription: '',
      editedTranscription: '',
      transcriptConfirmed: false,
      transcriptAuditLog: [],
    };

    const newPages: SubmissionPage[] = images.map((imgData, idx) => ({
      id: `page-${Date.now()}-${idx}`,
      pageNumber: targetSub.pages.length + idx + 1,
      imageData: imgData,
      rotation: 0,
      flippedH: false,
      brightness: 0,
      contrast: 0,
      pageStatus: 'clear',
    }));

    const updatedSub: StudentSubmission = {
      ...targetSub,
      pages: [...targetSub.pages, newPages as any].flat(),
      status: 'waiting_transcription',
    };

    handleSaveSubmission(updatedSub);
  };

  // Mobile file picker handlers
  const handleMobilePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const b64List: string[] = [];
    for (const f of files) {
      const b64 = await fileToBase64(f);
      b64List.push(b64);
    }
    if (b64List.length > 0) {
      handleAddUploadedImages(b64List);
    }
    e.target.value = '';
  };

  const handleMobilePdfPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setGlobalStatusMessage('Đang tách trang từ tệp PDF...');
    try {
      const pdfImages = await convertPdfToImages(e.target.files[0]);
      handleAddUploadedImages(pdfImages);
    } catch (err: any) {
      alert(err.message || 'Lỗi đọc tệp PDF.');
    } finally {
      setGlobalStatusMessage(null);
      e.target.value = '';
    }
  };

  // Batch transcribe all pending submissions
  const handleBatchTranscribe = async () => {
    const pendingSubs = submissions.filter(
      (s) => (s.status === 'waiting_transcription' || s.status === 'receiving') && s.pages.length > 0
    );
    if (pendingSubs.length === 0) {
      alert('Không có bài nào đang chờ nhận dạng chữ viết tay.');
      return;
    }

    setIsBatchWorking(true);
    setGlobalStatusMessage(`Đang nhận dạng OCR hàng loạt (${pendingSubs.length} bài)...`);

    try {
      for (const sub of pendingSubs) {
        setGlobalStatusMessage(`Đang nhận dạng bài của ${sub.studentName} (${sub.anonymousCode})...`);
        const payload = {
          images: sub.pages.map((p) => ({ pageNumber: p.pageNumber, data: p.imageData })),
          existingStudentInfo: { studentName: sub.studentName, className: sub.className },
        };

        const res = await fetch('/api/gemini/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const updatedSub: StudentSubmission = {
            ...sub,
            studentName: data.studentName && data.studentName !== 'Chưa xác định' ? data.studentName : sub.studentName,
            className: data.className || sub.className,
            originalTranscription: data.rawTranscription || '',
            editedTranscription: data.rawTranscription || '',
            status: 'needs_transcript_review',
          };
          await saveSubmission(updatedSub);
          setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? updatedSub : s)));
        }
      }
    } catch (err: any) {
      console.error('Lỗi nhận dạng hàng loạt:', err);
    } finally {
      setIsBatchWorking(false);
      setGlobalStatusMessage(null);
    }
  };

  // Batch grade all submissions
  const handleBatchGrade = async () => {
    if (!currentSession) return;
    let rubricToUse = currentSession.rubric;

    // If no rubric, fetch or generate default
    if (!rubricToUse || !rubricToUse.criteria || rubricToUse.criteria.length === 0) {
      try {
        setGlobalStatusMessage('Đang chuẩn bị khung hướng dẫn chấm chuẩn môn Văn...');
        const rubricRes = await fetch('/api/gemini/generate-rubric', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examPrompt: currentSession.examPrompt || '',
            answerKeyText: currentSession.answerKeyText || '',
            gradeLevel: currentSession.gradeLevel || 'Lớp 9',
            examTitle: currentSession.title || 'Kiểm tra Ngữ văn',
          }),
        });
        if (rubricRes.ok) {
          rubricToUse = await rubricRes.json();
          const updatedSession: ExamSession = { ...currentSession, rubric: rubricToUse };
          await saveSession(updatedSession);
          setCurrentSession(updatedSession);
        }
      } catch (e) {
        console.warn('Lỗi tạo rubric mặc định:', e);
      }
    }

    const eligibleSubs = submissions.filter(
      (s) => (s.pages && s.pages.length > 0) || (s.editedTranscription || s.originalTranscription)
    );

    if (eligibleSubs.length === 0) {
      showToast('Chưa có học sinh nào có bài làm để chấm. Vui lòng thêm ảnh bài thi.', 'warning');
      return;
    }

    setIsBatchWorking(true);
    let gradedCount = 0;

    try {
      for (let i = 0; i < eligibleSubs.length; i++) {
        const sub = eligibleSubs[i];
        setGlobalStatusMessage(`Đang chấm bài ${i + 1}/${eligibleSubs.length} (${sub.studentName})...`);

        let transcript = (sub.editedTranscription || sub.originalTranscription || '').trim();

        // If no transcript yet but has pages, automatically transcribe first
        if (!transcript && sub.pages && sub.pages.length > 0) {
          try {
            const ocrRes = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                images: sub.pages.map((p) => ({ pageNumber: p.pageNumber, data: p.imageData })),
                existingStudentInfo: { studentName: sub.studentName, className: sub.className },
              }),
            });
            if (ocrRes.ok) {
              const ocrData = await ocrRes.json();
              transcript = (ocrData.rawTranscription || '').trim();
            }
          } catch (ocrErr) {
            console.warn('OCR error during batch:', ocrErr);
          }
        }

        if (!transcript) continue;

        const res = await fetch('/api/gemini/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentTranscript: transcript,
            rubric: rubricToUse,
            examPrompt: currentSession.examPrompt,
            studentName: sub.studentName,
            roundingRule: currentSession.roundingRule || 0.1,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          const updatedSub: StudentSubmission = {
            ...sub,
            originalTranscription: transcript,
            editedTranscription: transcript,
            gradingResult: {
              ...result,
              rubricVersionUsed: rubricToUse?.version || 1,
            },
            status: 'graded_proposed',
          };
          await saveSubmission(updatedSub);
          setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? updatedSub : s)));
          gradedCount++;
        }
      }

      showToast(`🎉 Đã hoàn thành tự động chấm cho ${gradedCount}/${eligibleSubs.length} bài thi!`, 'success');
    } catch (err: any) {
      console.error('Lỗi chấm hàng loạt:', err);
      showToast('Đã có lỗi trong quá trình chấm một số bài. Vui lòng kiểm tra lại.', 'warning');
    } finally {
      setIsBatchWorking(false);
      setGlobalStatusMessage(null);
    }
  };

  if (isLoadingInitial || !currentSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Đang khởi tạo Trợ Lý Chấm Bài Ngữ Văn...</h2>
        <p className="text-xs text-slate-500 mt-1">Đang tải bộ dữ liệu lưu trữ trên thiết bị</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentSession={currentSession}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenRubricModal={() => setIsRubricModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onResetSampleData={handleResetSampleData}
        deviceMode={deviceMode}
        effectiveDeviceType={effectiveDeviceType}
        onChangeDeviceMode={handleChangeDeviceMode}
        submissionsCount={submissions.length}
      />

      {/* Global Processing Banner */}
      {globalStatusMessage && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{globalStatusMessage}</span>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastNotification && (
        <div className="fixed top-14 inset-x-3 sm:inset-x-auto sm:right-6 z-50 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-bounce-short">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold leading-relaxed flex-1">{toastNotification.message}</p>
          <button
            onClick={() => setToastNotification(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-5 pb-28 md:pb-8">
        {/* TAB 1: CẤU HÌNH ĐỢT CHẤM & ĐỀ, ĐÁP ÁN, HƯỚNG DẪN CHẤM */}
        {activeTab === 'config' && (
          <SessionConfigView
            session={currentSession}
            onSaveSession={handleSaveSession}
            onNavigateToOrganizer={() => setActiveTab('organizer')}
            showToast={showToast}
          />
        )}

        {/* TAB 2: QUẢN LÝ BÀI NỘP & CHỤP BÀI */}
        {activeTab === 'organizer' && (
          <div className="space-y-5">
            {/* HERO CARD: KHU VỰC CHỤP ẢNH BÀI LÀM & TÁCH BÀI HỌC SINH THCS (ALWAYS VISIBLE & PROMINENT) */}
            <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-amber-600/20 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug">
                      TRUNG TÂM CHỤP ẢNH BÀI LÀM & TÁCH BÀI HỌC SINH (THCS)
                    </h2>
                    <p className="text-[11px] sm:text-xs text-amber-100 mt-0.5">
                      Đang xử lý: <strong className="text-white underline">{currentSubmission?.studentName || 'Học sinh'} ({currentSubmission?.anonymousCode})</strong> • Đã nạp <strong className="text-white font-mono">{currentSubmission?.pages.length || 0} trang</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                    Cấp THCS (Lớp 6, 7, 8, 9)
                  </span>
                  {effectiveDeviceType === 'desktop' && (
                    <button
                      onClick={() => handleChangeDeviceMode('mobile')}
                      className="text-[10px] font-bold px-2.5 py-1 bg-white text-slate-900 rounded-full hover:bg-amber-100 shadow-sm transition-all"
                      title="Chuyển sang xem thử giao diện điện thoại"
                    >
                      📱 Xem bản Mobile
                    </button>
                  )}
                </div>
              </div>

              {/* TWO GIANT CORE ACTION BUTTONS: CHỤP BÀI & KẾT THÚC BÀI / SANG HỌC SINH TIẾP THEO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* 1. NÚT CHỤP BÀI BẰNG CAMERA */}
                <button
                  onClick={() => setIsCameraModalOpen(true)}
                  className="py-4 px-4 sm:px-5 bg-white hover:bg-amber-50 text-slate-900 font-extrabold rounded-2xl flex items-center gap-3.5 shadow-xl active:scale-95 transition-all text-left group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-amber-700 transition-all shadow-md">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm sm:text-base font-black text-amber-950 tracking-tight">
                      📸 BẬT CAMERA CHỤP BÀI
                    </span>
                    <span className="block text-[11px] text-slate-500 font-medium truncate">
                      Chụp camera sau/trước • Chụp liên tục các trang
                    </span>
                  </div>
                </button>

                {/* 2. NÚT KẾT THÚC BÀI – SANG HỌC SINH TIẾP THEO */}
                <button
                  onClick={handleFinishStudentAndNext}
                  className="py-4 px-4 sm:px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl flex items-center gap-3.5 shadow-xl shadow-emerald-700/30 active:scale-95 transition-all text-left group border-2 border-emerald-300"
                  title="Chốt số trang bài hiện tại và tạo bài cho học sinh tiếp theo"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-all shadow-md">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                      <span>✂️ KẾT THÚC BÀI</span>
                      <span className="text-emerald-200 font-bold">&rarr;</span>
                      <span>SANG HS TIẾP</span>
                    </span>
                    <span className="block text-[11px] text-emerald-100 font-medium truncate">
                      Chốt bài học sinh này • Bắt đầu chụp học sinh mới
                    </span>
                  </div>
                </button>
              </div>

              {/* SECONDARY ACTION ROW: CHỤP THỬ MẪU THCS, CHỌN ẢNH, TẢI PDF */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs text-amber-100">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Instant THCS Sample Snap */}
                  <button
                    onClick={handleSimulateSnapPage}
                    className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm border border-purple-400/40"
                    title="Chụp thử 1 trang bài THCS mẫu để kiểm tra tính năng"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ Chụp thử trang bài THCS mẫu</span>
                  </button>

                  <label className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    <span>Chọn ảnh</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMobilePhotoPick}
                      className="hidden"
                    />
                  </label>

                  <label className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
                    <FileText className="w-4 h-4" />
                    <span>Tải file PDF</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleMobilePdfPick}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleAddNewStudent}
                    className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm học sinh mới</span>
                  </button>
                </div>

                <span className="text-[11px] text-white/90 hidden sm:inline">
                  💡 Chụp lần lượt các trang, sau đó nhấn <strong>"KẾT THÚC BÀI"</strong> để sang em tiếp theo.
                </span>
              </div>
            </div>

            {/* IF ON DESKTOP: Also show Drag-and-drop & paste box */}
            {effectiveDeviceType === 'desktop' && (
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-sky-600" />
                    Kéo thả tệp hoặc Dán ảnh chụp (Ctrl + V)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Đang nạp cho: <strong>{currentSubmission?.studentName}</strong>
                  </span>
                </div>
                <DesktopUploadArea onAddImages={handleAddUploadedImages} />
              </div>
            )}

            {/* Quick Actions Bar: Batch OCR & Transcribe */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatchTranscribe}
                  disabled={isBatchWorking}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Nhận dạng OCR tất cả bài
                </button>
              </div>

              <button
                onClick={() => setActiveTab('transcript')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 ml-auto"
              >
                <span>Xem bản chép & đối chiếu ảnh</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Submissions & Pages Organizer */}
            <PaperOrganizer
              submissions={submissions}
              activeSubmissionId={activeSubmissionId}
              onSelectSubmission={setActiveSubmissionId}
              onUpdateSubmissions={handleUpdateSubmissions}
              onDeleteSubmission={handleDeleteSubmission}
              onAddNewStudent={handleAddNewStudent}
              onOpenCapture={() => setIsCameraModalOpen(true)}
              isMobile={effectiveDeviceType === 'mobile'}
            />
          </div>
        )}

        {/* TAB 2: TRANSCRIPTION VERIFIER */}
        {activeTab === 'transcript' && currentSubmission && (
          <TranscriptVerifier
            submission={currentSubmission}
            onSaveSubmission={handleSaveSubmission}
            onProceedToGrading={() => setActiveTab('grading')}
            isMobile={effectiveDeviceType === 'mobile'}
            session={currentSession}
            onSaveSession={handleSaveSession}
            showToast={showToast}
            submissions={submissions}
            activeSubmissionId={activeSubmissionId}
            onSelectSubmission={setActiveSubmissionId}
          />
        )}

        {/* TAB 3: DETAILED GRADING & TEACHER APPROVAL */}
        {activeTab === 'grading' && currentSubmission && (
          <GradingView
            submission={currentSubmission}
            session={currentSession}
            onSaveSubmission={handleSaveSubmission}
            onSaveSession={handleSaveSession}
            onBackToTranscript={() => setActiveTab('transcript')}
            showToast={showToast}
            onNavigateTab={setActiveTab}
            submissions={submissions}
            activeSubmissionId={activeSubmissionId}
            onSelectSubmission={setActiveSubmissionId}
            onBatchGrade={handleBatchGrade}
            isBatchWorking={isBatchWorking}
            globalStatusMessage={globalStatusMessage}
          />
        )}

        {/* TAB 4: GRADEBOOK & EXPORTS */}
        {activeTab === 'gradebook' && (
          <GradebookView
            session={currentSession}
            submissions={submissions}
            onSelectSubmission={(subId, initialTab) => {
              setActiveSubmissionId(subId);
              if (initialTab) setActiveTab(initialTab);
            }}
            onDeleteSubmission={handleDeleteSubmission}
            onBatchTranscribe={handleBatchTranscribe}
            onBatchGrade={handleBatchGrade}
            isBatchWorking={isBatchWorking}
            onAddNewStudent={handleAddNewStudent}
          />
        )}
      </main>

      {/* STICKY QUICK ACTION BAR FOR MOBILE (Direct thumb access on phones) */}
      {activeTab === 'organizer' && (
        <div className="md:hidden fixed bottom-14 inset-x-2 z-30 bg-slate-900/90 backdrop-blur-md text-white p-2 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0 pl-1">
            <span className="block text-[11px] font-extrabold text-amber-400 truncate">
              {currentSubmission?.studentName || 'Học sinh'} ({currentSubmission?.anonymousCode})
            </span>
            <span className="block text-[10px] text-slate-300">
              Đã có {currentSubmission?.pages.length || 0} trang
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsCameraModalOpen(true)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 active:scale-95 shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Chụp bài</span>
            </button>

            <button
              onClick={handleFinishStudentAndNext}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-1 active:scale-95 shadow-md border border-emerald-400"
              title="Chốt bài học sinh này và sang học sinh tiếp theo"
            >
              <UserCheck className="w-4 h-4" />
              <span>Sang HS tiếp</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal (Accessible on all devices when requested) */}
      {isCameraModalOpen && (
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          studentCode={currentSubmission?.anonymousCode || 'NV-001'}
          studentName={currentSubmission?.studentName}
          currentPagesCount={currentSubmission?.pages.length || 0}
          onSavePage={handleAddPageToCurrentStudent}
          onFinishStudentAndNext={handleFinishStudentAndNext}
        />
      )}

      {/* Rubric Configuration Modal */}
      {isRubricModalOpen && currentSession && (
        <RubricEditorModal
          isOpen={isRubricModalOpen}
          onClose={() => setIsRubricModalOpen(false)}
          session={currentSession}
          onSaveSession={handleSaveSession}
        />
      )}

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
}
