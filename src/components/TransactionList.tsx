import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Trash2,
  AlertCircle,
  Download,
  CheckSquare,
  Square,
  Mic,
  ChevronLeft,
  ChevronRight,
  Tag,
  CopyPlus,
  X,
  Check,
} from 'lucide-react';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { RoughBox } from './RoughBox';

const QUADRANT_INK: Record<QuadrantType, string> = {
  NECESSARY_DAILY: '#2e5c26',
  NECESSARY_URGENT: '#1e4a78',
  UNNECESSARY_DAILY: '#7a5314',
  UNNECESSARY_URGENT: '#7a2020',
};

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchDuplicate?: (ids: string[], targetDate: string) => void;
  onBatchReclassify?: (ids: string[], quadrant: QuadrantType) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onOpenQuickModal: () => void;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onBatchDelete,
  onBatchDuplicate,
  onBatchReclassify,
  onUpdateTransaction,
  onOpenQuickModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] = useState<string>('ALL');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDuplicatePicker, setShowDuplicatePicker] = useState(false);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState('');

  const txDateSet = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.entry_date && set.add(t.entry_date));
    return set;
  }, [transactions]);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const startPad = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d });
    }
    return days;
  }, [calendarMonth]);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthLabel = `${calendarMonth.year} 年 ${calendarMonth.month + 1} 月`;

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      !searchTerm ||
      (tx.note && tx.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.amount.toString().includes(searchTerm);

    const matchesQuadrant =
      selectedQuadrantFilter === 'ALL' ||
      (selectedQuadrantFilter === 'LUMP_SUM' && tx.is_lump_sum) ||
      (selectedQuadrantFilter === 'ZERO' && tx.is_zero_spend) ||
      tx.quadrant === selectedQuadrantFilter;

    const matchesDate = !selectedDate || tx.entry_date === selectedDate;

    return matchesSearch && matchesQuadrant && matchesDate;
  });

  const isAllSelected = filteredTx.length > 0 && filteredTx.every((tx) => selectedIds.includes(tx.id));

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : filteredTx.map((tx) => tx.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`確定要刪除已勾選的 ${selectedIds.length} 筆記帳紀錄嗎？`)) {
      if (onBatchDelete) onBatchDelete(selectedIds);
      else selectedIds.forEach((id) => onDelete(id));
      setSelectedIds([]);
    }
  };

  const handleBatchReclassifyClick = (qKey: QuadrantType) => {
    if (selectedIds.length === 0 || !onBatchReclassify) return;
    onBatchReclassify(selectedIds, qKey);
    setSelectedIds([]);
    setShowCategoryPicker(false);
  };

  const handleConfirmDuplicate = () => {
    if (!duplicateTargetDate || selectedIds.length === 0 || !onBatchDuplicate) return;
    onBatchDuplicate(selectedIds, duplicateTargetDate);
    setSelectedIds([]);
    setShowDuplicatePicker(false);
    setDuplicateTargetDate('');
  };

  const exportToCsv = () => {
    const exportData = selectedIds.length > 0 ? filteredTx.filter((tx) => selectedIds.includes(tx.id)) : filteredTx;
    const headers = ['日期', '金額(NTD)', '象限分類', '備註', '模糊概算', '$0支出'];
    const rows = exportData.map((tx) => [
      tx.entry_date,
      tx.amount,
      tx.quadrant ? QUADRANT_CONFIGS[tx.quadrant].title : '未分類',
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.is_lump_sum ? '是' : '否',
      tx.is_zero_spend ? '是' : '否',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuickLedger_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryFilterLabel =
    selectedQuadrantFilter === 'ALL'
      ? '所有分類'
      : selectedQuadrantFilter === 'LUMP_SUM'
        ? '僅概算補登'
        : selectedQuadrantFilter === 'ZERO'
          ? '僅 $0 支出'
          : QUADRANT_CONFIGS[selectedQuadrantFilter as QuadrantType]?.title || '所有分類';

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 nb-ruled rounded-3xl p-3 relative">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <div className="ml-4 flex-1 min-h-0 flex flex-col gap-3">
        <div className="shrink-0 space-y-2">
          {/* Calendar — a hand-drawn box, floating above the scrolling list below */}
          <RoughBox
            shape="rectangle"
            stroke="#3a2e18"
            strokeWidth={1.6}
            roughness={1.4}
            className="relative p-2.5"
            style={{ transform: 'rotate(-0.4deg)', filter: 'drop-shadow(2px 5px 8px rgba(0,0,0,0.3))' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={() => setCalendarMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))}
                className="p-1 text-[#5a4a2a]"
                id="calendar-prev-month-btn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-hand pencil-text text-sm font-bold text-[#3a2e18]">{monthLabel}</span>
              <button
                onClick={() => setCalendarMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))}
                className="p-1 text-[#5a4a2a]"
                id="calendar-next-month-btn"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="font-hand pencil-text text-center text-[9px] font-bold text-[#8a7a5a]">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`pad-${idx}`} />;
                const hasTx = txDateSet.has(day.dateStr);
                const isSelected = selectedDate === day.dateStr;
                const isToday = day.dateStr === todayStr;
                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : day.dateStr)}
                    className="font-hand pencil-text aspect-square rounded-lg flex flex-col items-center justify-center relative text-[11px]"
                    style={{
                      backgroundColor: isSelected ? '#ea580c' : hasTx ? 'rgba(200,230,192,0.25)' : 'transparent',
                      color: isSelected ? '#fff' : undefined,
                      boxShadow: isToday && !isSelected ? 'inset 0 0 0 1.5px #ea580c' : 'none',
                    }}
                    id={`calendar-day-${day.dateStr}`}
                  >
                    <span className={isSelected ? '' : ' text-[#3a2e18]'}>{day.dayNum}</span>
                    {hasTx && (
                      <span
                        className="w-1 h-1 rounded-full absolute bottom-0.5"
                        style={{ backgroundColor: isSelected ? '#fff' : '#2e5c26' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="font-hand pencil-text w-full mt-1.5 text-[10px] text-orange-700 font-bold underline"
              >
                清除日期篩選（目前：{selectedDate}）
              </button>
            )}
          </RoughBox>

          <div className="flex items-center gap-2">
            <RoughBox shape="rectangle" stroke="#a08a5c" strokeWidth={1.3} roughness={1.5} className="flex-1 flex items-center gap-1.5 px-3 py-2">
              <Search className="w-3.5 h-3.5 text-[#8a7a5a] shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋備註或金額..."
                className="font-hand pencil-text flex-1 min-w-0 bg-transparent text-xs text-[#5a4a2a] focus:outline-none"
              />
            </RoughBox>
            <RoughBox
              shape="rectangle"
              stroke="#a08a5c"
              strokeWidth={1.3}
              roughness={1.5}
              onClick={() => setShowCategoryPicker(true)}
              className="font-hand pencil-text flex items-center gap-1 px-3 py-2 text-xs text-[#5a4a2a] whitespace-nowrap shrink-0 cursor-pointer"
              id="open-category-filter-btn"
            >
              <Tag className="w-3.5 h-3.5" />
              {categoryFilterLabel}
            </RoughBox>
            <button
              onClick={exportToCsv}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-50 border-[1.5px] border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold shrink-0"
              title="將記帳清單匯出為 CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {filteredTx.length > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-[#a08a5c]/50 text-xs text-[#5a4a2a]">
              <button onClick={toggleSelectAll} className="font-hand pencil-text flex items-center gap-1.5 font-semibold">
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-[#8a7a5a]" />
                )}
                <span>{isAllSelected ? '取消全選' : '全選'}</span>
              </button>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-emerald-600 font-bold text-[11px]">
                    已選 {selectedIds.length}
                  </span>
                  <button
                    onClick={() => setShowCategoryPicker(true)}
                    className="p-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg"
                    title="更改分類"
                    id="batch-reclassify-btn"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDuplicatePicker(true)}
                    className="p-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg"
                    title="複製到某天"
                    id="batch-duplicate-btn"
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleBatchDeleteClick}
                    className="p-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg"
                    title="刪除"
                    id="batch-delete-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrolling list — a shadow along the top hints the "paper" sliding
            beneath the fixed calendar note above */}
        <div className="relative flex-1 min-h-0">
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-4 z-20"
            style={{ background: 'linear-gradient(rgba(20,12,4,0.18), transparent)' }}
          />
          <div className="h-full overflow-y-auto space-y-1.5 pb-1 pt-1">
            <AnimatePresence>
              {filteredTx.length === 0 ? (
                <div className="bg-white/8 p-8 rounded-3xl border-[1.5px] border-dashed border-[#4a3a20]/60 text-center text-[#8a7a5a] space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="font-hand pencil-text text-sm font-medium">沒有找到符合條件的記帳紀錄</p>
                  <button onClick={onOpenQuickModal} className="font-hand pencil-text mt-2 text-xs font-bold text-emerald-600 hover:underline">
                    + 立即新增一筆記帳
                  </button>
                </div>
              ) : (
                filteredTx.map((tx, idx) => {
                  const qConfig = tx.quadrant ? QUADRANT_CONFIGS[tx.quadrant] : null;
                  const isSelected = selectedIds.includes(tx.id);
                  const ink = tx.is_zero_spend || tx.is_lump_sum || !qConfig ? '#6b6259' : QUADRANT_INK[tx.quadrant as QuadrantType];
                  const shortDate = tx.entry_date ? tx.entry_date.slice(5).replace('-', '/') : '';

                  return (
                    <RoughBox
                      key={tx.id}
                      shape="rectangle"
                      stroke={ink}
                      strokeWidth={isSelected ? 2.4 : 1.5}
                      roughness={1.6}
                      fill={`${ink}18`}
                      fillStyle="hachure"
                      hachureGap={5}
                      onClick={() => setDetailTx(tx)}
                      className="relative w-full px-3 py-2.5 flex items-center gap-2 text-left cursor-pointer"
                      style={{ transform: `rotate(${idx % 2 === 0 ? '-0.4deg' : '0.4deg'})` }}
                      id={`tx-row-${tx.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(tx.id)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />

                      <span className="font-hand pencil-text font-bold text-[#2a2013] text-sm truncate flex-1 min-w-0">
                        {tx.note || (tx.is_zero_spend ? '今日 $0 支出' : qConfig?.title || '未分類')}
                      </span>

                      {tx.voice_raw_text && <Mic className="w-3 h-3 text-[#5c1414] shrink-0" />}

                      <span className="text-[10px] text-[#2a2013]/70 font-mono shrink-0">{shortDate}</span>

                      <span className="font-mono font-extrabold text-sm shrink-0 text-[#2a2013]">
                        ${tx.amount.toLocaleString()}
                      </span>
                    </RoughBox>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCategoryPicker && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="w-full max-w-xs nb-ruled rounded-3xl p-4 pl-6 relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-hand pencil-text text-sm font-bold text-[#3a2e18]">
                  {selectedIds.length > 0 ? `將 ${selectedIds.length} 筆改成分類` : '篩選分類'}
                </span>
                <button onClick={() => setShowCategoryPicker(false)} className="text-[#8a7a5a]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUADRANT_LIST.map((qKey) => (
                  <RoughBox
                    key={qKey}
                    shape="rectangle"
                    stroke={QUADRANT_INK[qKey]}
                    strokeWidth={1.6}
                    roughness={1.6}
                    fill={`${QUADRANT_INK[qKey]}22`}
                    fillStyle="hachure"
                    onClick={() => {
                      if (selectedIds.length > 0) {
                        handleBatchReclassifyClick(qKey);
                      } else {
                        setSelectedQuadrantFilter(qKey);
                        setShowCategoryPicker(false);
                      }
                    }}
                    className="font-hand pencil-text h-11 text-xs font-bold flex items-center justify-center cursor-pointer"
                    style={{ color: QUADRANT_INK[qKey] }}
                  >
                    {QUADRANT_CONFIGS[qKey].title}
                  </RoughBox>
                ))}
                {selectedIds.length === 0 && (
                  <>
                    <RoughBox
                      shape="rectangle"
                      stroke="#6b6259"
                      strokeWidth={1.6}
                      roughness={1.6}
                      onClick={() => { setSelectedQuadrantFilter('LUMP_SUM'); setShowCategoryPicker(false); }}
                      className="font-hand pencil-text h-11 text-xs font-bold text-[#6b6259] flex items-center justify-center cursor-pointer"
                    >
                      僅概算補登
                    </RoughBox>
                    <RoughBox
                      shape="rectangle"
                      stroke="#0d9488"
                      strokeWidth={1.6}
                      roughness={1.6}
                      onClick={() => { setSelectedQuadrantFilter('ZERO'); setShowCategoryPicker(false); }}
                      className="font-hand pencil-text h-11 text-xs font-bold text-teal-700 flex items-center justify-center cursor-pointer"
                    >
                      僅 $0 支出
                    </RoughBox>
                    <RoughBox
                      shape="rectangle"
                      stroke="#a08a5c"
                      strokeWidth={1.4}
                      roughness={1.6}
                      onClick={() => { setSelectedQuadrantFilter('ALL'); setShowCategoryPicker(false); }}
                      className="font-hand pencil-text h-11 text-xs font-bold text-[#5a4a2a] col-span-2 flex items-center justify-center cursor-pointer"
                    >
                      顯示全部分類
                    </RoughBox>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDuplicatePicker && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="w-full max-w-xs nb-ruled rounded-3xl p-4 pl-6 relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-hand pencil-text text-sm font-bold text-[#3a2e18]">
                  將 {selectedIds.length} 筆複製到...
                </span>
                <button onClick={() => setShowDuplicatePicker(false)} className="text-[#8a7a5a]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="date"
                value={duplicateTargetDate}
                onChange={(e) => setDuplicateTargetDate(e.target.value)}
                className="font-hand w-full bg-[#fdf8ec] border-[1.5px] border-[#4a3a20] rounded-xl px-3 py-2 text-sm text-[#3a2e18] mb-3"
              />
              <RoughBox
                shape="rectangle"
                stroke="#2e5c26"
                strokeWidth={1.8}
                roughness={1.6}
                fill="#2e5c2622"
                fillStyle="hachure"
                onClick={handleConfirmDuplicate}
                className={`font-hand pencil-text w-full h-10 font-bold text-[#2e5c26] text-sm flex items-center justify-center ${
                  !duplicateTargetDate ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
                }`}
              >
                確認複製
              </RoughBox>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail / Edit popup */}
      <AnimatePresence>
        {detailTx && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.95 }}
              className="w-full max-w-xs relative"
            >
              {(() => {
                const ink = detailTx.is_zero_spend || detailTx.is_lump_sum || !detailTx.quadrant ? '#6b6259' : QUADRANT_INK[detailTx.quadrant];
                return (
                  <RoughBox shape="rectangle" stroke={ink} strokeWidth={2.2} roughness={1.6} fill={`${ink}18`} fillStyle="hachure" className="relative p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-hand pencil-text text-base font-bold text-[#2a2013]">記帳詳情</span>
                      <button onClick={() => setDetailTx(null)} className="text-[#2a2013]/70">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-hand text-sm text-[#2a2013]/70 font-bold">$</span>
                      <input
                        type="number"
                        value={detailTx.amount}
                        onChange={(e) => setDetailTx({ ...detailTx, amount: parseFloat(e.target.value) || 0 })}
                        className="font-hand flex-1 bg-white/50 border-[1.5px] border-[#2a2013]/40 rounded-xl px-3 py-2 text-sm text-[#2a2013]"
                      />
                    </div>

                    <input
                      type="text"
                      value={detailTx.note || ''}
                      onChange={(e) => setDetailTx({ ...detailTx, note: e.target.value })}
                      placeholder="備註"
                      className="font-hand w-full bg-white/50 border-[1.5px] border-[#2a2013]/40 rounded-xl px-3 py-2 text-sm text-[#2a2013]"
                    />

                    <input
                      type="date"
                      value={detailTx.entry_date}
                      onChange={(e) => setDetailTx({ ...detailTx, entry_date: e.target.value })}
                      className="font-hand w-full bg-white/50 border-[1.5px] border-[#2a2013]/40 rounded-xl px-3 py-2 text-sm text-[#2a2013]"
                    />

                    {detailTx.voice_raw_text && (
                      <div className="font-hand text-[10px] text-[#2a2013]/60 italic">
                        語音原句：「{detailTx.voice_raw_text}」
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {QUADRANT_LIST.map((qKey) => (
                        <RoughBox
                          key={qKey}
                          shape="rectangle"
                          stroke={QUADRANT_INK[qKey]}
                          strokeWidth={detailTx.quadrant === qKey && !detailTx.is_lump_sum ? 2.6 : 1.5}
                          roughness={1.6}
                          fill={`${QUADRANT_INK[qKey]}22`}
                          fillStyle="hachure"
                          onClick={() => setDetailTx({ ...detailTx, quadrant: qKey, is_lump_sum: false })}
                          className="font-hand pencil-text relative h-10 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                          style={{ color: QUADRANT_INK[qKey] }}
                        >
                          {detailTx.quadrant === qKey && !detailTx.is_lump_sum && <Check className="w-3 h-3" />}
                          {QUADRANT_CONFIGS[qKey].title}
                        </RoughBox>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <RoughBox
                        shape="rectangle"
                        stroke="#7a2020"
                        strokeWidth={1.8}
                        roughness={1.7}
                        onClick={() => setDeleteConfirmId(detailTx.id)}
                        className="flex-1 h-10 font-hand pencil-text font-bold text-[#7a2020] text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        id="detail-delete-btn"
                      >
                        <Trash2 className="w-4 h-4" /> 刪除
                      </RoughBox>
                      <RoughBox
                        shape="rectangle"
                        stroke="#2e5c26"
                        strokeWidth={1.8}
                        roughness={1.7}
                        fill="#2e5c2622"
                        fillStyle="hachure"
                        onClick={() => {
                          if (onUpdateTransaction) {
                            onUpdateTransaction(detailTx.id, {
                              amount: detailTx.amount,
                              note: detailTx.note,
                              entry_date: detailTx.entry_date,
                              quadrant: detailTx.quadrant,
                              is_lump_sum: detailTx.is_lump_sum,
                            });
                          }
                          setDetailTx(null);
                        }}
                        className="flex-1 h-10 font-hand pencil-text font-bold text-[#2e5c26] text-sm flex items-center justify-center cursor-pointer"
                        id="detail-save-btn"
                      >
                        儲存變更
                      </RoughBox>
                    </div>
                  </RoughBox>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation — a second explicit step before anything is actually removed */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-[260px] relative"
            >
              <RoughBox
                shape="rectangle"
                stroke="#c0392b"
                strokeWidth={2}
                roughness={1.8}
                fill="#f1e9d2"
                fillStyle="solid"
                className="relative p-5 space-y-3 text-center"
              >
                <AlertCircle className="w-8 h-8 mx-auto text-rose-700" />
                <p className="font-hand pencil-text text-sm font-bold text-[#2a2013]">確定要刪除這筆記帳紀錄嗎？</p>
                <p className="font-hand pencil-text text-xs text-[#2a2013]/70">刪除後將無法復原</p>
                <div className="flex gap-2 pt-1">
                  <RoughBox
                    shape="rectangle"
                    stroke="#8a7454"
                    strokeWidth={1.5}
                    roughness={1.6}
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 h-10 font-hand pencil-text font-bold text-[#2a2013] text-sm flex items-center justify-center cursor-pointer"
                    id="delete-confirm-cancel-btn"
                  >
                    取消
                  </RoughBox>
                  <RoughBox
                    shape="rectangle"
                    stroke="#7a2020"
                    strokeWidth={1.8}
                    roughness={1.7}
                    fill="#7a202022"
                    fillStyle="hachure"
                    onClick={() => {
                      onDelete(deleteConfirmId);
                      setDeleteConfirmId(null);
                      setDetailTx(null);
                    }}
                    className="flex-1 h-10 font-hand pencil-text font-bold text-[#7a2020] text-sm flex items-center justify-center cursor-pointer"
                    id="delete-confirm-ok-btn"
                  >
                    確定刪除
                  </RoughBox>
                </div>
              </RoughBox>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
