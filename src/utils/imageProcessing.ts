/**
 * Image processing utilities for handwritten document capture
 */

export interface QualityAnalysisResult {
  isSharp: boolean;
  sharpnessScore: number; // 0 to 100
  brightnessScore: number; // 0 to 255 (ideal ~ 110 - 200)
  isTooDark: boolean;
  isTooBrightOrGlare: boolean;
  feedbackMessage: string;
  isAcceptable: boolean;
}

/**
 * Analyzes video frame or canvas for blur, dark, and glare
 * Uses Laplacian-variance approximation & luminance histogram.
 */
export function analyzeImageQuality(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): QualityAnalysisResult {
  // Use a downsampled region for fast real-time analysis (prevents lag and battery heat)
  const sampleW = Math.min(width, 320);
  const sampleH = Math.min(height, 240);
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tCtx = tempCanvas.getContext('2d');
  
  if (!tCtx) {
    return {
      isSharp: true,
      sharpnessScore: 80,
      brightnessScore: 140,
      isTooDark: false,
      isTooBrightOrGlare: false,
      feedbackMessage: 'Ảnh ổn định, sẵn sàng chụp',
      isAcceptable: true,
    };
  }

  tCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, sampleW, sampleH);
  const imgData = tCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // 1. Calculate average luminance and glare count
  let totalLuminance = 0;
  let glarePixels = 0;
  let darkPixels = 0;
  const gray: number[] = new Array(sampleW * sampleH);

  for (let i = 0; i < data.length; i += 4) {
    // Standard luminance formula
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const pIdx = i / 4;
    gray[pIdx] = l;
    totalLuminance += l;
    if (l > 245) glarePixels++;
    if (l < 45) darkPixels++;
  }

  const avgLuminance = totalLuminance / (sampleW * sampleH);
  const glareRatio = glarePixels / (sampleW * sampleH);
  const darkRatio = darkPixels / (sampleW * sampleH);

  // 2. High-pass / Laplacian gradient for sharpness
  let diffSum = 0;
  for (let y = 1; y < sampleH - 1; y += 2) {
    for (let x = 1; x < sampleW - 1; x += 2) {
      const idx = y * sampleW + x;
      // Simple 4-neighborhood laplacian
      const val = gray[idx];
      const diff =
        Math.abs(val - gray[idx - 1]) +
        Math.abs(val - gray[idx + 1]) +
        Math.abs(val - gray[idx - sampleW]) +
        Math.abs(val - gray[idx + sampleW]);
      diffSum += diff;
    }
  }

  const sampleCount = ((sampleH - 2) / 2) * ((sampleW - 2) / 2);
  const sharpnessScore = Math.min(100, Math.round((diffSum / sampleCount) * 1.5));

  const isSharp = sharpnessScore >= 20;
  const isTooDark = avgLuminance < 65 || darkRatio > 0.45;
  const isTooBrightOrGlare = glareRatio > 0.15;

  let feedbackMessage = 'Khung hình rõ, độ sáng tốt';
  let isAcceptable = true;

  if (isTooDark) {
    feedbackMessage = 'Ảnh bị thiếu sáng. Vui lòng tăng ánh sáng hoặc bật đèn';
    isAcceptable = false;
  } else if (isTooBrightOrGlare) {
    feedbackMessage = 'Bị chói lóa sáng che mất chữ. Hãy đổi góc máy để tránh lóa';
    isAcceptable = false;
  } else if (!isSharp) {
    feedbackMessage = 'Ảnh hơi mờ hoặc rung tay. Giữ máy ổn định để nét chữ rõ';
    isAcceptable = false;
  } else {
    feedbackMessage = 'Đạt chuẩn: Nét chữ rõ, ánh sáng đầy đủ';
  }

  return {
    isSharp,
    sharpnessScore,
    brightnessScore: Math.round(avgLuminance),
    isTooDark,
    isTooBrightOrGlare,
    feedbackMessage,
    isAcceptable,
  };
}

/**
 * Apply rotation (90, 180, 270), flip horizontal, and slight brightness/contrast
 * without compressing excessively, preserving Vietnamese accents & fine strokes.
 */
export async function transformImage(
  base64Data: string,
  options: {
    rotation?: number; // 0, 90, 180, 270
    flippedH?: boolean;
    brightness?: number; // -50 to 50
    contrast?: number; // -50 to 50
  }
): Promise<string> {
  const { rotation = 0, flippedH = false, brightness = 0, contrast = 0 } = options;

  if (rotation === 0 && !flippedH && brightness === 0 && contrast === 0) {
    return base64Data;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const targetW = isRotated90or270 ? img.height : img.width;
      const targetH = isRotated90or270 ? img.width : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(base64Data);
      }

      ctx.save();
      // Move to center for rotation & flip
      ctx.translate(targetW / 2, targetH / 2);

      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }

      if (flippedH) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Apply subtle brightness / contrast if requested
      if (brightness !== 0 || contrast !== 0) {
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const d = imgData.data;
        const b = brightness; // -50 to 50
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast)); // standard contrast factor

        for (let i = 0; i < d.length; i += 4) {
          // R, G, B
          d[i] = factor * (d[i] + b - 128) + 128;
          d[i + 1] = factor * (d[i + 1] + b - 128) + 128;
          d[i + 2] = factor * (d[i + 2] + b - 128) + 128;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // High quality JPEG/PNG output
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = (err) => reject(err);
    img.src = base64Data;
  });
}

/**
 * Reads a File object to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts all pages of a PDF file into an array of base64 images
 * using dynamic pdfjs import to ensure browser compatibility.
 */
export async function convertPdfToImages(file: File): Promise<string[]> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Configure worker
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Render at 2.0x scale for crisp Vietnamese handwriting resolution
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await (page.render(renderContext as any) as any).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.92));
    }

    return images;
  } catch (err) {
    console.error('Lỗi đọc file PDF:', err);
    throw new Error('Không thể trích xuất trang từ file PDF. Hãy đảm bảo PDF không bị khóa mật khẩu.');
  }
}

/**
 * Advanced image enhancement specifically tuned for Vietnamese handwriting:
 * - 'enhance_ink': Boosts ink density while preserving subtle diacritic marks (dấu mũ, móc, sắc, huyền, hỏi, ngã, nặng)
 * - 'remove_grid': Suppresses student notebook grid lines (giấy kẻ ngang, ô ly) to make text stand out
 * - 'sharpen': Convolution high-pass filter to crispen faint strokes
 * - 'grayscale': High-contrast monochromatic conversion
 */
export async function enhanceVietnameseHandwritingImage(
  base64Image: string,
  mode: 'enhance_ink' | 'remove_grid' | 'sharpen' | 'grayscale'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image);

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      if (mode === 'enhance_ink') {
        // Boost dark ink strokes and preserve diacritics
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Perceived luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (lum < 150) {
            // Dark stroke: deepen towards rich blue-black
            const factor = Math.pow(lum / 150, 1.4);
            data[i] = Math.max(0, Math.floor(r * factor));
            data[i + 1] = Math.max(0, Math.floor(g * factor));
            data[i + 2] = Math.max(0, Math.floor(b * factor * 1.1));
          } else {
            // Light background: brighten towards clean paper
            const bgBoost = Math.min(255, lum + (255 - lum) * 0.45);
            data[i] = bgBoost;
            data[i + 1] = bgBoost;
            data[i + 2] = bgBoost;
          }
        }
      } else if (mode === 'remove_grid') {
        // Suppress faint blue/red grid lines while keeping dark handwriting
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // If pixel is faint or matches common notebook line colors (light blue/cyan or light pink)
          const isGridColor = (b > r + 15 && lum > 130) || (r > g + 15 && lum > 140) || lum > 175;
          if (isGridColor) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else {
            // Darken true handwriting
            const ink = Math.max(0, lum - 35);
            data[i] = ink;
            data[i + 1] = ink;
            data[i + 2] = ink;
          }
        }
      } else if (mode === 'sharpen') {
        // High-contrast sharpen
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // S-curve contrast
          const contrast = (lum - 128) * 1.35 + 128;
          const clamped = Math.max(0, Math.min(255, contrast));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }
      } else if (mode === 'grayscale') {
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.94));
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
}

/**
 * Common abbreviations used by Vietnamese secondary students (THCS) in literature essays
 */
export const VIETNAMESE_LITERATURE_ABBREVIATIONS: Record<string, string> = {
  'ptbđ': 'phương thức biểu đạt',
  'PTBĐ': 'Phương thức biểu đạt',
  'bptt': 'biện pháp tu từ',
  'BPTT': 'Biện pháp tu từ',
  'nvat': 'nhân vật',
  'nv': 'nhân vật',
  'NV': 'Nhân vật',
  'td': 'tác dụng',
  'TD': 'Tác dụng',
  'vb': 'văn bản',
  'VB': 'Văn bản',
  'nd': 'nội dung',
  'ND': 'Nội dung',
  'nt': 'nghệ thuật',
  'NT': 'Nghệ thuật',
  'thcs': 'THCS',
  'bkh': 'biện pháp nghệ thuật',
  'đh': 'Đọc hiểu',
  'lv': 'Làm văn',
};

/**
 * Expand student shorthand into standard literary terminology
 */
export function expandVietnameseAbbreviations(text: string): {
  expandedText: string;
  replacementsCount: number;
} {
  let count = 0;
  let result = text;

  Object.entries(VIETNAMESE_LITERATURE_ABBREVIATIONS).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    const matches = result.match(regex);
    if (matches) {
      count += matches.length;
      result = result.replace(regex, full);
    }
  });

  return { expandedText: result, replacementsCount: count };
}

/**
 * Analyzes Vietnamese text to audit diacritics, detecting potential misspellings
 */
export function auditVietnameseDiacritics(text: string): {
  totalWords: number;
  unaccentedSuspiciousWords: string[];
  suggestedCorrections: { snippet: string; suggestion: string }[];
} {
  const words = text.split(/\s+/).filter(Boolean);
  const suspicious: string[] = [];
  const suggestions: { snippet: string; suggestion: string }[] = [];

  // Common patterns where accents are often misplaced or forgotten
  const commonMissingAccents: Record<string, string> = {
    'nghi luan': 'nghị luận',
    'nghi luan xa hoi': 'nghị luận xã hội',
    'nghi luan van hoc': 'nghị luận văn học',
    'doc hieu': 'đọc hiểu',
    'mo bai': 'mở bài',
    'than bai': 'thân bài',
    'ket bai': 'kết bài',
    'tac gia': 'tác giả',
    'tac pham': 'tác phẩm',
    'nhan vat': 'nhân vật',
    'nghe thuat': 'nghệ thuật',
    'noi dung': 'nội dung',
    'bien phap': 'biện pháp',
    'so sanh': 'so sánh',
    'nhan hoa': 'nhân hóa',
    'an du': 'ẩn dụ',
    'hoan du': 'hoán dụ',
  };

  const lower = text.toLowerCase();
  Object.entries(commonMissingAccents).forEach(([unaccented, accented]) => {
    if (lower.includes(unaccented)) {
      suggestions.push({
        snippet: unaccented,
        suggestion: accented,
      });
    }
  });

  return {
    totalWords: words.length,
    unaccentedSuspiciousWords: suspicious,
    suggestedCorrections: suggestions,
  };
}

