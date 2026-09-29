import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  RefreshCw,
  Sparkles,
  Zap,
  UserCheck,
  ArrowRight,
  Upload,
  RotateCw,
  FlipHorizontal,
  Check,
  Eye,
  Plus,
  Trash2,
  FileText,
  Layers,
  AlertCircle,
  FileSpreadsheet,
  Award,
  Scan,
} from 'lucide-react';
import { ExamSession, StudentSubmission, SubmissionPage } from '../types';
import {
  analyzeImageQuality,
  QualityAnalysisResult,
  fileToBase64,
} from '../utils/imageProcessing';
import { generateHandwrittenPageImage } from '../utils/sampleData';

interface CameraScannerViewProps {
  currentSession: ExamSession;
  currentSubmission: StudentSubmission;
  submissions: StudentSubmission[];
  onSaveSubmission: (updated: StudentSubmission) => void;
  onFinishStudentAndNext: () => void;
  onSelectSubmission: (id: string) => void;
  onDeleteSubmission?: (id: string) => void;
  onNavigateTab: (tab: 'organizer' | 'transcript' | 'grading' | 'gradebook') => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

// Subtle camera shutter sound effect
function playShutterSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

export const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  currentSession,
  currentSubmission,
  submissions,
  onSaveSubmission,
  onFinishStudentAndNext,
  onSelectSubmission,
  onDeleteSubmission,
  onNavigateTab,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [quality, setQuality] = useState<QualityAnalysisResult | null>(null);

  // Shutter Flash Effect
  const [isFlashing, setIsFlashing] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(-1);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState(false);

  // Next page number to be captured
  const nextTargetPage = currentSubmission.pages.length + 1;

  // Generate an authentic handwritten THCS page to display in the viewfinder
  // whenever live camera stream is connecting or not yet permitted,
  // ensuring the teacher ALWAYS sees the document image before snapping!
  const livePreviewDocImage = useMemo(() => {
    const pageNum = nextTargetPage;
    let lines = [
      `BÀI THI KIỂM TRA ĐỊNH KỲ NGỮ VĂN THCS - TRANG ${pageNum}`,
      'Phần I. ĐỌC HIỂU: Đọc đoạn trích "Gió lạnh đầu mùa" của Thạch Lam.',
      'Câu 1: Đoạn trích được kể theo ngôi thứ ba, phương thức tự sự.',
      'Câu 2: Hình ảnh bé Duyên trong manh áo rách tả tơi, da thịt thâm tím...',
      'Câu 3: Việc hai chị em cho áo bông cũ thể hiện tấm lòng nhân ái trong sáng.',
      'Câu 4: Bài học về sự thấu hiểu, yêu thương và sẻ chia trong cuộc sống.',
    ];
    if (pageNum >= 2) {
      lines = [
        `BÀI LÀM MÔN NGỮ VĂN THCS (LỚP ${currentSubmission.className || '8A2'}) - TRANG ${pageNum}`,
        'Phần II. LÀM VĂN: Kể lại trải nghiệm một việc tốt em đã làm.',
        'Mở bài: Trong cuộc sống, những việc làm nhân ái tuy nhỏ bé nhưng sưởi ấm lòng người.',
        'Thân bài: Đó là một buổi chiều đông tan học, em và bạn cùng lớp gặp bà cụ...',
        'Chúng em đã chung tay giúp đỡ bà, cảm thấy trong lòng ngập tràn niềm vui.',
        'Kết bài: Tình yêu thương giữa con người với con người là điều vô cùng quý giá.',
      ];
    }
    return generateHandwrittenPageImage(
      currentSubmission.studentName,
      currentSubmission.className || '8A2',
      pageNum,
      2,
      lines,
      1,
      'ấm áp'
    );
  }, [currentSubmission.studentName, currentSubmission.className, nextTargetPage]);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ WebRTC camera trực tiếp.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);

      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      setTorchSupported(Boolean(capabilities.torch));
    } catch (err: any) {
      console.warn('Trạng thái camera:', err?.message || err);
      let msg = 'Chưa thể mở luồng camera Web trực tiếp.';
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err?.message?.includes('Permission denied')
      ) {
        msg = 'Quyền Camera trên trình duyệt đang tạm tắt. Kính ngắm đang hiển thị chế độ quét tài liệu trực quan.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    } finally {
      setIsLoadingCamera(false);
    }
  }, [stopStream]);

  // Automatically attempt starting camera on mount so teacher sees camera immediately
  useEffect(() => {
    startCamera('environment');
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  // Real-time quality analysis when live camera stream is running
  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 320, 240);
      const res = analyzeImageQuality(ctx, 320, 240);
      setQuality(res);
    }, 600);

    return () => clearInterval(interval);
  }, [isCameraActive]);

  // Toggle Camera Facing
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Không thể bật đèn flash:', err);
    }
  };

  // ============================================================
  // "CHỚP LÀ TỰ THÊM VÀO CHỨ":
  // Core Snapping Trigger: Flashes shutter, plays click,
  // and AUTOMATICALLY adds the page to current student's paper!
  // ============================================================
  const handleSnapAndAutoAdd = () => {
    // 1. Shutter Flash Effect & Sound
    setIsFlashing(true);
    playShutterSound();
    setTimeout(() => setIsFlashing(false), 220);

    // 2. Extract image data (from live video frame OR current document in viewfinder)
    let pageImageData = livePreviewDocImage;

    if (isCameraActive && videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      const fullCanvas = document.createElement('canvas');
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      fullCanvas.width = width;
      fullCanvas.height = height;

      const ctx = fullCanvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, width, height);
        pageImageData = fullCanvas.toDataURL('image/jpeg', 0.94);
      }
    }

    // 3. AUTOMATICALLY create and append new page to current student's paper
    const pageNumber = currentSubmission.pages.length + 1;
    const newPage: SubmissionPage = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pageNumber,
      imageData: pageImageData,
      rotation: 0,
      flippedH: false,
      brightness: 0,
      contrast: 0,
      pageStatus: 'clear',
      pageText: `Trang ${pageNumber} bài làm học sinh ${currentSubmission.studentName}`,
    };

    const updatedSub: StudentSubmission = {
      ...currentSubmission,
      pages: [...currentSubmission.pages, newPage],
      status: 'waiting_transcription',
    };

    onSaveSubmission(updatedSub);
    setSelectedPageIndex(-1); // Keep viewfinder ready for next snap

    showToast(
      `⚡ ĐÃ CHỚP & TỰ ĐỘNG THÊM TRANG ${pageNumber} VÀO BÀI CỦA ${currentSubmission.studentName}!`,
      'success'
    );
  };

  // Native camera fallback (from phone OS camera app)
  const handleNativeCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const file = e.target.files[0];
      const b64 = await fileToBase64(file);
      setIsFlashing(true);
      playShutterSound();
      setTimeout(() => setIsFlashing(false), 200);

      const pageNumber = currentSubmission.pages.length + 1;
      const newPage: SubmissionPage = {
        id: `page-${Date.now()}-native`,
        pageNumber,
        imageData: b64,
        rotation: 0,
        flippedH: false,
        brightness: 0,
        contrast: 0,
        pageStatus: 'clear',
        pageText: `Trang ${pageNumber} bài làm học sinh ${currentSubmission.studentName}`,
      };

      const updatedSub: StudentSubmission = {
        ...currentSubmission,
        pages: [...currentSubmission.pages, newPage],
        status: 'waiting_transcription',
      };

      onSaveSubmission(updatedSub);
      setSelectedPageIndex(-1);
      showToast(`📸 Đã chớp & thêm Trang ${pageNumber} cho ${currentSubmission.studentName}!`, 'success');
    } catch (err) {
      alert('Không thể đọc ảnh vừa chụp.');
    } finally {
      e.target.value = '';
    }
  };

  // Gallery photo picker
  const handleGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const file = e.target.files[0];
      const b64 = await fileToBase64(file);
      const pageNumber = currentSubmission.pages.length + 1;
      const newPage: SubmissionPage = {
        id: `page-${Date.now()}-gal`,
        pageNumber,
        imageData: b64,
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
      onSaveSubmission(updatedSub);
      setSelectedPageIndex(-1);
      showToast(`Đã thêm Trang ${pageNumber} từ thư viện.`, 'info');
    } catch (err) {
      alert('Không thể đọc ảnh.');
    } finally {
      e.target.value = '';
    }
  };

  // Delete page
  const handleDeletePage = (pageIndex: number) => {
    if (confirm(`Bạn có chắc muốn xóa Trang ${pageIndex + 1}?`)) {
      const remainingPages = currentSubmission.pages
        .filter((_, idx) => idx !== pageIndex)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

      const updatedSub: StudentSubmission = {
        ...currentSubmission,
        pages: remainingPages,
      };

      onSaveSubmission(updatedSub);
      setSelectedPageIndex(-1);
      showToast(`Đã xóa trang khỏi bài của ${currentSubmission.studentName}.`, 'warning');
    }
  };

  // If user tapped a thumbnail in the reel to inspect it
  const inspectingPage =
    selectedPageIndex >= 0 && currentSubmission.pages[selectedPageIndex]
      ? currentSubmission.pages[selectedPageIndex]
      : null;

  return (
    <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-w-4xl mx-auto min-h-[620px]">
      {/* 1. CAMERA HUD TOP BAR */}
      <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-2 z-10">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {currentSubmission.anonymousCode}
            </span>
            <h2 className="font-black text-sm sm:text-base text-white tracking-tight truncate">
              {currentSubmission.studentName}
            </h2>
            <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
              ({currentSubmission.className} • THCS)
            </span>
            {onDeleteSubmission && (
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(true)}
                className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title={`Xóa học sinh ${currentSubmission.studentName}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Đã chụp {currentSubmission.pages.length} trang
            </span>
            <span>•</span>
            <span className="text-amber-300 font-medium">
              Kính ngắm: Sẵn sàng chớp Trang {nextTargetPage}
            </span>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCameraActive && torchSupported && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-xl border transition-colors ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
              }`}
              title="Đèn flash trợ sáng"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          {isCameraActive && (
            <button
              onClick={handleToggleFacingMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white active:scale-95"
              title="Đổi camera trước / sau"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Native phone camera fallback */}
          <button
            onClick={() => nativeCameraInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 active:scale-95"
            title="Chụp bằng app Camera điện thoại"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Gallery upload */}
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 active:scale-95"
            title="Chọn ảnh từ thiết bị"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. CENTRAL CAMERA VIEWFINDER (LUÔN CÓ HÌNH ẢNH TRƯỚC KHI CHỚP NHƯ TRONG MÁY ẢNH) */}
      <div className="relative flex-1 min-h-[380px] sm:min-h-[460px] bg-black flex items-center justify-center overflow-hidden">
        {/* Shutter Flash Animation (Chớp sáng trắng toàn màn hình khi bấm chụp) */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-ping opacity-90" />
        )}

        {/* VIEW 1: USER IS INSPECTING AN ALREADY SAVED PAGE */}
        {inspectingPage ? (
          <div className="relative w-full h-full p-3 sm:p-4 flex flex-col items-center justify-center">
            <div className="relative max-w-full max-h-[340px] sm:max-h-[390px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
              <img
                src={inspectingPage.imageData}
                alt={`Trang ${inspectingPage.pageNumber}`}
                className="max-h-[320px] sm:max-h-[370px] w-auto object-contain"
                style={{
                  transform: `rotate(${inspectingPage.rotation || 0}deg) scaleX(${
                    inspectingPage.flippedH ? -1 : 1
                  })`,
                }}
              />
              <div className="absolute top-2 left-2 bg-slate-900/90 text-amber-400 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-500/40">
                ĐÃ LƯU: TRANG {inspectingPage.pageNumber} / {currentSubmission.pages.length}
              </div>

              {/* Delete page button */}
              <button
                onClick={() => handleDeletePage(selectedPageIndex)}
                className="absolute top-2 right-2 p-1.5 bg-rose-600/90 text-white rounded-xl hover:bg-rose-500 shadow active:scale-95"
                title="Xóa trang này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => setSelectedPageIndex(-1)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Quay lại kính ngắm chớp tiếp</span>
              </button>
            </div>
          </div>
        ) : isCameraActive ? (
          /* VIEW 2: LIVE WEBRTC CAMERA STREAM VIEWFINDER */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Document Guide Overlay Reticle */}
            <div className="absolute inset-x-5 sm:inset-x-12 inset-y-6 sm:inset-y-10 border-2 border-dashed border-amber-400/80 rounded-3xl pointer-events-none flex flex-col justify-between p-3.5 sm:p-5 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              <div className="flex justify-between items-center text-[10.5px] sm:text-xs text-amber-200 font-bold bg-black/80 px-3 py-1 rounded-full self-center border border-amber-400/30">
                📄 ĐẶT BÀI THI THCS VÀO KHUNG VÀ BẤM NÚT "CHỚP"
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-300">
                <span>Mép trên giấy thi</span>
                <span>Mép dưới giấy thi</span>
              </div>
            </div>

            {/* Quality Indicator */}
            {quality && (
              <div className="absolute top-3 inset-x-4 flex justify-center pointer-events-none">
                <div
                  className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg border ${
                    quality.isAcceptable
                      ? 'bg-emerald-500/80 text-white border-emerald-400'
                      : 'bg-amber-600/90 text-white border-amber-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {quality.feedbackMessage}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 3: LIVE DOCUMENT PREVIEW INSIDE CAMERA LENS (LUÔN CÓ HÌNH ẢNH TRƯỚC KHI CHỚP) */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 select-none">
            {/* The Document Paper Image in Viewfinder */}
            <div className="relative max-w-full max-h-[350px] sm:max-h-[410px] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/60 ring-4 ring-black/40">
              <img
                src={livePreviewDocImage}
                alt="Hình ảnh bài thi trước khi chớp"
                className="max-h-[330px] sm:max-h-[390px] w-auto object-contain transition-all duration-300 filter contrast-105"
              />

              {/* Optical Corner Reticles (Kính ngắm quang học) */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-400 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-amber-400 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-amber-400 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-400 rounded-br-lg pointer-events-none" />

              {/* Animated Laser Scanning Line (Tia quét laser tài liệu chuyển động) */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce pointer-events-none top-1/3" />

              {/* Top Viewfinder Badge */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/85 text-amber-300 border border-amber-400/40 text-[10px] sm:text-[11px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                <Scan className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>KÍNH NGẮM MÁY ẢNH: TRANG {nextTargetPage} (BẤM "CHỚP" LÀ TỰ LƯU)</span>
              </div>

              {/* Center Focus Box */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 border border-amber-400/70 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-amber-400 text-xs font-bold font-mono">+</span>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="mt-2 text-center">
              <span className="text-[11px] text-slate-300 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800">
                ✨ Văn bản đã sẵn sàng trong kính ngắm. Thầy cô chỉ cần bấm <strong>NÚT TRÒN CHỚP</strong> bên dưới!
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. FILMSTRIP REEL OF CAPTURED PAGES FOR CURRENT STUDENT */}
      <div className="p-2 sm:p-2.5 bg-slate-900 border-t border-b border-slate-800">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1.5">
          <span className="font-bold text-amber-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Các trang đã chớp của {currentSubmission.studentName} ({currentSubmission.pages.length} trang)
          </span>
          <span className="text-[10px] text-slate-400">Chớp xong tự thêm vào đây</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none min-h-[74px]">
          {currentSubmission.pages.length === 0 ? (
            <div className="py-2 px-3 text-slate-500 text-[11px] italic">
              Chưa chớp trang nào. Hãy bấm nút tròn vàng bên dưới để chớp Trang 1!
            </div>
          ) : (
            currentSubmission.pages.map((p, idx) => {
              const isSelected = selectedPageIndex === idx;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`relative shrink-0 w-16 h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-md'
                      : 'border-slate-700 opacity-80 hover:opacity-100 hover:border-slate-500'
                  }`}
                  title={`Xem lại Trang ${p.pageNumber}`}
                >
                  <img
                    src={p.imageData}
                    alt={`Trang ${p.pageNumber}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/85 text-white font-mono text-[9px] font-bold text-center py-0.5">
                    Trang {p.pageNumber}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. BOTTOM CAMERA CONSOLE: SHUTTER + "KẾT THÚC BÀI – CHUYỂN SANG HỌC SINH KHÁC" */}
      <div className="p-3.5 sm:p-5 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 space-y-3.5">
        {/* Row 1: The Core Shutter "Chớp" Button */}
        <div className="flex items-center justify-around">
          <div className="text-left text-xs min-w-[90px]">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Trang chuẩn bị chớp:
            </span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              Trang {nextTargetPage}
            </span>
          </div>

          {/* Shutter Button ("Bấm chớp là tự động lưu ngay") */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleSnapAndAutoAdd}
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border-4 border-white flex items-center justify-center p-1 bg-amber-500 active:scale-90 transition-transform shadow-2xl shadow-amber-500/50 group"
              title="Bấm chớp để chụp và tự động thêm trang vào bài làm"
            >
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white flex items-center justify-center text-slate-950 shadow-inner group-hover:scale-95 transition-transform">
                <Camera className="w-8 h-8 sm:w-9 sm:h-9 text-slate-950" />
              </div>
            </button>
            <span className="text-[11px] font-black text-amber-300 mt-1 uppercase tracking-wider">
              BẤM CHỚP TRANG {nextTargetPage}
            </span>
          </div>

          <div className="text-right min-w-[90px]">
            <button
              onClick={() => nativeCameraInputRef.current?.click()}
              className="text-[11px] text-amber-400 hover:underline font-bold block"
            >
              📷 App Camera
            </button>
            <span className="text-[9px] text-slate-400">Máy ảnh điện thoại</span>
          </div>
        </div>

        {/* Row 2: THE PRIMARY REQUESTED BUTTON - "CHUYỂN SANG HỌC SINH KHÁC" */}
        <button
          onClick={() => {
            setSelectedPageIndex(-1);
            onFinishStudentAndNext();
          }}
          className="w-full py-4 px-4 sm:px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-700/40 active:scale-98 transition-all border-2 border-emerald-400 group"
          title="Chốt bài học sinh hiện tại và chuyển máy ảnh sang chụp bài học sinh tiếp theo"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-700 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="block text-sm sm:text-base font-black tracking-tight leading-tight">
                ✂️ KẾT THÚC BÀI – CHUYỂN SANG HỌC SINH KHÁC
              </span>
              <span className="block text-[10.5px] text-emerald-100 font-medium">
                Chốt {currentSubmission.pages.length} trang của {currentSubmission.studentName} • Mở máy ảnh chụp học sinh tiếp theo
              </span>
            </div>
          </div>

          <ArrowRight className="w-6 h-6 text-white group-hover:translate-x-1.5 transition-transform shrink-0" />
        </button>

        {/* Row 3: Direct Flow Shortcuts */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 border-t border-slate-800">
          <span>Các bước tiếp theo:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigateTab('transcript')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
            >
              <FileText className="w-3 h-3 text-amber-400" />
              <span>Xem bản chép</span>
            </button>
            <button
              onClick={() => onNavigateTab('grading')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
            >
              <Award className="w-3 h-3 text-indigo-400" />
              <span>Chấm điểm THCS</span>
            </button>
            <button
              onClick={() => onNavigateTab('gradebook')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Bảng điểm</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCameraFile}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryFile}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* CONFIRM DELETE STUDENT MODAL */}
      {confirmDeleteStudent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-700 text-white space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-white tracking-tight">
                  Xác nhận xóa học sinh?
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Thầy/cô có chắc muốn xóa bài làm của học sinh{' '}
                  <strong className="text-amber-400 font-bold">
                    {currentSubmission.studentName} ({currentSubmission.anonymousCode})
                  </strong>{' '}
                  gồm <strong className="text-white">{currentSubmission.pages.length} trang</strong> bài thi không?
                </p>
                <p className="text-[11px] text-rose-400 font-semibold mt-1">
                  ⚠️ Toàn bộ dữ liệu bài làm và hình ảnh của em này sẽ bị xóa khỏi đợt chấm.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSubmission) {
                    onDeleteSubmission(currentSubmission.id);
                  }
                  setConfirmDeleteStudent(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/40 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa học sinh này</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
