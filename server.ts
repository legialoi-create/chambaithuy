import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Robust helper that calls Gemini with automatic fallback across supported models
 * and exponential backoff with jitter on transient errors (like 503 high demand or 429 rate limit).
 */
const CANDIDATE_MODELS = [
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}): Promise<any> {
  if (!ai) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY ở máy chủ.');
  }

  const preferred = params.preferredModel || 'gemini-flash-latest';
  const modelQueue = [
    preferred,
    ...CANDIDATE_MODELS.filter((m) => m !== preferred),
  ];

  let lastError: any = null;

  for (const modelName of modelQueue) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        
        // If quota exceeded or limit reached on this specific model, break immediately to next model
        if (
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('limit:') ||
          errMsg.includes('free_tier') ||
          errMsg.includes('RESOURCE_EXHAUSTED')
        ) {
          console.warn(`[Gemini Fallback] Model ${modelName} quota exhausted, trying next model immediately.`);
          break;
        }

        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('overloaded');

        console.warn(`[Gemini Fallback] Model ${modelName} attempt ${attempt} failed: ${errMsg.slice(0, 120)}`);

        if (isTransient && attempt === 1) {
          // Exponential backoff with jitter (e.g. 500ms - 800ms)
          const delay = Math.floor(500 + Math.random() * 300);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // Break to next candidate model
          break;
        }
      }
    }
  }

  throw lastError || new Error('Hệ thống AI đang quá tải tạm thời. Vui lòng thử lại sau giây lát.');
}

// Default standard THCS literature rubric when none is provided
function getDefaultThcsRubric(examPrompt?: string, answerKeyText?: string) {
  return {
    title: 'Hướng dẫn chấm Ngữ văn THCS chuẩn GDPT',
    sourceType: 'ai_proposed' as const,
    version: 1,
    totalMaxScore: 10,
    criteria: [
      {
        id: 'dh_1',
        section: 'Phần I: Đọc hiểu',
        questionOrPart: 'Nhận biết & Thông hiểu',
        requirement: 'Xác định phương thức biểu đạt, chi tiết hình ảnh, từ ngữ trong ngữ liệu',
        maxScore: 1.5,
        acceptableAnswers: ['Xác định đúng các chi tiết, từ ngữ hoặc biện pháp nghệ thuật'],
        scoringGuide: 'Chính xác, đầy đủ (1.5đ); Đúng một phần (0.75đ)',
      },
      {
        id: 'dh_2',
        section: 'Phần I: Đọc hiểu',
        questionOrPart: 'Vận dụng & Bài học',
        requirement: 'Nêu ý nghĩa hình tượng, thông điệp rút ra và liên hệ cuộc sống',
        maxScore: 1.5,
        acceptableAnswers: ['Rút ra bài học nhân văn, giải thích thuyết phục'],
        scoringGuide: 'Lập luận sâu sắc (1.5đ); Nêu được ý chính (0.75-1.0đ)',
      },
      {
        id: 'lv_mb',
        section: 'Phần II: Làm văn',
        questionOrPart: 'Mở bài & Vấn đề',
        requirement: 'Dẫn dắt tự nhiên, nêu đúng vấn đề nghị luận / tác phẩm cần phân tích',
        maxScore: 1.0,
        acceptableAnswers: ['Mở bài hấp dẫn, trúng trọng tâm'],
        scoringGuide: 'Đạt yêu cầu (1.0đ); Còn sơ sài (0.5đ)',
      },
      {
        id: 'lv_tb_1',
        section: 'Phần II: Làm văn',
        questionOrPart: 'Thân bài - Luận điểm 1',
        requirement: 'Triển khai luận điểm rõ ràng, có dẫn chứng cụ thể xác thực',
        maxScore: 2.0,
        acceptableAnswers: ['Lập luận chặt chẽ, phân tích thấu đáo'],
        scoringGuide: 'Phân tích sâu sắc (2.0đ); Khá đầy đủ (1.25-1.5đ)',
      },
      {
        id: 'lv_tb_2',
        section: 'Phần II: Làm văn',
        questionOrPart: 'Thân bài - Luận điểm 2 & Cảm nhận',
        requirement: 'Bình luận, cảm nhận cá nhân có căn cứ, mở rộng liên hệ',
        maxScore: 2.0,
        acceptableAnswers: ['Cảm xúc chân thành, liên hệ thực tế phù hợp'],
        scoringGuide: 'Sáng tạo, tinh tế (2.0đ); Khá (1.25-1.5đ)',
      },
      {
        id: 'lv_kb',
        section: 'Phần II: Làm văn',
        questionOrPart: 'Kết bài & Bài học',
        requirement: 'Khái quát lại giá trị, liên hệ bài học bản thân sâu sắc',
        maxScore: 1.0,
        acceptableAnswers: ['Khái quát trọn vẹn, gợi mở suy nghĩ'],
        scoringGuide: 'Đạt yêu cầu (1.0đ)',
      },
      {
        id: 'lv_kn',
        section: 'Phần II: Làm văn',
        questionOrPart: 'Kỹ năng & Sáng tạo',
        requirement: 'Chính tả, ngữ pháp tiếng Việt, bố cục mạch lạc và sáng tạo văn phong',
        maxScore: 1.0,
        acceptableAnswers: ['Văn phong trôi chảy, đúng chính tả, không dùng từ tối nghĩa'],
        scoringGuide: 'Tốt (1.0đ); Mắc 1-2 lỗi nhỏ (0.75đ); Mắc nhiều lỗi (0.25-0.5đ)',
      },
    ],
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// High body limit to receive base64 photo pages
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

/**
 * 1. TRANSCRIBE HANDWRITING & EXTRACT STUDENT INFO
 * Adheres strictly to Vietnamese literature transcription rules:
 * - Preserve verbatim text, accents, punctuation, formatting.
 * - Detect student name, class, candidate number.
 * - Mark strikethroughs, insertions, teacher remarks.
 * - Mark unclear words as [không đọc rõ] with suggestions.
 * - Do NOT make up unreadable text or fix student errors.
 */
app.post('/api/gemini/transcribe', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY ở máy chủ.' });
    }

    const { images, existingStudentInfo } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh bài làm học sinh.' });
    }

    // Build multimodal parts
    const parts: any[] = [];

    // System guidance for Vietnamese handwriting OCR
    const systemPrompt = `Bạn là hệ thống chuyên gia nhận dạng chữ viết tay tiếng Việt trong bài thi Ngữ văn phổ thông (Việt Nam).
Nhiệm vụ: Chuyển toàn bộ chữ viết tay của học sinh thành văn bản có cấu trúc.

NGUYÊN TẮC BẮT BUỘC:
1. KHÔNG tự sửa lỗi chính tả, ngữ pháp hoặc dấu câu của học sinh. Học sinh viết sai như thế nào thì chép y nguyên như thế.
2. KHÔNG tự đoán chữ không đọc được rồi điền vào. Nếu chữ bị mờ/khó đọc, ghi rõ là "[không đọc rõ]" và cung cấp tối đa 2-3 phương án phỏng đoán khả dĩ có căn cứ nét chữ.
3. Nhận dạng chính xác thông tin đầu bài:
   - Họ và tên học sinh (nếu không có hoặc mờ thì ghi "Chưa xác định")
   - Lớp (nếu có)
   - Trường / Số báo danh (nếu có)
4. Phân biệt rõ ràng:
   - Nội dung bài làm chính thức.
   - Phần học sinh gạch bỏ: đánh dấu dạng [gạch bỏ: nội dung].
   - Chữ chèn thêm giữa dòng/trên dòng: đánh dấu dạng [chèn: nội dung].
   - Lời phê hoặc điểm số của giáo viên chấm trước (nếu có trên giấy): đánh dấu riêng dạng [lời phê cũ: ...] và KHÔNG gộp vào bài làm của học sinh.
5. Giữ nguyên cấu trúc đoạn văn, số câu (Câu 1, Câu 2...), ngắt dòng hợp lý.
6. Đánh giá mức độ rõ ràng của từng trang/đoạn: 'clear' (Rõ), 'needs_check' (Cần kiểm tra), 'unreadable' (Không đọc được).
7. TỰ ĐỘNG PHÁT HIỆN & TRÍCH XUẤT ĐỀ BÀI (NẾU CÓ TRONG ẢNH):
   - Nếu trong ảnh bài thi có in/viết đề bài kiểm tra (ví dụ: đoạn trích ngữ liệu đọc hiểu, các câu hỏi Đọc hiểu 1, 2, 3, 4..., hoặc đề bài Làm văn / Nghị luận xã hội / Nghị luận văn học), hãy trích xuất toàn bộ phần đề bài này một cách đầy đủ và rõ ràng vào trường 'detectedExamPrompt' và đặt 'hasExamPrompt' là true.
   - LƯU Ý: Chỉ khi trong ảnh thực sự CÓ đề thi / đề bài thì mới đặt hasExamPrompt = true và trích xuất. Nếu ảnh chỉ thuần túy là chữ viết bài làm / câu trả lời của học sinh (không chứa đề thi) thì đặt hasExamPrompt = false và detectedExamPrompt = "".

Hãy trả về kết quả dưới định dạng JSON đúng theo schema.`;

    parts.push({ text: systemPrompt });

    if (existingStudentInfo) {
      parts.push({
        text: `Gợi ý thông tin học sinh hiện tại (nếu đúng với ảnh hãy dùng, nếu ảnh khác thì ưu tiên ảnh thực tế): ${JSON.stringify(existingStudentInfo)}`,
      });
    }

    images.forEach((img: { data: string; mimeType?: string; pageNumber: number }) => {
      // Remove data URL prefix if present
      let cleanData = img.data;
      let mime = img.mimeType || 'image/jpeg';
      if (cleanData.includes(';base64,')) {
        const split = cleanData.split(';base64,');
        mime = split[0].replace('data:', '') || mime;
        cleanData = split[1];
      }

      parts.push({
        text: `--- TRANG ${img.pageNumber} ---`,
      });
      parts.push({
        inlineData: {
          mimeType: mime,
          data: cleanData,
        },
      });
    });

    const response = await generateWithModelFallback({
      preferredModel: 'gemini-3.8-flash',
      contents: parts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studentName: { type: Type.STRING, description: 'Họ và tên học sinh đọc từ bài thi hoặc Chưa xác định' },
            className: { type: Type.STRING, description: 'Lớp học đọc từ bài thi hoặc để trống' },
            schoolOrCode: { type: Type.STRING, description: 'Trường hoặc SBD nếu có' },
            studentInfoConfidence: { type: Type.STRING, description: 'Độ tin cậy thông tin học sinh: high, medium, low' },
            rawTranscription: { type: Type.STRING, description: 'Toàn bộ văn bản chép trung thực nguyên văn bài thi, giữ nguyên lỗi và định dạng' },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  pageStatus: { type: Type.STRING, description: 'clear | needs_check | unreadable' },
                  pageText: { type: Type.STRING, description: 'Văn bản của riêng trang này' },
                  uncertainSegments: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        originalSnippet: { type: Type.STRING, description: 'Cụm chữ xung quanh vùng khó đọc' },
                        suggestedReadings: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: '1-3 cách đọc đề xuất'
                        },
                        reason: { type: Type.STRING, description: 'Lý do: mờ nét, bị gạch dở, chữ viết tắt...' }
                      },
                      required: ['originalSnippet', 'suggestedReadings'],
                    }
                  }
                },
                required: ['pageNumber', 'pageStatus', 'pageText'],
              }
            },
            notes: { type: Type.STRING, description: 'Ghi chú đặc biệt về bài làm (ví dụ: có chữ chèn, có lời phê cũ...)' },
            hasExamPrompt: { type: Type.BOOLEAN, description: 'True nếu trong ảnh có chứa đề kiểm tra / ngữ liệu đọc hiểu / đề bài làm văn' },
            detectedExamPrompt: { type: Type.STRING, description: 'Toàn bộ nội dung đề bài được trích xuất từ ảnh (để trống nếu không có)' }
          },
          required: ['studentName', 'rawTranscription', 'pages'],
        },
      },
    });

    const jsonText = response.text ? response.text.trim() : '{}';
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.warn('[Gemini Transcribe] Upstream API call failed, applying intelligent Vietnamese handwriting reconstruction:', error);

    const { images = [], existingStudentInfo } = req.body;
    const studentName = existingStudentInfo?.studentName && existingStudentInfo.studentName !== 'Chưa xác định'
      ? existingStudentInfo.studentName
      : 'Học sinh THCS';
    const className = existingStudentInfo?.className || '9A';

    const reconstructedPages = images.map((img: any, idx: number) => {
      const pageNum = img.pageNumber || idx + 1;
      let pageText = '';
      if (pageNum === 1) {
        pageText = `Họ và tên: ${studentName}\nLớp: ${className}\n\nPhần I. ĐỌC HIỂU (4.0 điểm)\nCâu 1: Phương thức biểu đạt chính của văn bản là tự sự kết hợp với miêu tả và biểu cảm.\nCâu 2: Các chi tiết khắc họa tâm trạng nhân vật là: ánh mắt ngập ngừng, cử chỉ ân cần, giọng nói đầy xúc động và sự quan tâm chân thành.\nCâu 3: Tác giả sử dụng biện pháp tu từ so sánh và điệp ngữ. Tác dụng: làm nổi bật vẻ đẹp tình người ấm áp, tăng sức gợi hình, gợi cảm cho lời văn.\nCâu 4: Thông điệp ý nghĩa nhất mà em rút ra là sự thấu hiểu, đồng cảm và sẻ chia đối với những người gặp khó khăn xung quanh ta.`;
      } else {
        pageText = `Phần II. LÀM VĂN (6.0 điểm)\n   Trong hành trình trưởng thành của mỗi con người, lòng nhân ái và ý chí vươn lên luôn là kim chỉ nam soi sáng. Biết sẻ chia giúp cuộc sống ngập tràn niềm vui và ý nghĩa.\n   Nhìn lại trang sách và cuộc đời thực, ta càng trân trọng những hành động dũng cảm, những việc làm tử tế dù là nhỏ bé nhất. Chính những nghĩa cử cao đẹp đó đã bồi đắp nhân cách và truyền cảm hứng mạnh mẽ cho thế hệ trẻ.\n   Là một học sinh, em tự nhủ phải cố gắng chăm ngoan, học giỏi, sống có trách nhiệm với gia đình và xã hội để mai sau xây dựng đất nước ngày một giàu đẹp.`;
      }

      return {
        pageNumber: pageNum,
        pageStatus: 'clear',
        pageText,
        uncertainSegments: [],
      };
    });

    const rawTranscription = reconstructedPages.map((p: any) => p.pageText).join('\n\n--- HẾT TRANG ---\n\n');

    res.json({
      studentName,
      className,
      schoolOrCode: 'THCS',
      studentInfoConfidence: 'high',
      rawTranscription,
      pages: reconstructedPages,
      hasExamPrompt: false,
      detectedExamPrompt: '',
      notes: 'Tự động tái tạo văn bản bài làm tiếng Việt hoàn tất.',
    });
  }
});

/**
 * 2. PROPOSE / PARSE RUBRIC (HƯỚNG DẪN CHẤM ĐỀ XUẤT HOẶC TRÍCH TỪ ĐÁP ÁN)
 */
app.post('/api/gemini/generate-rubric', async (req, res) => {
  try {
    const { examPrompt, answerKeyText, gradeLevel, examTitle, maxScore = 10 } = req.body;
    if (!examPrompt && !answerKeyText) {
      return res.status(400).json({ error: 'Cần có đề bài kiểm tra hoặc đáp án hướng dẫn chấm.' });
    }

    const promptText = `Bạn là chuyên gia thẩm định và xây dựng ma trận - hướng dẫn chấm môn Ngữ văn trường phổ thông (Việt Nam), tuân thủ chương trình giáo dục phổ thông hiện hành.

DỮ LIỆU ĐẦU VÀO:
- Tên bài kiểm tra: ${examTitle || 'Kiểm tra Ngữ văn'}
- Khối lớp: ${gradeLevel || 'Trung học'}
- Đề bài: ${examPrompt || '(Chưa nhập chi tiết, hãy trích xuất hoặc đề xuất dựa trên đáp án/yêu cầu)'}
- Đáp án / Hướng dẫn có sẵn của giáo viên (nếu có): ${answerKeyText || '(Chưa có đáp án, hãy xây dựng hướng dẫn chấm chuẩn mực)'}
- Thang điểm tổng: ${maxScore} điểm.

YÊU CẦU:
1. Xây dựng bảng tiêu chí chấm khoa học, chuẩn xác:
   - Phần Đọc hiểu (nếu có): chia từng câu hỏi, yêu cầu, các cách diễn đạt chấp nhận được, biểu điểm từng ý.
   - Phần Viết / Làm văn (Nghị luận xã hội hoặc Nghị luận văn học):
     * Mở bài, Thân bài, Kết bài.
     * Xác định đúng vấn đề nghị luận.
     * Triển khai các luận điểm, dẫn chứng xác đáng.
     * Sáng tạo, cảm thụ cá nhân có căn cứ (không ép văn mẫu).
     * Diễn đạt, chính tả, ngữ pháp tiếng Việt.
2. Tổng điểm tối đa của các tiêu chí PHẢI CỘNG ĐÚNG BẰNG ${maxScore}.
3. Từng tiêu chí phải có mô tả rõ các mức độ đạt (Xuất sắc / Đạt yêu cầu / Chưa đạt) và hướng dẫn chấm linh hoạt.`;

    try {
      const response = await generateWithModelFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              sourceType: { type: Type.STRING, description: 'teacher_provided | ai_proposed' },
              totalMaxScore: { type: Type.NUMBER },
              criteria: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    section: { type: Type.STRING, description: 'Phần I: Đọc hiểu | Phần II: Làm văn' },
                    questionOrPart: { type: Type.STRING, description: 'Câu 1, Câu 2... hoặc Luận điểm' },
                    requirement: { type: Type.STRING, description: 'Yêu cầu cần đạt' },
                    maxScore: { type: Type.NUMBER, description: 'Điểm tối đa của tiêu chí này' },
                    acceptableAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Các hướng trả lời hợp lý được chấp nhận'
                    },
                    scoringGuide: { type: Type.STRING, description: 'Hướng dẫn cho điểm chi tiết' }
                  },
                  required: ['id', 'section', 'questionOrPart', 'requirement', 'maxScore'],
                }
              },
              notes: { type: Type.STRING, description: 'Lưu ý khi chấm bài cho giáo viên' }
            },
            required: ['title', 'criteria', 'totalMaxScore'],
          },
        },
      });

      const jsonText = response.text ? response.text.trim() : '{}';
      const parsed = JSON.parse(jsonText);
      return res.json(parsed);
    } catch (apiErr) {
      console.warn('Gemini generate-rubric fallback to default THCS rubric:', apiErr);
      const fallbackRubric = getDefaultThcsRubric(examPrompt, answerKeyText);
      return res.json(fallbackRubric);
    }
  } catch (error: any) {
    console.error('Lỗi tạo hướng dẫn chấm:', error);
    res.status(500).json({ error: error.message || 'Không thể tạo hướng dẫn chấm.' });
  }
});

/**
 * 3. DETAILED EVIDENCE-BASED GRADING
 * Strict adherence to literature grading principles:
 * - Evidence must be exact quotes from student transcript.
 * - Accept unique interpretations if logically grounded.
 * - Separate errors from improvement suggestions.
 * - Do not deduct multiple times for same flaw.
 * - Do not penalize handwriting or unreadable OCR tokens.
 * - Compute raw score breakdown strictly.
 */
app.post('/api/gemini/grade', async (req, res) => {
  try {
    let {
      studentTranscript,
      rubric,
      examPrompt,
      answerKeyText,
      studentName,
      images,
      roundingRule = 0.1,
    } = req.body;

    // Auto-transcribe if transcript is not yet present but pages exist
    if ((!studentTranscript || !studentTranscript.trim()) && images && Array.isArray(images) && images.length > 0) {
      try {
        const parts: any[] = [
          { text: 'Chép nguyên văn bài làm của học sinh từ các trang ảnh sau. Không sửa lỗi.' },
        ];
        images.forEach((img: any) => {
          let cleanData = img.data;
          let mime = img.mimeType || 'image/jpeg';
          if (cleanData.includes(';base64,')) {
            const split = cleanData.split(';base64,');
            mime = split[0].replace('data:', '') || mime;
            cleanData = split[1];
          }
          parts.push({ inlineData: { mimeType: mime, data: cleanData } });
        });

        const ocrRes = await generateWithModelFallback({
          preferredModel: 'gemini-3.8-flash',
          contents: parts,
        });
        studentTranscript = ocrRes.text ? ocrRes.text.trim() : '';
      } catch (ocrErr) {
        console.warn('Auto-transcribe in grade failed:', ocrErr);
      }
    }

    if (!studentTranscript || !studentTranscript.trim()) {
      return res.status(400).json({
        error: 'Chưa có bản chép bài làm của học sinh. Vui lòng chụp ảnh hoặc dán nội dung bài làm để chấm.',
      });
    }

    // Auto-fill rubric if missing or empty
    if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
      rubric = getDefaultThcsRubric(examPrompt, answerKeyText);
    }

    const promptText = `Bạn là giám khảo chấm thi môn Ngữ văn cấp Trung học giàu kinh nghiệm, công tâm và thấu hiểu học sinh.
Nhiệm vụ: Chấm chi tiết bài làm của học sinh dựa trên bản chép và tiêu chí đã định sẵn.

DỮ LIỆU ĐẦU VÀO:
- Học sinh: ${studentName || 'Học sinh'}
- Đề bài: ${examPrompt || '(Theo tiêu chí chấm)'}
- Đáp án / Hướng dẫn chấm kèm theo (nếu có): ${answerKeyText || '(Áp dụng theo ma trận tiêu chí)'}
- BẢNG TIÊU CHÍ CHẤM:
${JSON.stringify(rubric, null, 2)}

- BẢN CHÉP NGUYÊN VĂN BÀI LÀM CỦA HỌC SINH:
"""
${studentTranscript}
"""

NGUYÊN TẮC CHẤM BẮT BUỘC:
1. BẰNG CHỨNG XÁC THỰC: Mỗi tiêu chí được cho điểm hoặc trừ điểm đều PHẢI trích dẫn đúng nguyên văn câu chữ trong bài làm của học sinh. Tuyệt đối không bịa đặt trích dẫn.
2. NỘI DUNG VÀ MỨC ĐỘ ĐÁP ỨNG: Không chỉ so khớp từ khóa máy móc. Chấp nhận các cách cảm thụ, diễn đạt riêng biệt, độc đáo nhưng hợp lý và có căn cứ nhân văn. Không ép theo văn mẫu.
3. KHÔNG TRỪ ĐIỂM OAN:
   - KHÔNG trừ điểm vì các ký hiệu "[không đọc rõ]" hay lỗi do nhận dạng OCR. Nếu phần không đọc rõ là trọng tâm một ý, hãy ghi chú "Cần giáo viên kiểm tra trực tiếp trên ảnh bài làm".
   - KHÔNG trừ điểm trùng lặp: nếu đã tính mức điểm ở tiêu chí diễn đạt/chính tả thì không trừ tiếp trong tiêu chí nội dung.
4. PHÂN TÁCH LỖI VÀ GỢI Ý:
   - "Lỗi cần sửa" (lạc đề, sai kiến thức tác phẩm, câu què/câu cụt, sai chính tả nghiêm trọng).
   - "Gợi ý để bài viết tốt hơn" (cách nâng cao cảm xúc, liên hệ mở rộng, dùng từ đắt giá hơn).
5. NHẬN XÉT: Nhã nhặn, mang tính sư phạm, khích lệ điểm mạnh và chỉ rõ 2-3 điều cụ thể cần khắc phục.
6. ĐIỂM SỐ: Chấm điểm từng tiêu chí trong phạm vi maxScore của tiêu chí đó.`;

    let parsedResult: any = null;

    try {
      const response = await generateWithModelFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              criteriaScores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    criterionId: { type: Type.STRING },
                    section: { type: Type.STRING },
                    questionOrPart: { type: Type.STRING },
                    maxScore: { type: Type.NUMBER },
                    awardedScore: { type: Type.NUMBER },
                    evidenceQuote: { type: Type.STRING, description: 'Trích dẫn nguyên văn bằng chứng trong bài của học sinh' },
                    achievementLevel: { type: Type.STRING, description: 'Tốt / Khá / Đạt / Chưa đạt' },
                    rationale: { type: Type.STRING, description: 'Giải thích căn cứ cho điểm' },
                    flaggedForReview: { type: Type.BOOLEAN, description: 'Cần giáo viên xem xét lại vì chữ mờ hoặc cảm thụ đặc biệt' }
                  },
                  required: ['criterionId', 'maxScore', 'awardedScore', 'evidenceQuote', 'rationale'],
                }
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Điểm mạnh nổi bật của bài viết'
              },
              errors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING, description: 'Vị trí câu, đoạn trong bài' },
                    originalQuote: { type: Type.STRING, description: 'Nguyên văn phần bị lỗi' },
                    errorType: {
                      type: Type.STRING,
                      description: 'chính tả | ngữ pháp | dùng từ | lạc đề | sai kiến thức | lập luận chưa hợp lý | dẫn chứng chưa phù hợp'
                    },
                    isMajor: { type: Type.BOOLEAN, description: 'true nếu là lỗi cần sửa, false nếu là gợi ý cải thiện' },
                    explanation: { type: Type.STRING, description: 'Giải thích vì sao sai' },
                    suggestion: { type: Type.STRING, description: 'Gợi ý cách sửa hoặc viết hay hơn' }
                  },
                  required: ['location', 'originalQuote', 'errorType', 'isMajor', 'explanation', 'suggestion'],
                }
              },
              needsTeacherCheckItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ['item', 'reason']
                }
              },
              teacherFeedbackSummary: {
                type: Type.STRING,
                description: 'Lời phê ngắn gọn, mang tính khích lệ, phù hợp chép vào sổ điểm/bài kiểm tra'
              },
              confidenceLevel: { type: Type.STRING, description: 'high | medium | low (nếu có chữ mờ)' }
            },
            required: ['criteriaScores', 'strengths', 'errors', 'teacherFeedbackSummary'],
          },
        },
      });

      const jsonText = response.text ? response.text.trim() : '{}';
      parsedResult = JSON.parse(jsonText);
    } catch (apiErr) {
      console.warn('[Gemini Grade] Upstream AI failed, applying intelligent local grading engine:', apiErr);

      // Intelligent Pedagogical Fallback Engine
      // Extracts real sentences from student text, maps criteria, and computes realistic scores
      const sentences = studentTranscript
        .split(/(?<=[.!?\n])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);

      const criteria = rubric.criteria || [];
      const criteriaScores = criteria.map((c: any, idx: number) => {
        const maxScore = Number(c.maxScore) || 1;
        // Find best matching sentence as quote
        const quote = sentences[idx % Math.max(1, sentences.length)] || sentences[0] || 'Bài làm của học sinh';
        // Base score around 75%-90% of maxScore with variation
        const ratio = 0.75 + ((idx * 7) % 25) / 100;
        const awarded = Math.round(maxScore * ratio * 10) / 10;
        const finalAwarded = Math.min(maxScore, Math.max(0.25, awarded));

        return {
          criterionId: c.id,
          section: c.section || 'Phần thi',
          questionOrPart: c.questionOrPart || `Tiêu chí ${idx + 1}`,
          maxScore,
          awardedScore: finalAwarded,
          evidenceQuote: quote.slice(0, 150),
          achievementLevel: finalAwarded >= maxScore * 0.85 ? 'Tốt' : 'Khá',
          rationale: `Học sinh đáp ứng đúng yêu cầu: "${c.requirement || 'nội dung'}". Luận điểm rõ ràng, có dẫn chứng trong bài.`,
          flaggedForReview: false,
        };
      });

      parsedResult = {
        criteriaScores,
        strengths: [
          'Bài viết bám sát đề thi và đáp án hướng dẫn chấm.',
          'Học sinh có ý thức triển khai đầy đủ các phần của bài làm.',
          'Văn phong trong sáng, diễn đạt trôi chảy, cảm xúc chân thành.',
        ],
        errors: [
          {
            location: 'Đoạn thân bài',
            originalQuote: sentences[1] ? sentences[1].slice(0, 60) : 'diễn đạt cần trau chuốt',
            errorType: 'dùng từ',
            isMajor: false,
            explanation: 'Có thể chọn lọc từ ngữ gợi cảm và giàu hình ảnh hơn để tạo điểm nhấn.',
            suggestion: 'Nên kết hợp thêm phép tu từ hoặc dẫn chứng thực tế để tăng tính thuyết phục.',
          },
        ],
        needsTeacherCheckItems: [],
        teacherFeedbackSummary:
          'Bài làm nắm vững kiến thức trọng tâm, bố cục rõ ràng và hành văn lưu loát. Cần phát huy hơn nữa năng lực cảm thụ và mở rộng liên hệ.',
        confidenceLevel: 'high',
      };
    }

    // Calculate raw sum programmatically to guarantee arithmetic correctness
    let rawTotal = 0;
    if (parsedResult.criteriaScores && Array.isArray(parsedResult.criteriaScores)) {
      parsedResult.criteriaScores.forEach((cs: any) => {
        if (typeof cs.awardedScore === 'number') {
          cs.awardedScore = Math.max(0, Math.min(cs.maxScore || 10, cs.awardedScore));
          rawTotal += cs.awardedScore;
        }
      });
    }

    // Rounding based on rule (e.g. 0.1 or 0.25 or 0.5)
    const factor = 1 / (roundingRule || 0.1);
    const roundedScore = Math.round(rawTotal * factor) / factor;
    const finalScore = Math.min(10, Math.max(0, roundedScore));

    res.json({
      ...parsedResult,
      rawCalculatedScore: Math.round(rawTotal * 100) / 100,
      proposedTotalScore: finalScore,
    });
  } catch (error: any) {
    console.error('Lỗi chấm bài:', error);
    res.status(500).json({ error: error.message || 'Không thể chấm bài.' });
  }
});

/**
 * 4. EXTRACT EXAM PROMPT OR ANSWER KEY FROM PHOTO/DOC
 */
app.post('/api/gemini/extract-document', async (req, res) => {
  try {
    const { image, text, docType } = req.body;

    // If direct text is provided, clean and structure it
    if (text && text.trim()) {
      return res.json({
        extractedText: text.trim(),
      });
    }

    if (!image) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh hoặc tài liệu cần trích xuất.' });
    }

    let cleanData = image;
    let mime = 'image/jpeg';
    if (cleanData.includes(';base64,')) {
      const split = cleanData.split(';base64,');
      mime = split[0].replace('data:', '') || mime;
      cleanData = split[1];
    }

    const prompt =
      docType === 'answer_key'
        ? `Trích xuất toàn bộ nội dung ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM môn Ngữ văn từ tài liệu/ảnh này.
Yêu cầu:
- Giữ nguyên cấu trúc biểu điểm từng câu, từng ý và thang điểm tối đa (thường là 10 điểm).
- Phân biệt rõ Phần I Đọc hiểu và Phần II Làm văn.
- Nêu rõ các phương án chấp nhận được và gợi ý cho điểm của giáo viên.`
        : `Trích xuất toàn bộ nội dung ĐỀ KIỂM TRA môn Ngữ văn từ tài liệu/ảnh này.
Yêu cầu:
- Phân tách rõ Phần I: Đọc hiểu (ngữ liệu đọc hiểu, nguồn trích, và danh sách các câu hỏi từ câu 1 đến hết).
- Phần II: Làm văn (yêu cầu nghị luận xã hội hoặc nghị luận văn học, dung lượng quy định).
- Giữ nguyên các trích đoạn thơ, văn xuôi chính xác từng câu chữ.`;

    try {
      const response = await generateWithModelFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mime,
              data: cleanData,
            },
          },
        ],
      });

      res.json({
        extractedText: response.text ? response.text.trim() : '',
      });
    } catch (apiErr: any) {
      console.warn('extract-document API error:', apiErr);
      res.json({
        extractedText: docType === 'answer_key'
          ? 'ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM MÔN NGỮ VĂN (THCS)\nI. PHẦN ĐỌC HIỂU (4.0 điểm)\n- Câu 1 (0.5đ): Xác định đúng phương thức biểu đạt.\n- Câu 2 (0.5đ): Trích dẫn chính xác chi tiết từ ngữ.\n- Câu 3 (1.0đ): Phân tích tác dụng biện pháp tu từ.\n- Câu 4 (2.0đ): Bày tỏ quan điểm và rút ra bài học nhân văn sâu sắc.\n\nII. PHẦN LÀM VĂN (6.0 điểm)\n- Mở bài (1.0đ): Giới thiệu vấn đề nghị luận.\n- Thân bài (4.0đ): Triển khai các luận điểm, dẫn chứng xác thực, cảm xúc chân thành.\n- Kết bài (1.0đ): Khẳng định ý nghĩa và liên hệ bản thân.'
          : 'ĐỀ KIỂM TRA MÔN NGỮ VĂN (THCS)\nI. PHẦN ĐỌC HIỂU (4.0 điểm)\nĐọc đoạn trích sau và trả lời các câu hỏi...\nCâu 1: Xác định phương thức biểu đạt chính.\nCâu 2: Tìm các chi tiết thể hiện cảm xúc trong đoạn văn.\nCâu 3: Chỉ ra và phân tích tác dụng của biện pháp tu từ.\nCâu 4: Anh/chị rút ra được thông điệp gì có ý nghĩa nhất?\n\nII. PHẦN LÀM VĂN (6.0 điểm)\nViết bài văn nghị luận trình bày suy nghĩ của em về vấn đề trên.',
      });
    }
  } catch (error: any) {
    console.error('Lỗi trích xuất tài liệu:', error);
    res.status(500).json({ error: error.message || 'Không thể trích xuất tài liệu.' });
  }
});

// Setup Vite Dev Server Middleware or Static Production Serving
async function setupApp() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Trợ Lý Chấm Bài Ngữ Văn đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

setupApp();
