import React, { useState } from 'react';
import {
  BookOpen,
  Settings,
  HelpCircle,
  Smartphone,
  Monitor,
  RefreshCw,
  Layers,
  FileText,
  Award,
  FileSpreadsheet,
  ChevronDown,
  Camera,
} from 'lucide-react';
import { ExamSession, DeviceMode } from '../types';
import { EffectiveDeviceType } from '../utils/device';

interface HeaderProps {
  currentSession: ExamSession;
  activeTab: 'config' | 'organizer' | 'transcript' | 'grading' | 'gradebook';
  onSelectTab: (tab: 'config' | 'organizer' | 'transcript' | 'grading' | 'gradebook') => void;
  onOpenRubricModal: () => void;
  onOpenGuideModal: () => void;
  onResetSampleData: () => void;
  deviceMode: DeviceMode;
  effectiveDeviceType: EffectiveDeviceType;
  onChangeDeviceMode: (mode: DeviceMode) => void;
  submissionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  activeTab,
  onSelectTab,
  onOpenRubricModal,
  onOpenGuideModal,
  onResetSampleData,
  deviceMode,
  effectiveDeviceType,
  onChangeDeviceMode,
  submissionsCount,
}) => {
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Logo & Exam Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-black text-xs sm:text-base text-slate-900 tracking-tight truncate">
                  TRỢ LÝ CHẤM BÀI NGỮ VĂN
                </h1>
                <span className="text-[10px] font-black bg-gradient-to-r from-amber-600 to-orange-600 text-white px-2 py-0.5 rounded-full shadow-xs shrink-0">
                  THCS (LỚP 6-9)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Device Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Device Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowDeviceMenu(!showDeviceMenu)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs flex items-center gap-1.5 transition-colors"
                title="Đổi chế độ Điện thoại / Máy tính"
              >
                {effectiveDeviceType === 'mobile' ? (
                  <Smartphone className="w-4 h-4 text-amber-600" />
                ) : (
                  <Monitor className="w-4 h-4 text-sky-600" />
                )}
                <span className="text-[11px] font-medium hidden sm:inline">
                  {effectiveDeviceType === 'mobile' ? 'Mobile' : 'PC'}
                </span>
              </button>

              {showDeviceMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1">
                  <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Chế độ giao diện
                  </p>
                  <button
                    onClick={() => {
                      onChangeDeviceMode('auto');
                      setShowDeviceMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between ${
                      deviceMode === 'auto' ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>Tự động nhận diện</span>
                    <span className="text-[10px] text-slate-400 font-normal">Mặc định</span>
                  </button>
                  <button
                    onClick={() => {
                      onChangeDeviceMode('mobile');
                      setShowDeviceMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 ${
                      deviceMode === 'mobile' ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chế độ Điện thoại (Có camera)</span>
                  </button>
                  <button
                    onClick={() => {
                      onChangeDeviceMode('desktop');
                      setShowDeviceMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 ${
                      deviceMode === 'desktop' ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5 text-sky-600" />
                    <span>Chế độ Máy tính (Kéo thả ảnh)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Reset sample */}
            <button
              onClick={() => {
                if (confirm('Khôi phục bài thi mẫu môn Ngữ văn?')) {
                  onResetSampleData();
                }
              }}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
              title="Dữ liệu kiểm thử mẫu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Guide */}
            <button
              onClick={onOpenGuideModal}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
              title="Hướng dẫn quy trình"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden md:flex max-w-7xl mx-auto px-6 gap-2 border-t border-slate-100 text-xs font-bold">
          <button
            onClick={() => onSelectTab('config')}
            className={`py-2.5 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'config'
                ? 'border-amber-600 text-amber-900 bg-amber-50/80 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            1. Cấu hình Đợt Chấm
          </button>

          <button
            onClick={() => onSelectTab('organizer')}
            className={`py-2.5 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'organizer'
                ? 'border-amber-600 text-amber-900 bg-amber-50/80 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-600" />
            2. Quản lý bài nộp ({submissionsCount})
          </button>

          <button
            onClick={() => onSelectTab('transcript')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'transcript'
                ? 'border-amber-600 text-amber-800 bg-amber-50/40 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Nhận dạng & Tái tạo bài làm
          </button>

          <button
            onClick={() => onSelectTab('grading')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'grading'
                ? 'border-amber-600 text-amber-800 bg-amber-50/40 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            4. Chấm chi tiết & Duyệt điểm
          </button>

          <button
            onClick={() => onSelectTab('gradebook')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'gradebook'
                ? 'border-amber-600 text-amber-800 bg-amber-50/40 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            5. Bảng điểm
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR: Standard ergonomic bottom bar for thumbs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-2xl px-1 py-1.5 flex items-center justify-around safe-area-bottom">
        <button
          onClick={() => onSelectTab('config')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            activeTab === 'config'
              ? 'text-amber-800 font-black bg-amber-50/90 scale-105 shadow-xs'
              : 'text-slate-500 font-medium'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span className="text-[9.5px]">1. Đợt chấm</span>
        </button>

        <button
          onClick={() => onSelectTab('organizer')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            activeTab === 'organizer'
              ? 'text-amber-800 font-black bg-amber-50/90 scale-105 shadow-xs'
              : 'text-slate-500 font-medium'
          }`}
        >
          <div className="relative">
            <Layers className="w-4 h-4 text-amber-600" />
            <span className="absolute -top-1 -right-2 bg-amber-600 text-white text-[8.5px] px-1 rounded-full font-bold">
              {submissionsCount}
            </span>
          </div>
          <span className="text-[9.5px]">2. Bài nộp</span>
        </button>

        <button
          onClick={() => onSelectTab('transcript')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            activeTab === 'transcript'
              ? 'text-amber-700 font-extrabold bg-amber-50/70 scale-105'
              : 'text-slate-500 font-medium'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span className="text-[9.5px]">3. Tái tạo bài</span>
        </button>

        <button
          onClick={() => onSelectTab('grading')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            activeTab === 'grading'
              ? 'text-amber-700 font-extrabold bg-amber-50/70 scale-105'
              : 'text-slate-500 font-medium'
          }`}
        >
          <Award className="w-4 h-4 text-amber-600" />
          <span className="text-[9.5px]">4. Chấm điểm</span>
        </button>

        <button
          onClick={() => onSelectTab('gradebook')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            activeTab === 'gradebook'
              ? 'text-amber-700 font-extrabold bg-amber-50/70 scale-105'
              : 'text-slate-500 font-medium'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-600" />
          <span className="text-[9.5px]">5. Bảng điểm</span>
        </button>
      </nav>
    </>
  );
};

