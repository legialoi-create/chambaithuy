import { ExamSession, StudentSubmission } from '../types';

/**
 * Creates a handwritten page simulation on SVG/canvas data URL
 * with authentic Vietnamese handwriting look, ruled exam paper background,
 * margins, student info header, strikethroughs and margin notes.
 */
export function generateHandwrittenPageImage(
  studentName: string,
  className: string,
  pageNumber: number,
  totalPages: number,
  contentLines: string[],
  strikethroughIdx = -1,
  insertedWord = ''
): string {
  const width = 800;
  const height = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background: Light cream exam paper
  ctx.fillStyle = '#fbfbf7';
  ctx.fillRect(0, 0, width, height);

  // Red margin line (standard Vietnamese school exam paper)
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(130, 40);
  ctx.lineTo(130, height - 40);
  ctx.stroke();

  // Horizontal blue ruling lines
  ctx.strokeStyle = '#dbeafe';
  ctx.lineWidth = 1;
  const lineGap = 32;
  const startY = 160;
  for (let y = startY; y < height - 50; y += lineGap) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 40, y);
    ctx.stroke();
  }

  // Header Box (Only on page 1)
  if (pageNumber === 1) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(50, 45, 700, 100);
    ctx.beginPath();
    ctx.moveTo(480, 45);
    ctx.lineTo(480, 145);
    ctx.stroke();

    ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('TRƯỜNG THCS NGUYỄN DU - BẬC THCS', 65, 70);
    ctx.font = '13px "Be Vietnam Pro", sans-serif';
    ctx.fillText(`Họ và tên: ${studentName}`, 65, 98);
    ctx.fillText(`Lớp: ${className}        SBD: 802${pageNumber * 5}`, 65, 126);

    ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif';
    ctx.fillText('ĐIỂM VÀ LỜI PHÊ GIÁO VIÊN THCS', 500, 70);
  }

  // Student Handwritten Text
  // Using an authentic cursive / handwriting style
  ctx.font = 'italic 18px "Caveat", "Brush Script MT", "Be Vietnam Pro", cursive';
  ctx.fillStyle = '#1e3a8a'; // Blue ballpoint pen ink
  let currentY = pageNumber === 1 ? 190 : 80;

  contentLines.forEach((line, index) => {
    if (currentY > height - 60) return;

    // Small jitter to simulate natural handwriting
    const jitterX = 145 + Math.sin(index * 1.7) * 3;
    const jitterY = currentY + Math.cos(index * 2.1) * 2;

    ctx.fillText(line, jitterX, jitterY);

    // Strikethrough effect on specified line
    if (index === strikethroughIdx) {
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const textWidth = ctx.measureText(line).width;
      ctx.moveTo(jitterX - 4, jitterY - 5);
      ctx.lineTo(jitterX + textWidth + 4, jitterY - 4);
      ctx.stroke();
    }

    // Inserted word effect
    if (insertedWord && index === 2) {
      ctx.font = 'italic 14px cursive';
      ctx.fillText(`^ [${insertedWord}]`, jitterX + 160, jitterY - 14);
      ctx.font = 'italic 18px cursive';
    }

    currentY += lineGap;
  });

  // Footer: Page indicator
  ctx.font = '12px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`Trang ${pageNumber}/${totalPages}`, width / 2 - 30, height - 20);

  return canvas.toDataURL('image/jpeg', 0.9);
}

export function getSampleExamSession(): { session: ExamSession; submissions: StudentSubmission[] } {
  const sessionId = 'session-thcs-lop8-gdpt2018';

  const session: ExamSession = {
    id: sessionId,
    title: 'Kiểm tra Đánh giá Định kỳ Ngữ văn THCS (Lớp 8)',
    school: 'THCS Nguyễn Du',
    gradeLevel: 'Lớp 8 (THCS)',
    className: '8A2',
    durationMinutes: 90,
    examPrompt: `I. PHẦN ĐỌC HIỂU (4,0 điểm)
Đọc đoạn trích sau trong truyện ngắn "Gió lạnh đầu mùa" (nhà văn Thạch Lam) và thực hiện các yêu cầu:
"Sơn thấy chị Lan giương mắt nhìn đứa bé ấy. Thấy chị gọi, đứa bé liền lén lại gần. Nó là cái Duyên, con chị Tí bán củi ở xóm chợ... Sơn thấy mẹ cái Duyên nghèo quá, chỉ mặc cho con manh áo rách tả tơi, hở cả lưng và tay. Gió bấc thổi làm da thịt nó thâm tím lại. Sơn chợt nhớ đến em Duyên của mình ngày trước... Một ý nghĩ tốt đẹp thoáng qua trong đầu, Sơn liền bàn với chị: 'Hay là chúng mình mang cho nó chiếc áo bông cũ của em Duyên đi'. Chị Lan hớn hở bằng lòng ngay..."

Câu 1 (0,5 điểm): Xác định ngôi kể và phương thức biểu đạt chính của đoạn trích.
Câu 2 (0,5 điểm): Hoàn cảnh gia đình và vẻ ngoài của bé Duyên được miêu tả qua những chi tiết nào?
Câu 3 (1,5 điểm): Em hãy chỉ ra tác dụng của hành động Sơn và chị Lan quyết định đem tặng chiếc áo bông cũ cho cái Duyên.
Câu 4 (1,5 điểm): Đoạn trích gửi gắm đến học sinh bài học gì về tình thương yêu, sự đồng cảm và sẻ chia trong cuộc sống?

II. PHẦN VIẾT (6,0 điểm)
Đề bài: Viết một bài văn ngắn (khoảng 1 - 1,5 trang) kể lại một việc tốt em đã làm (hoặc chứng kiến) thể hiện lòng nhân ái, tình cảm sẻ chia với những người có hoàn cảnh khó khăn xung quanh em.`,
    answerKeyText: `I. ĐỌC HIỂU (4,0 điểm)
- Câu 1 (0,5đ): Ngôi kể: Ngôi thứ ba. Phương thức biểu đạt chính: Tự sự (kết hợp miêu tả, biểu cảm).
- Câu 2 (0,5đ): Con chị Tí bán củi nghèo khó, manh áo rách tả tơi hở lưng và tay, da thịt thâm tím vì rét.
- Câu 3 (1,5đ): Thể hiện tâm hồn trong sáng, giàu lòng trắc ẩn của hai đứa trẻ; mang lại hơi ấm cho bạn nghèo; lan tỏa vẻ đẹp nhân ái giữa người với người.
- Câu 4 (1,5đ): Bài học về sự thấu hiểu, không phân biệt giàu nghèo; biết yêu thương và sẻ chia bằng hành động cụ thể từ những điều giản dị.

II. VIẾT (6,0 điểm)
- Đảm bảo cấu trúc bài văn tự sự THCS: Mở bài, Thân bài, Kết bài (0,5đ).
- Xác định đúng việc tốt thể hiện tình nhân ái (0,5đ).
- Kể diễn biến sự việc mạch lạc, kết hợp miêu tả và biểu cảm chân thực (3,5đ).
- Bài học rút ra sâu sắc, phù hợp lứa tuổi học sinh THCS (0,5đ).
- Chính tả, ngữ pháp, diễn đạt trong sáng, sáng tạo (1,0đ).`,
    hasOfficialAnswerKey: true,
    studentRoster: ['Nguyễn Mai Phương', 'Lê Quang Huy', 'Trần Thu Trang', 'Đỗ Minh Đức'],
    maxScore: 10,
    roundingRule: 0.1,
    createdAt: '2026-09-25T08:00:00.000Z',
    updatedAt: '2026-09-25T08:00:00.000Z',
    rubric: {
      title: 'Hướng dẫn chấm Kiểm tra Đánh giá Định kỳ Ngữ văn THCS (Lớp 8)',
      sourceType: 'teacher_provided',
      version: 1,
      totalMaxScore: 10,
      criteria: [
        {
          id: 'thcs_dh_c1',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 1 (Ngôi kể & PTBĐ)',
          requirement: 'Xác định đúng ngôi kể thứ ba và phương thức tự sự',
          maxScore: 0.5,
          acceptableAnswers: ['Ngôi thứ ba', 'Phương thức tự sự', 'Tự sự kết hợp miêu tả biểu cảm'],
          scoringGuide: 'Nêu đúng ngôi kể thứ ba (0.25đ), phương thức tự sự (0.25đ)',
        },
        {
          id: 'thcs_dh_c2',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 2 (Chi tiết bé Duyên)',
          requirement: 'Chỉ ra hoàn cảnh nghèo khó và manh áo rách tả tơi của bé Duyên',
          maxScore: 0.5,
          acceptableAnswers: ['Con chị Tí bán củi', 'Manh áo rách tả tơi', 'Da thịt thâm tím vì rét bấc'],
          scoringGuide: 'Nêu đủ 2 chi tiết về trang phục và hoàn cảnh',
        },
        {
          id: 'thcs_dh_c3',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 3 (Hành động tặng áo)',
          requirement: 'Nêu ý nghĩa, tác dụng của việc hai chị em đem cho áo bông cũ',
          maxScore: 1.5,
          acceptableAnswers: [
            'Thể hiện tấm lòng nhân ái, sự sẻ chia hồn nhiên',
            'Đem lại hơi ấm cho đứa trẻ nghèo trong ngày đông',
            'Làm ấm áp tình người, thể hiện bài học sẻ chia',
          ],
          scoringGuide: 'Phân tích được ý nghĩa tâm hồn trẻ thơ và giá trị tình người',
        },
        {
          id: 'thcs_dh_c4',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 4 (Thông điệp bài học)',
          requirement: 'Rút ra bài học nhân văn phù hợp lứa tuổi học sinh THCS',
          maxScore: 1.5,
          acceptableAnswers: [
            'Biết quan tâm, giúp đỡ người có hoàn cảnh khó khăn',
            'Sống không vô cảm, sẻ chia chân thành từ những việc làm nhỏ',
          ],
          scoringGuide: 'Nêu thông điệp rõ ràng (0.5đ), liên hệ bản thân chân thành (1.0đ)',
        },
        {
          id: 'thcs_viet_c1',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Bố cục & Vấn đề)',
          requirement: 'Đúng cấu trúc bài văn tự sự (Mở - Thân - Kết), đúng chủ đề việc tốt',
          maxScore: 1.0,
          acceptableAnswers: ['Đầy đủ 3 phần, giới thiệu được việc làm nhân ái'],
          scoringGuide: 'Bố cục rõ ràng (0.5đ), xác định đúng việc làm nhân ái (0.5đ)',
        },
        {
          id: 'thcs_viet_c2',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Nội dung & Cảm xúc)',
          requirement: 'Kể diễn biến việc tốt mạch lạc, kết hợp miêu tả và biểu cảm chân thực',
          maxScore: 3.5,
          acceptableAnswers: [
            'Kể rõ hoàn cảnh, nhân vật, diễn biến và kết quả của việc tốt',
            'Cảm xúc chân thành của lứa tuổi học sinh THCS',
            'Thể hiện được tấm lòng giúp đỡ bạn bè hoặc người khó khăn',
          ],
          scoringGuide: 'Diễn biến mạch lạc (2.0đ), miêu tả và biểu cảm tinh tế (1.5đ)',
        },
        {
          id: 'thcs_viet_c3',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kỹ năng tiếng Việt & Sáng tạo',
          requirement: 'Chính tả, ngữ pháp tiếng Việt, dùng từ trong sáng, có liên hệ sâu sắc',
          maxScore: 1.5,
          acceptableAnswers: ['Diễn đạt trôi chảy, giàu cảm xúc, không mắc lỗi câu'],
          scoringGuide: 'Đúng chính tả ngữ pháp (1.0đ), có ý tưởng sáng tạo (0.5đ)',
        },
      ],
    },
  };

  // Sample Submission 1: Nguyễn Mai Phương (Lớp 8A2) - Chữ đẹp, điểm tốt 8.5
  const sub1Page1Text = `I. PHẦN ĐỌC HIỂU
Câu 1: Đoạn trích được kể theo ngôi thứ ba. Phương thức biểu đạt chính là tự sự.
Câu 2: Hoàn cảnh và vẻ ngoài của bé Duyên được miêu tả qua các chi tiết:
- Hoàn cảnh: Là con chị Tí bán củi ở xóm chợ nghèo.
- Vẻ ngoài: Mặc manh áo rách tả tơi, hở cả lưng và tay, da thịt thâm tím lại vì gió bấc lạnh buốt.
Câu 3: Hành động Sơn và chị Lan quyết định tặng chiếc áo bông cũ cho cái Duyên có ý nghĩa:
- Thể hiện trái tim giàu tình thương, sự nhạy cảm và lòng trắc ẩn của hai đứa trẻ trước nỗi khổ của bạn bè.
- Không chỉ mang lại chiếc áo ấm che gió rét, hành động ấy còn sưởi ấm tình người giữa mùa đông giá lạnh.
Câu 4: Đoạn trích gửi gắm đến lứa tuổi học sinh chúng em bài học sâu sắc: Hãy luôn biết đồng cảm, yêu thương và sẻ chia với những mảnh đời bất hạnh xung quanh. Giúp đỡ người khác bằng tấm lòng chân thành không cần đền đáp.`;

  const sub1Page2Text = `II. PHẦN VIẾT
Một việc tốt em đã làm thể hiện lòng nhân ái:
Mỗi khi mùa đông về, nhìn thấy những bạn nhỏ bán vé số co ro trong manh áo mỏng, em lại nhớ lời cô giáo dạy về lòng nhân ái. Vào dịp Tết vừa qua, em đã dùng toàn bộ số tiền nuôi heo đất của mình cùng mẹ mua 10 chiếc áo ấm và găng tay để tặng các bạn nhỏ tại mái ấm tình thương phường em. Khi trao tận tay chiếc áo ấm mới tinh cho một bạn nhỏ trạc tuổi mình, bạn đã nở nụ cười rạng rỡ và nói lời cảm ơn. Nụ cười ấy làm em thấy lòng mình vô cùng ấm áp. Em nhận ra rằng hạnh phúc chính là khi chúng ta biết trao đi yêu thương.`;

  const sub1Page1Lines = sub1Page1Text.split('\n');
  const sub1Page2Lines = sub1Page2Text.split('\n');

  const sub1: StudentSubmission = {
    id: 'sub-001',
    sessionId,
    anonymousCode: 'NV-001',
    studentName: 'Nguyễn Mai Phương',
    className: '8A2',
    schoolOrCode: 'SBD: 80215',
    pages: [
      {
        id: 'p1-sub1',
        pageNumber: 1,
        imageData: generateHandwrittenPageImage('Nguyễn Mai Phương', '8A2', 1, 2, sub1Page1Lines),
        rotation: 0,
        flippedH: false,
        brightness: 0,
        contrast: 0,
        pageStatus: 'clear',
        pageText: sub1Page1Text,
      },
      {
        id: 'p2-sub1',
        pageNumber: 2,
        imageData: generateHandwrittenPageImage('Nguyễn Mai Phương', '8A2', 2, 2, sub1Page2Lines),
        rotation: 0,
        flippedH: false,
        brightness: 0,
        contrast: 0,
        pageStatus: 'clear',
        pageText: sub1Page2Text,
      },
    ],
    status: 'approved',
    originalTranscription: `${sub1Page1Text}\n\n${sub1Page2Text}`,
    editedTranscription: `${sub1Page1Text}\n\n${sub1Page2Text}`,
    transcriptConfirmed: true,
    transcriptAuditLog: [
      { timestamp: '2026-09-25T08:15:00.000Z', note: 'Nhận dạng OCR bài thi THCS hoàn tất' },
      { timestamp: '2026-09-25T08:20:00.000Z', note: 'Giáo viên xác nhận bản chép chuẩn xác' },
    ],
    gradingResult: {
      criteriaScores: [
        {
          criterionId: 'thcs_dh_c1',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 1 (Ngôi kể & PTBĐ)',
          maxScore: 0.5,
          awardedScore: 0.5,
          evidenceQuote: 'ngôi thứ ba. Phương thức biểu đạt chính là tự sự',
          achievementLevel: 'Tốt',
          rationale: 'Xác định đúng ngôi kể và phương thức biểu đạt.',
        },
        {
          criterionId: 'thcs_dh_c2',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 2 (Chi tiết bé Duyên)',
          maxScore: 0.5,
          awardedScore: 0.5,
          evidenceQuote: 'con chị Tí bán củi ở xóm chợ nghèo... manh áo rách tả tơi, hở cả lưng và tay, da thịt thâm tím',
          achievementLevel: 'Tốt',
          rationale: 'Trích xuất chi tiết chính xác theo đề bài.',
        },
        {
          criterionId: 'thcs_dh_c3',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 3 (Hành động tặng áo)',
          maxScore: 1.5,
          awardedScore: 1.5,
          evidenceQuote: 'Thể hiện trái tim giàu tình thương, sự nhạy cảm và lòng trắc ẩn của hai đứa trẻ... sưởi ấm tình người',
          achievementLevel: 'Tốt',
          rationale: 'Phân tích trọn vẹn cả vẻ đẹp tâm hồn trẻ thơ và ý nghĩa sưởi ấm tình người.',
        },
        {
          criterionId: 'thcs_dh_c4',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 4 (Thông điệp bài học)',
          maxScore: 1.5,
          awardedScore: 1.4,
          evidenceQuote: 'Hãy luôn biết đồng cảm, yêu thương và sẻ chia với những mảnh đời bất hạnh xung quanh',
          achievementLevel: 'Tốt',
          rationale: 'Rút ra bài học nhân ái trong sáng, sâu sắc phù hợp lứa tuổi THCS.',
        },
        {
          criterionId: 'thcs_viet_c1',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Bố cục & Vấn đề)',
          maxScore: 1.0,
          awardedScore: 1.0,
          evidenceQuote: 'Đầy đủ Mở - Thân - Kết, giới thiệu việc nuôi heo đất mua áo ấm tặng bạn nghèo',
          achievementLevel: 'Tốt',
          rationale: 'Bố cục bài văn mạch lạc, đúng yêu cầu kiểu bài tự sự THCS.',
        },
        {
          criterionId: 'thcs_viet_c2',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Nội dung & Cảm xúc)',
          maxScore: 3.5,
          awardedScore: 3.2,
          evidenceQuote: 'dùng toàn bộ số tiền nuôi heo đất... mua 10 chiếc áo ấm và găng tay... Nụ cười ấy làm em thấy lòng mình vô cùng ấm áp',
          achievementLevel: 'Tốt',
          rationale: 'Kể chân thực, cảm xúc trong sáng và tự nhiên của học sinh lớp 8.',
        },
        {
          criterionId: 'thcs_viet_c3',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kỹ năng tiếng Việt & Sáng tạo',
          maxScore: 1.5,
          awardedScore: 1.4,
          evidenceQuote: 'hạnh phúc chính là khi chúng ta biết trao đi yêu thương',
          achievementLevel: 'Tốt',
          rationale: 'Chữ viết đẹp, không mắc lỗi chính tả, câu văn giàu cảm xúc.',
        },
      ],
      strengths: [
        'Nắm rất vững kỹ năng đọc hiểu văn bản truyện ngắn THCS.',
        'Bài văn kể việc tốt chân thực, giàu cảm xúc trong sáng của lứa tuổi thiếu niên.',
        'Chữ viết rõ nét, không sai lỗi chính tả hay dùng từ.',
      ],
      errors: [],
      teacherFeedbackSummary: 'Bài làm rất tốt, cảm xúc chân thành, chữ viết đẹp, đáng khen ngợi!',
      rawCalculatedScore: 9.5,
      proposedTotalScore: 9.5,
      confidenceLevel: 'high',
      rubricVersionUsed: 1,
    },
    teacherApprovedScore: 9.5,
    teacherNotes: 'Bài làm xuất sắc, biểu cảm tự nhiên, khuyến khích phát huy.',
    approvedAt: '2026-09-25T09:00:00.000Z',
  };

  // Sample Submission 2: Lê Quang Huy (Lớp 8A2) - Cần giáo viên kiểm tra, có gạch xóa, chữ mờ
  const sub2Page1Text = `I. PHẦN ĐỌC HIỂU
Câu 1: Đoạn trích kể theo [gạch bỏ: ngôi thứ nhất] ngôi thứ ba.
Câu 2: Bé Duyên là con chị Tí bán củi, mặc áo rách thâm tím da thịt.
Câu 3: Việc cho áo thể hiện [không đọc rõ] tốt bụng của Sơn và chị Lan muốn giúp bạn không bị rét.
Câu 4: Bài học là phải biết chia sẻ cho người nghèo.`;

  const sub2Page2Text = `II. PHẦN VIẾT
Một lần em cùng bạn đi học về thì thấy một chú mèo con bị [không đọc rõ] ướt sũng dưới mưa. Em và bạn đã lấy khăn lau khô và mang về nhà cho ăn... Việc làm này giúp em hiểu thêm về tình yêu thương muôn loài.`;

  const sub2Page1Lines = sub2Page1Text.split('\n');
  const sub2Page2Lines = sub2Page2Text.split('\n');

  const sub2: StudentSubmission = {
    id: 'sub-002',
    sessionId,
    anonymousCode: 'NV-002',
    studentName: 'Lê Quang Huy',
    className: '8A2',
    schoolOrCode: 'SBD: 80216',
    pages: [
      {
        id: 'p1-sub2',
        pageNumber: 1,
        imageData: generateHandwrittenPageImage('Lê Quang Huy', '8A2', 1, 2, sub2Page1Lines, 1, 'ngôi thứ ba'),
        rotation: 0,
        flippedH: false,
        brightness: 0,
        contrast: 0,
        pageStatus: 'needs_check',
        pageText: sub2Page1Text,
        uncertainSegments: [
          {
            originalSnippet: 'thể hiện [không đọc rõ] tốt bụng',
            suggestedReadings: ['tấm lòng', 'sự', 'tình cảm'],
            reason: 'Nét bút bi nhòe mực',
          },
        ],
      },
      {
        id: 'p2-sub2',
        pageNumber: 2,
        imageData: generateHandwrittenPageImage('Lê Quang Huy', '8A2', 2, 2, sub2Page2Lines, -1, ''),
        rotation: 0,
        flippedH: false,
        brightness: 0,
        contrast: 0,
        pageStatus: 'needs_check',
        pageText: sub2Page2Text,
        uncertainSegments: [
          {
            originalSnippet: 'mèo con bị [không đọc rõ] ướt sũng',
            suggestedReadings: ['bỏ rơi', 'lạc', 'ngã'],
            reason: 'Chữ viết ngoáy vội',
          },
        ],
      },
    ],
    status: 'needs_teacher_review',
    originalTranscription: `${sub2Page1Text}\n\n${sub2Page2Text}`,
    editedTranscription: `${sub2Page1Text}\n\n${sub2Page2Text}`,
    transcriptConfirmed: false,
    transcriptAuditLog: [
      { timestamp: '2026-09-25T08:18:00.000Z', note: 'Phát hiện 2 vị trí chữ viết khó đọc [không đọc rõ]' },
    ],
    gradingResult: {
      criteriaScores: [
        {
          criterionId: 'thcs_dh_c1',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 1 (Ngôi kể & PTBĐ)',
          maxScore: 0.5,
          awardedScore: 0.5,
          evidenceQuote: 'kể theo [gạch bỏ: ngôi thứ nhất] ngôi thứ ba',
          achievementLevel: 'Đạt',
          rationale: 'Học sinh gạch bỏ từ sai và sửa lại đúng ngôi thứ ba.',
        },
        {
          criterionId: 'thcs_dh_c2',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 2 (Chi tiết bé Duyên)',
          maxScore: 0.5,
          awardedScore: 0.5,
          evidenceQuote: 'Bé Duyên là con chị Tí bán củi, mặc áo rách thâm tím da thịt',
          achievementLevel: 'Đạt',
          rationale: 'Nêu đủ các chi tiết chính.',
        },
        {
          criterionId: 'thcs_dh_c3',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 3 (Hành động tặng áo)',
          maxScore: 1.5,
          awardedScore: 1.0,
          evidenceQuote: 'thể hiện [không đọc rõ] tốt bụng của Sơn và chị Lan',
          achievementLevel: 'Chưa đạt tối đa',
          rationale: 'Có vị trí [không đọc rõ], diễn đạt còn ngắn gọn.',
          flaggedForReview: true,
        },
        {
          criterionId: 'thcs_dh_c4',
          section: 'Phần I: Đọc hiểu (THCS)',
          questionOrPart: 'Câu 4 (Thông điệp bài học)',
          maxScore: 1.5,
          awardedScore: 1.0,
          evidenceQuote: 'Bài học là phải biết chia sẻ cho người nghèo',
          achievementLevel: 'Đạt',
          rationale: 'Nêu được ý chính nhưng chưa diễn giải thấu đáo.',
        },
        {
          criterionId: 'thcs_viet_c1',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Bố cục & Vấn đề)',
          maxScore: 1.0,
          awardedScore: 0.7,
          evidenceQuote: 'Kể việc giúp mèo con bị mưa ướt',
          achievementLevel: 'Đạt',
          rationale: 'Bài viết còn hơi ngắn so với dung lượng yêu cầu của bài văn.',
        },
        {
          criterionId: 'thcs_viet_c2',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kể việc tốt (Nội dung & Cảm xúc)',
          maxScore: 3.5,
          awardedScore: 2.2,
          evidenceQuote: 'Em và bạn đã lấy khăn lau khô và mang về nhà cho ăn...',
          achievementLevel: 'Đạt',
          rationale: 'Nội dung kể được việc cứu mèo con nhưng chưa triển khai kỹ các chi tiết biểu cảm.',
          flaggedForReview: true,
        },
        {
          criterionId: 'thcs_viet_c3',
          section: 'Phần II: Viết bài văn THCS',
          questionOrPart: 'Kỹ năng tiếng Việt & Sáng tạo',
          maxScore: 1.5,
          awardedScore: 1.0,
          evidenceQuote: 'Còn viết ngoáy một số chữ',
          achievementLevel: 'Đạt',
          rationale: 'Cần rèn luyện chữ viết cẩn thận hơn.',
        },
      ],
      strengths: ['Hiểu đề đọc hiểu, có tấm lòng nhân hậu yêu quý loài vật.'],
      errors: [
        {
          location: 'Phần I - Câu 3',
          originalQuote: 'thể hiện [không đọc rõ] tốt bụng',
          errorType: 'chính tả',
          isMajor: false,
          explanation: 'Nét chữ nhòe mực, giáo viên nên xem trực tiếp trên ảnh bài làm.',
          suggestion: 'Đối chiếu ảnh gốc trang 1 để chốt chữ.',
        },
      ],
      needsTeacherCheckItems: [
        { item: 'Trang 1, Câu 3', reason: 'Vùng chữ nhòe: "thể hiện [không đọc rõ] tốt bụng"' },
        { item: 'Trang 2, Bài viết', reason: 'Chữ viết vội: "mèo con bị [không đọc rõ] ướt sũng"' },
      ],
      teacherFeedbackSummary: 'Em hiểu bài nhưng cần viết cẩn thận hơn, bài làm văn nên miêu tả chi tiết và biểu cảm sâu sắc hơn.',
      rawCalculatedScore: 6.9,
      proposedTotalScore: 6.9,
      confidenceLevel: 'medium',
      rubricVersionUsed: 1,
    },
  };

  return {
    session,
    submissions: [sub1, sub2],
  };
}
