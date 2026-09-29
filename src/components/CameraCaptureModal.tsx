import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, RotateCw, FlipHorizontal, ZoomIn, Eye, Sparkles, AlertCircle, Plus, UserCheck, ArrowRight, Upload, Zap } from 'lucide-react';
import { SubmissionPage } from '../types';
import { analyzeImageQuality, QualityAnalysisResult, transformImage, fileToBase64 } from '../utils/imageProcessing';
import { generateHandwrittenPageImage } from '../utils/sampleData';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentCode: string;
  studentName?: string;
  currentPagesCount: number;
  onSavePage: (page: SubmissionPage) => void;
  onFinishStudentAndNext: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  studentCode,
  studentName,
  currentPagesCount,
  onSavePage,
  onFinishStudentAndNext,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quality check states
  const [quality, setQuality] = useState<QualityAnalysisResult | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 3, step: 0.1 });

  // Captured preview state (before saving)
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flippedH, setFlippedH] = useState(false);
  const [isCloseUp, setIsCloseUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Check camera devices
  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);
    }).catch(() => {});
  }, [isOpen]);

  // Start camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ WebRTC camera trực tiếp. Bạn hãy dùng nút "Chụp qua Camera điện thoại" bên dưới.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false, // Strictly NO microphone requested
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 2560 }, // High resolution priority
          height: { ideal: 1440 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check capabilities (torch & zoom)
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};

      if (capabilities.torch) {
        setTorchSupported(true);
      } else {
        setTorchSupported(false);
      }

      if (capabilities.zoom) {
        setZoomSupported(true);
        setZoomRange({
          min: capabilities.zoom.min || 1,
          max: capabilities.zoom.max || 3,
          step: capabilities.zoom.step || 0.1,
        });
      } else {
        setZoomSupported(false);
      }
    } catch (err: any) {
      console.warn('Camera status:', err?.message || err);
      let msg = 'Chưa thể mở camera Web trực tiếp. Thầy cô có thể dùng nút "Camera điện thoại" bên dưới để chụp ngay.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err?.message?.includes('Permission denied')) {
        msg = 'Quyền Camera trên trình duyệt đang tạm tắt. Thầy cô có thể mở quyền hoặc dùng nút chụp trực tiếp từ máy ảnh bên dưới.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Không tìm thấy thiết bị camera khả dụng.';
      }
      setCameraError(msg);
    } finally {
      setIsLoadingCamera(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, capturedImage, startCamera, stopStream]);

  // Real-time frame analysis (throttled to 2 FPS to prevent device heat/lag)
  useEffect(() => {
    if (!isOpen || capturedImage || !videoRef.current) return;

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
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen, capturedImage]);

  // Toggle Camera switch (Rear <-> Front)
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Toggle Torch/Flash
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

  // Adjust Zoom
  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setZoomLevel(val);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ zoom: val }],
      });
    } catch (err) {
      console.warn('Không thể chỉnh zoom:', err);
    }
  };

  // Capture Photo at Full Sensor Resolution & Auto Add Page
  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;

    const fullCanvas = document.createElement('canvas');
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    fullCanvas.width = width;
    fullCanvas.height = height;

    const ctx = fullCanvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.94);

    // Auto-save immediately: "Chớp là tự thêm vào chứ"
    const pageNum = currentPagesCount + 1;
    const newPage: SubmissionPage = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: pageNum,
      imageData: dataUrl,
      rotation: 0,
      flippedH: false,
      brightness: 0,
      contrast: 0,
      pageStatus: 'clear',
    };

    onSavePage(newPage);
    setToastMessage(`⚡ Đã chớp & tự thêm Trang ${pageNum} vào bài của ${studentName || studentCode}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Save current captured page
  const handleConfirmPage = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);

    try {
      // Apply user adjustments (rotation, horizontal flip)
      const finalImage = await transformImage(capturedImage, {
        rotation,
        flippedH,
      });

      const newPage: SubmissionPage = {
        id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: currentPagesCount + 1,
        imageData: finalImage,
        rotation,
        flippedH,
        brightness: 0,
        contrast: 0,
        pageStatus: 'clear',
        isCloseUpDetail: isCloseUp,
        parentPageNumber: isCloseUp ? Math.max(1, currentPagesCount) : undefined,
      };

      onSavePage(newPage);
      setCapturedImage(null);
      setIsCloseUp(false);
      setToastMessage(`Đã lưu trang ${currentPagesCount + 1}! Bạn có thể chụp tiếp trang sau hoặc bấm "Kết thúc bài".`);
      setTimeout(() => setToastMessage(null), 3500);

      // Restart camera for continuous capture
      startCamera(facingMode);
    } catch (err) {
      console.error('Lỗi lưu ảnh:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
    setRotation(0);
    setFlippedH(false);
    startCamera(facingMode);
  };

  // Handle native camera capture file fallback
  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const file = e.target.files[0];
      const b64 = await fileToBase64(file);
      setCapturedImage(b64);
      setRotation(0);
      setFlippedH(false);
      setCameraError(null);
    } catch (err) {
      alert('Không thể đọc ảnh vừa chụp.');
    } finally {
      e.target.value = '';
    }
  };

  // Simulate snapping a realistic THCS sample page for instant test
  const handleSimulateSamplePage = () => {
    const pageNum = currentPagesCount + 1;
    const lines = [
      `BÀI THI MÔN NGỮ VĂN THCS - TRANG ${pageNum}`,
      'Phần I. Đọc hiểu văn bản: Em đồng tình với thông điệp tình người.',
      'Sơn và chị Lan đã có hành động cao đẹp, biết đem chiếc áo bông cũ cho cái Duyên.',
      'Dù đó chỉ là chiếc áo cũ nhưng chứa chan hơi ấm của tình thương yêu.',
      'Học sinh THCS cần học tập lòng nhân ái, không vô cảm trước bạn bè khó khăn.',
      'Phần II. Viết bài: Một trải nghiệm đáng nhớ của em khi làm việc thiện ở trường...',
    ];
    const simImage = generateHandwrittenPageImage(studentName || 'Học sinh', '8A2', pageNum, 2, lines);
    const newPage: SubmissionPage = {
      id: `page-${Date.now()}-sim`,
      pageNumber: pageNum,
      imageData: simImage,
      rotation: 0,
      flippedH: false,
      brightness: 0,
      contrast: 0,
      pageStatus: 'clear',
    };
    onSavePage(newPage);
    setToastMessage(`⚡ Đã nạp thành công Trang ${pageNum} mẫu THCS!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Finish student and move to next
  const handleFinishStudent = () => {
    onFinishStudentAndNext();
    setToastMessage(`🎉 Đã chốt bài cho học sinh vừa rồi! Bắt đầu chụp bài học sinh tiếp theo.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between text-white select-none">
      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 flex items-center justify-between bg-black/60 backdrop-blur-md border-b border-white/10 z-20">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-amber-400 text-sm sm:text-base tracking-wide truncate">
              {studentName && studentName !== 'Chưa xác định' ? `${studentName} (${studentCode})` : `Học sinh: ${studentCode}`}
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
              Đã chụp {currentPagesCount} trang
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5 truncate">
            {facingMode === 'environment' ? '📷 Camera sau (Chụp bài thi)' : '🤳 Camera trước (Chữ xuôi chiều)'} • Bậc THCS
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick THCS Sample Snap */}
          <button
            onClick={handleSimulateSamplePage}
            className="px-2.5 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 border border-purple-400/40"
            title="Chụp thử 1 trang mẫu THCS không cần giấy thi thật"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Chụp thử</span> mẫu
          </button>

          {torchSupported && !capturedImage && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-full border transition-colors ${
                isTorchOn ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-white/10 text-white border-white/20'
              }`}
              title="Đèn flash trợ sáng"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          {hasMultipleCameras && !capturedImage && (
            <button
              onClick={handleToggleFacingMode}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white"
              title="Đổi camera trước / sau"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-rose-600 border border-white/20 text-white"
            title="Đóng camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast notification banner */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center z-30 shadow-md animate-fade-in flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Viewfinder / Review Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-950">
        {cameraError ? (
          <div className="p-6 max-w-sm text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-2">Chụp ảnh qua máy ảnh thiết bị</h3>
            <p className="text-xs text-slate-300 mb-5">{cameraError}</p>
            <div className="space-y-3">
              {/* Native Mobile Camera Button */}
              <button
                onClick={() => nativeFileInputRef.current?.click()}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 text-xs"
              >
                <Camera className="w-4 h-4" />
                Mở ứng dụng Camera chụp ngay
              </button>

              <button
                onClick={handleSimulateSamplePage}
                className="w-full py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl active:scale-95"
              >
                ⚡ Chụp nhanh trang bài THCS mẫu (Thử nghiệm)
              </button>

              <button
                onClick={() => startCamera(facingMode)}
                className="w-full py-2.5 bg-white/15 text-white text-xs font-semibold rounded-xl active:scale-95"
              >
                Thử kết nối lại Camera Web
              </button>
            </div>
          </div>
        ) : capturedImage ? (
          /* Review captured image */
          <div className="relative w-full h-full flex items-center justify-center p-3">
            <img
              src={capturedImage}
              alt="Ảnh bài làm"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flippedH ? -1 : 1})`,
              }}
            />
            {isCloseUp && (
              <span className="absolute top-6 left-6 bg-purple-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                Ảnh chụp cận vùng khó đọc (Gắn với trang {currentPagesCount || 1})
              </span>
            )}
          </div>
        ) : (
          /* Live Viewfinder */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Document Guide Overlay */}
            <div className="absolute inset-x-4 sm:inset-x-8 inset-y-8 sm:inset-y-12 border-2 border-dashed border-amber-400/80 rounded-3xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center text-[11px] text-amber-200 font-bold bg-black/75 px-3 py-1 rounded-full self-center border border-amber-400/30">
                📄 Đặt trọn vẹn trang giấy thi THCS vào trong khung viền
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-300 font-medium">
                <span>Mép trên bài thi</span>
                <span>Mép dưới bài thi</span>
              </div>
            </div>

            {/* Real-time Quality Guidance Badge */}
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

            {/* Zoom Slider Control if supported */}
            {zoomSupported && (
              <div className="absolute bottom-4 inset-x-8 flex items-center gap-3 bg-black/70 px-4 py-2 rounded-full border border-white/20">
                <ZoomIn className="w-4 h-4 text-slate-300" />
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={zoomRange.step}
                  value={zoomLevel}
                  onChange={handleZoomChange}
                  className="w-full accent-amber-400"
                />
                <span className="text-xs text-slate-300 font-mono w-8">{zoomLevel.toFixed(1)}x</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar: Designed specifically for Mobile single-handed capture */}
      <div className="p-3 sm:p-5 bg-black/80 backdrop-blur-lg border-t border-white/10 z-20 space-y-3">
        {capturedImage ? (
          /* Controls after capturing */
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs flex-wrap">
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-medium"
              >
                <RotateCw className="w-4 h-4" />
                Xoay 90°
              </button>
              <button
                onClick={() => setFlippedH((f) => !f)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-medium"
              >
                <FlipHorizontal className="w-4 h-4" />
                Lật ngang
              </button>
              <button
                onClick={() => setIsCloseUp((c) => !c)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isCloseUp ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-200'
                }`}
              >
                <ZoomIn className="w-4 h-4" />
                Ảnh chụp cận
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRetake}
                className="py-3 px-4 bg-white/15 hover:bg-white/25 text-white font-bold rounded-2xl text-center active:scale-95 transition-transform text-xs sm:text-sm"
              >
                Chụp lại trang
              </button>
              <button
                onClick={handleConfirmPage}
                disabled={isProcessing}
                className="py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-amber-500/20 text-xs sm:text-sm"
              >
                <Check className="w-5 h-5" />
                {isProcessing ? 'Đang lưu...' : `Lưu trang ${currentPagesCount + 1}`}
              </button>
            </div>
          </div>
        ) : (
          /* Live Continuous Capture Controls: The Core Button Pair */
          <div className="space-y-3">
            <div className="grid grid-cols-3 items-center gap-2">
              {/* 1. NÚT KẾT THÚC BÀI – SANG HỌC SINH TIẾP THEO (CỰC KỲ NỔI BẬT & KHÔNG THỂ BỎ QUA) */}
              <button
                onClick={handleFinishStudent}
                className="h-16 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-emerald-700/40 active:scale-95 transition-all border-2 border-emerald-400 text-center leading-tight group"
                title="Chốt số trang bài hiện tại và chuyển sang học sinh tiếp theo"
              >
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-emerald-200 font-bold uppercase tracking-wider">
                  <UserCheck className="w-3.5 h-3.5 text-white" />
                  <span>KẾT THÚC BÀI</span>
                </div>
                <div className="text-[12px] sm:text-sm font-black flex items-center gap-1 text-white">
                  <span>Sang HS tiếp</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* 2. NÚT BẤM CHỤP TRANG (TRUNG TÂM) */}
              <div className="flex flex-col items-center justify-center">
                <button
                  onClick={handleCapture}
                  disabled={isLoadingCamera || Boolean(cameraError)}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-amber-500 active:scale-90 transition-transform shadow-2xl shadow-amber-500/40 disabled:opacity-50"
                  title="Bấm chụp trang này"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center text-slate-900 shadow-inner">
                    <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-slate-950" />
                  </div>
                </button>
                <span className="text-[10px] font-bold text-amber-300 mt-1">
                  Chụp trang {currentPagesCount + 1}
                </span>
              </div>

              {/* 3. NÚT CHỤP QUA CAMERA NATIVE / TẢI ẢNH */}
              <button
                onClick={() => nativeFileInputRef.current?.click()}
                className="h-16 px-2 sm:px-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-2xl flex flex-col items-center justify-center border border-white/20 active:scale-95 transition-all text-center leading-tight"
                title="Mở ứng dụng Camera chụp ảnh trực tiếp từ điện thoại"
              >
                <Upload className="w-4 h-4 text-amber-400 mb-0.5" />
                <span className="text-[11px] sm:text-xs font-bold text-white">Camera máy</span>
                <span className="text-[9px] text-slate-400">Chụp app ngoài</span>
              </button>
            </div>

            {/* Instruction footnote */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1 border-t border-white/10">
              <span className="text-amber-200">
                💡 Chụp lần lượt các trang của học sinh, khi hết bài bấm <strong>"KẾT THÚC BÀI"</strong>
              </span>
              <button
                onClick={handleSimulateSamplePage}
                className="text-purple-300 hover:text-purple-200 underline font-semibold shrink-0 ml-2"
              >
                + Chụp thử trang THCS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden native camera capture input fallback */}
      <input
        ref={nativeFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeFileChange}
        className="hidden"
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
