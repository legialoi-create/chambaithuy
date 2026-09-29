import * as XLSX from 'xlsx';
import { ExamSession, StudentSubmission, STATUS_LABELS } from '../types';

/**
 * Export Gradebook to real Excel (.xlsx) file
 */
export function exportGradebookToExcel(session: ExamSession, submissions: StudentSubmission[]) {
  const rows = submissions.map((sub, index) => {
    // Break down scores
    let docHieuScore: number | string = '-';
    let lamVanScore: number | string = '-';

    if (sub.gradingResult?.criteriaScores) {
      let dh = 0;
      let lv = 0;
      sub.gradingResult.criteriaScores.forEach((c) => {
        if (c.section.toLowerCase().includes('đọc hiểu')) {
          dh += c.awardedScore;
        } else {
          lv += c.awardedScore;
        }
      });
      docHieuScore = Math.round(dh * 10) / 10;
      lamVanScore = Math.round(lv * 10) / 10;
    }

    const proposed = sub.gradingResult?.proposedTotalScore !== undefined
      ? sub.gradingResult.proposedTotalScore
      : '-';

    const approved = sub.teacherApprovedScore !== undefined
      ? sub.teacherApprovedScore
      : (sub.status === 'approved' ? proposed : 'Chưa duyệt');

    return {
      'STT': index + 1,
      'Mã bài': sub.anonymousCode,
      'Họ và tên học sinh': sub.studentName,
      'Lớp': sub.className || session.className,
      'Số trang bài làm': sub.pages.length,
      'Điểm Đọc hiểu': docHieuScore,
      'Điểm Làm văn': lamVanScore,
      'Điểm AI đề xuất': proposed,
      'Điểm GV đã duyệt': approved,
      'Trạng thái': STATUS_LABELS[sub.status]?.label || sub.status,
      'Lời phê giáo viên': sub.teacherNotes || sub.gradingResult?.teacherFeedbackSummary || '',
      'Ghi chú điều chỉnh': sub.teacherAdjustmentReason || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng điểm');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 25 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 40 },
    { wch: 25 },
  ];

  const fileName = `Bang_Diem_${session.title.replace(/[\s/]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export Individual Student Feedback Card as Word Document (.doc)
 * Uses standard MIME-compliant Word HTML with Times New Roman and Vietnamese typography.
 */
export function exportStudentReportToWord(session: ExamSession, sub: StudentSubmission) {
  const finalScore = sub.teacherApprovedScore !== undefined
    ? sub.teacherApprovedScore
    : (sub.gradingResult?.proposedTotalScore ?? 'Chưa chấm');

  const criteriaRows = (sub.gradingResult?.criteriaScores || [])
    .map(
      (c, idx) => `
    <tr>
      <td style="border: 1px solid #999; padding: 6px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #999; padding: 6px;"><b>${c.questionOrPart}</b> (${c.section})<br/>${c.requirement}</td>
      <td style="border: 1px solid #999; padding: 6px; font-style: italic; color: #1e3a8a;">${c.evidenceQuote || 'Không tìm thấy'}</td>
      <td style="border: 1px solid #999; padding: 6px; text-align: center;">${c.awardedScore} / ${c.maxScore}</td>
      <td style="border: 1px solid #999; padding: 6px;">${c.rationale}</td>
    </tr>
  `
    )
    .join('');

  const errorRows = (sub.gradingResult?.errors || [])
    .map(
      (e) => `
    <li style="margin-bottom: 6px;">
      <b>[${e.isMajor ? 'LỖI CẦN SỬA' : 'GỢI Ý CẢI THIỆN'}]</b> (${e.location}) <i>"${e.originalQuote}"</i>: ${e.explanation} 
      <br/><span style="color: #047857;">&rarr; Gợi ý sửa: ${e.suggestion}</span>
    </li>
  `
    )
    .join('');

  const strengthsList = (sub.gradingResult?.strengths || [])
    .map((s) => `<li>${s}</li>`)
    .join('');

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Phiếu Chấm Điểm - ${sub.studentName}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; color: #111; }
        h1, h2, h3 { color: #1e3a8a; }
        .header-table { width: 100%; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
        .score-box { background: #f8fafc; border: 2px solid #3b82f6; padding: 12px; border-radius: 6px; text-align: center; margin: 15px 0; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th { background-color: #f1f5f9; border: 1px solid #999; padding: 8px; font-weight: bold; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 60%;">
            <b>${session.school.toUpperCase()}</b><br/>
            Năm học 2025 - 2026<br/>
            Môn: <b>NGỮ VĂN</b>
          </td>
          <td style="text-align: right;">
            <b>PHIẾU ĐÁNH GIÁ KẾT QUẢ BÀI THI</b><br/>
            Đợt: ${session.title}<br/>
            Mã bài: <b>${sub.anonymousCode}</b>
          </td>
        </tr>
      </table>

      <p><b>Họ và tên học sinh:</b> ${sub.studentName} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Lớp:</b> ${sub.className || session.className} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Số trang bài làm:</b> ${sub.pages.length}</p>

      <div class="score-box">
        <p style="margin: 0; font-size: 14pt;">TỔNG ĐIỂM BÀI THI: <b style="font-size: 22pt; color: #b91c1c;">${finalScore} / 10</b></p>
        <p style="margin: 4px 0 0 0; font-size: 11pt; color: #475569;">
          (Điểm AI đề xuất: ${sub.gradingResult?.proposedTotalScore ?? '-'} | Trạng thái: ${sub.status === 'approved' ? 'GIÁO VIÊN ĐÃ DUYỆT' : 'CHỜ DUYỆT'})
        </p>
      </div>

      <h3>I. ĐIỂM CHI TIẾT THEO TIÊU CHÍ VÀ BẰNG CHỨNG TRÍCH XUẤT</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">STT</th>
            <th style="width: 25%;">Câu / Yêu cầu cần đạt</th>
            <th style="width: 30%;">Bằng chứng trích từ bài làm</th>
            <th style="width: 15%;">Điểm</th>
            <th style="width: 25%;">Nhận xét căn cứ</th>
          </tr>
        </thead>
        <tbody>
          ${criteriaRows || '<tr><td colspan="5" style="text-align: center; padding: 10px;">Chưa có dữ liệu chấm</td></tr>'}
        </tbody>
      </table>

      <h3>II. ĐIỂM MẠNH NỔI BẬT</h3>
      <ul>${strengthsList || '<li>Chưa có dữ liệu</li>'}</ul>

      <h3>III. BẢNG PHÂN TÍCH LỖI VÀ GỢI Ý KHẮC PHỤC</h3>
      <ul>${errorRows || '<li>Không ghi nhận lỗi đáng kể</li>'}</ul>

      <h3>IV. LỜI PHÊ VÀ ĐÁNH GIÁ CHUNG CỦA GIÁO VIÊN</h3>
      <div style="background: #fffbeb; border: 1px solid #fef08a; padding: 10px; border-radius: 4px; font-style: italic;">
        "${sub.teacherNotes || sub.gradingResult?.teacherFeedbackSummary || 'Cần nỗ lực hơn trong các bài sau.'}"
      </div>

      <div style="margin-top: 40px; text-align: right; padding-right: 50px;">
        <p><i>Ngày ..... tháng ..... năm 2026</i><br/><b>GIÁO VIÊN CHẤM THI</b><br/><br/><br/><i>(Ký và ghi rõ họ tên)</i></p>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Phieu_Ket_Qua_${sub.studentName.replace(/[\s/]/g, '_')}_${sub.anonymousCode}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Transcribed Texts as .txt
 */
export function exportTranscriptionText(sub: StudentSubmission) {
  const content = `================================================
BẢN CHÉP BÀI LÀM VIẾT TAY HỌC SINH
Học sinh: ${sub.studentName}
Lớp: ${sub.className}
Mã bài: ${sub.anonymousCode}
Số trang: ${sub.pages.length}
Trạng thái xác nhận: ${sub.transcriptConfirmed ? 'Đã xác nhận bởi giáo viên' : 'Chưa xác nhận'}
================================================

${sub.editedTranscription || sub.originalTranscription || '(Trống)'}
  `;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ban_Chep_${sub.studentName.replace(/[\s/]/g, '_')}_${sub.anonymousCode}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export complete session package as JSON
 */
export function exportSessionBackupJson(session: ExamSession, submissions: StudentSubmission[]) {
  const backup = {
    app: 'TRỢ LÝ CHẤM BÀI NGỮ VĂN',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    session,
    submissions,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dot_Cham_${session.title.replace(/[\s/]/g, '_')}_Backup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
