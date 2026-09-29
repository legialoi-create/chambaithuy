import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { fileToBase64, convertPdfToImages } from '../utils/imageProcessing';

interface DesktopUploadAreaProps {
  onAddImages: (images: string[], originalFileName?: string) => void;
  isProcessing?: boolean;
}

export const DesktopUploadArea: React.FC<DesktopUploadAreaProps> = ({
  onAddImages,
  isProcessing = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [lastUploadedCount, setLastUploadedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFileList = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setLoadingMessage('Đang xử lý tệp ảnh và trích xuất trang PDF...');
    const resultImages: string[] = [];

    try {
      for (const file of fileArray) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          setLoadingMessage(`Đang trích xuất trang từ file PDF: ${file.name}...`);
          const pdfImages = await convertPdfToImages(file);
          resultImages.push(...pdfImages);
        } else if (file.type.startsWith('image/')) {
          const b64 = await fileToBase64(file);
          resultImages.push(b64);
        }
      }

      if (resultImages.length > 0) {
        onAddImages(resultImages);
        setLastUploadedCount(resultImages.length);
        setTimeout(() => setLastUploadedCount(null), 4000);
      }
    } catch (err: any) {
      console.error('Lỗi nạp tệp:', err);
      alert(err.message || 'Có lỗi xảy ra khi nạp tệp bài làm.');
    } finally {
      setLoadingMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files);
    }
  };

  // Support pasting image from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        await processFileList(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all duration-200 text-center flex flex-col items-center justify-center ${
          isDragging
            ? 'border-amber-500 bg-amber-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-amber-400 bg-white hover:bg-slate-50/60 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              processFileList(e.target.files);
              e.target.value = ''; // reset so same files can be re-selected if needed
            }
          }}
        />

        {loadingMessage ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">{loadingMessage}</p>
            <p className="text-xs text-slate-500">Giữ nguyên trang trình duyệt, quá trình đang diễn ra</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Kéo thả ảnh bài thi hoặc file PDF vào đây
            </h3>
            <p className="text-sm text-slate-500 max-w-md mb-4">
              Nhấp để chọn tệp từ máy tính, hoặc nhấn <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700">Ctrl + V</kbd> để dán ảnh trực tiếp từ bộ nhớ tạm
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg">
                <ImageIcon className="w-4 h-4 text-sky-600" /> Hỗ trợ JPG, PNG, WEBP
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg">
                <FileText className="w-4 h-4 text-rose-600" /> Tự động tách trang từ file PDF
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Không giới hạn số lượng ảnh
              </span>
            </div>

            {lastUploadedCount !== null && (
              <div className="mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Đã tiếp nhận thành công {lastUploadedCount} trang bài làm mới!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
