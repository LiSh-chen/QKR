import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Trash2,
  Pencil,
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
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
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
          <div className="bg-[#fdf8ec] dark:bg-[#221d12] border-2 border-[#4a3a20] dark:border-[#c9b98a] rounded-2xl p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={() => setCalendarMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))}
                className="p-1 text-[#5a4a2a] dark:text-[#d4c49a]"
                id="calendar-prev-month-btn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white">{monthLabel}</span>
              <button
                onClick={() => setCalendarMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))}
                className="p-1 text-[#5a4a2a] dark:text-[#d4c49a]"
                id="calendar-next-month-btn"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="text-center text-[9px] font-bold text-[#8a7a5a] dark:text-[#b8a878]">
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
                    className="font-hand aspect-square rounded-lg flex flex-col items-center justify-center relative text-[11px]"
                    style={{
                      backgroundColor: isSelected ? '#ea580c' : hasTx ? 'rgba(200,230,192,0.25)' : 'transparent',
                      color: isSelected ? '#fff' : undefined,
                      boxShadow: isToday && !isSelected ? 'inset 0 0 0 1.5px #ea580c' : 'none',
                    }}
                    id={`calendar-day-${day.dateStr}`}
                  >
                    <span className={isSelected ? '' : 'dark:text-[#e8dcc0] text-[#3a2e18]'}>{day.dayNum}</span>
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
                className="font-hand w-full mt-1.5 text-[10px] text-orange-700 dark:text-orange-300 font-bold underline"
              >
                清除日期篩選（目前：{selectedDate}）
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-[#f5efdc] dark:bg-[#2e2818] border-[1.5px] border-[#a08a5c]/50 dark:border-[#8a7a5a]/40 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-[#8a7a5a] shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋備註或金額..."
                className="font-hand flex-1 min-w-0 bg-transparent text-xs text-[#5a4a2a] dark:text-[#d4c49a] focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowCategoryPicker(true)}
              className="font-hand flex items-center gap-1 px-3 py-2 bg-[#f5efdc] dark:bg-[#2e2818] border-[1.5px] border-[#a08a5c]/50 dark:border-[#8a7a5a]/40 rounded-xl text-xs text-[#5a4a2a] dark:text-[#d4c49a] whitespace-nowrap shrink-0"
              id="open-category-filter-btn"
            >
              <Tag className="w-3.5 h-3.5" />
              {categoryFilterLabel}
            </button>
            <button
              onClick={exportToCsv}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-[1.5px] border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold shrink-0"
              title="將記帳清單匯出為 CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {filteredTx.length > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-[#a08a5c]/50 dark:border-[#8a7a5a]/40 text-xs text-[#5a4a2a] dark:text-[#d4c49a]">
              <button onClick={toggleSelectAll} className="font-hand flex items-center gap-1.5 font-semibold">
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-[#8a7a5a]" />
                )}
                <span>{isAllSelected ? '取消全選' : '全選'}</span>
              </button>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    已選 {selectedIds.length}
                  </span>
                  <button
                    onClick={() => setShowCategoryPicker(true)}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 rounded-lg"
                    title="更改分類"
                    id="batch-reclassify-btn"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDuplicatePicker(true)}
                    className="p-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg"
                    title="複製到某天"
                    id="batch-duplicate-btn"
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleBatchDeleteClick}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg"
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

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pb-1">
          <AnimatePresence>
            {filteredTx.length === 0 ? (
              <div className="bg-[#fdf8ec] dark:bg-[#221d12] p-8 rounded-3xl border border-[#4a3a20]/70 dark:border-[#c9b98a]/60 text-center text-[#8a7a5a] space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-stone-300" />
                <p className="font-hand text-sm font-medium">沒有找到符合條件的記帳紀錄</p>
                <button onClick={onOpenQuickModal} className="font-hand mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  + 立即新增一筆記帳
                </button>
              </div>
            ) : (
              filteredTx.map((tx) => {
                const qConfig = tx.quadrant ? QUADRANT_CONFIGS[tx.quadrant] : null;
                const isSelected = selectedIds.includes(tx.id);
                const isOpen = openRowId === tx.id;
                const dotColor = tx.is_zero_spend ? '#0d9488' : tx.is_lump_sum ? '#b45309' : qConfig?.color || '#a8a29e';
                const shortDate = tx.entry_date ? tx.entry_date.slice(5).replace('-', '/') : '';

                return (
                  <div key={tx.id} className="relative rounded-2xl overflow-hidden">
                    {/* Actions revealed on swipe-left */}
                    <div className="absolute inset-y-0 right-0 flex items-stretch">
                      <button
                        onClick={() => {
                          setEditingTx(tx);
                          setOpenRowId(null);
                        }}
                        className="w-14 flex items-center justify-center bg-blue-500 text-white"
                        title="編輯"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          onDelete(tx.id);
                          setOpenRowId(null);
                        }}
                        className="w-14 flex items-center justify-center bg-rose-600 text-white"
                        title="刪除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, x: isOpen ? -112 : 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      drag="x"
                      dragConstraints={{ left: -112, right: 0 }}
                      dragElastic={0.15}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -56) setOpenRowId(tx.id);
                        else setOpenRowId(null);
                      }}
                      onClick={() => {
                        if (isOpen) setOpenRowId(null);
                      }}
                      className={`relative z-10 px-3 py-2.5 border shadow-sm flex items-center gap-2 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-[#fdf8ec] dark:bg-[#221d12] border-[#4a3a20]/70 dark:border-[#c9b98a]/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(tx.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-stone-300 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />

                      <span
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: dotColor }}
                      >
                        {tx.is_zero_spend ? '0' : tx.is_lump_sum ? '概' : qConfig ? qConfig.axisY[0] : '?'}
                      </span>

                      <span className="font-hand font-bold text-[#3a2e18] dark:text-white text-sm truncate flex-1 min-w-0">
                        {tx.note || (tx.is_zero_spend ? '今日 $0 支出' : qConfig?.title || '未分類')}
                      </span>

                      {tx.voice_raw_text && <Mic className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />}

                      <span className="text-[10px] text-[#8a7a5a] font-mono shrink-0">{shortDate}</span>

                      <span className={`font-mono font-extrabold text-sm shrink-0 ${tx.is_zero_spend ? 'text-teal-600 dark:text-teal-400' : 'text-[#3a2e18] dark:text-white'}`}>
                        ${tx.amount.toLocaleString()}
                      </span>
                    </motion.div>
                  </div>
                );
              })
            )}
          </AnimatePresence>
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
                <span className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white">
                  {selectedIds.length > 0 ? `將 ${selectedIds.length} 筆改成分類` : '篩選分類'}
                </span>
                <button onClick={() => setShowCategoryPicker(false)} className="text-[#8a7a5a]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUADRANT_LIST.map((qKey) => (
                  <button
                    key={qKey}
                    onClick={() => {
                      if (selectedIds.length > 0) {
                        handleBatchReclassifyClick(qKey);
                      } else {
                        setSelectedQuadrantFilter(qKey);
                        setShowCategoryPicker(false);
                      }
                    }}
                    className="font-hand h-11 rounded-xl text-xs font-bold text-white flex items-center justify-center"
                    style={{ backgroundColor: QUADRANT_CONFIGS[qKey].color }}
                  >
                    {QUADRANT_CONFIGS[qKey].title}
                  </button>
                ))}
                {selectedIds.length === 0 && (
                  <>
                    <button
                      onClick={() => { setSelectedQuadrantFilter('LUMP_SUM'); setShowCategoryPicker(false); }}
                      className="font-hand h-11 rounded-xl text-xs font-bold text-white bg-stone-500 flex items-center justify-center"
                    >
                      僅概算補登
                    </button>
                    <button
                      onClick={() => { setSelectedQuadrantFilter('ZERO'); setShowCategoryPicker(false); }}
                      className="font-hand h-11 rounded-xl text-xs font-bold text-white bg-teal-500 flex items-center justify-center"
                    >
                      僅 $0 支出
                    </button>
                    <button
                      onClick={() => { setSelectedQuadrantFilter('ALL'); setShowCategoryPicker(false); }}
                      className="font-hand h-11 rounded-xl text-xs font-bold text-[#5a4a2a] dark:text-[#d4c49a] col-span-2 border-[1.5px] border-dashed border-[#a08a5c] flex items-center justify-center"
                    >
                      顯示全部分類
                    </button>
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
                <span className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white">
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
                className="font-hand w-full bg-[#fdf8ec] dark:bg-[#221d12] border-[1.5px] border-[#4a3a20] dark:border-[#c9b98a] rounded-xl px-3 py-2 text-sm text-[#3a2e18] dark:text-white mb-3"
              />
              <button
                onClick={handleConfirmDuplicate}
                disabled={!duplicateTargetDate}
                className="font-hand w-full h-10 rounded-xl bg-[#c8e6c0] dark:bg-[#2e4a2a] border-[1.6px] border-[#2e5c26] font-bold text-[#2e5c26] dark:text-[#a8dba0] text-sm disabled:opacity-40"
              >
                確認複製
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTx && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="w-full max-w-xs nb-ruled rounded-3xl p-4 pl-6 relative space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white">編輯紀錄</span>
                <button onClick={() => setEditingTx(null)} className="text-[#8a7a5a]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-hand text-sm text-[#b08d57] font-bold">$</span>
                <input
                  type="number"
                  value={editingTx.amount}
                  onChange={(e) => setEditingTx({ ...editingTx, amount: parseFloat(e.target.value) || 0 })}
                  className="font-hand flex-1 bg-[#fdf8ec] dark:bg-[#221d12] border-[1.5px] border-[#4a3a20] dark:border-[#c9b98a] rounded-xl px-3 py-2 text-sm text-[#3a2e18] dark:text-white"
                />
              </div>

              <input
                type="text"
                value={editingTx.note || ''}
                onChange={(e) => setEditingTx({ ...editingTx, note: e.target.value })}
                placeholder="備註"
                className="font-hand w-full bg-[#fdf8ec] dark:bg-[#221d12] border-[1.5px] border-[#4a3a20] dark:border-[#c9b98a] rounded-xl px-3 py-2 text-sm text-[#3a2e18] dark:text-white"
              />

              <input
                type="date"
                value={editingTx.entry_date}
                onChange={(e) => setEditingTx({ ...editingTx, entry_date: e.target.value })}
                className="font-hand w-full bg-[#fdf8ec] dark:bg-[#221d12] border-[1.5px] border-[#4a3a20] dark:border-[#c9b98a] rounded-xl px-3 py-2 text-sm text-[#3a2e18] dark:text-white"
              />

              <div className="grid grid-cols-2 gap-2">
                {QUADRANT_LIST.map((qKey) => (
                  <button
                    key={qKey}
                    onClick={() => setEditingTx({ ...editingTx, quadrant: qKey, is_lump_sum: false })}
                    className="font-hand h-10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: QUADRANT_CONFIGS[qKey].color,
                      boxShadow: editingTx.quadrant === qKey && !editingTx.is_lump_sum ? '0 0 0 2px #ea580c' : 'none',
                    }}
                  >
                    {editingTx.quadrant === qKey && !editingTx.is_lump_sum && <Check className="w-3 h-3" />}
                    {QUADRANT_CONFIGS[qKey].title}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (onUpdateTransaction) {
                    onUpdateTransaction(editingTx.id, {
                      amount: editingTx.amount,
                      note: editingTx.note,
                      entry_date: editingTx.entry_date,
                      quadrant: editingTx.quadrant,
                      is_lump_sum: editingTx.is_lump_sum,
                    });
                  }
                  setEditingTx(null);
                }}
                className="font-hand w-full h-10 rounded-xl bg-[#c8e6c0] dark:bg-[#2e4a2a] border-[1.6px] border-[#2e5c26] font-bold text-[#2e5c26] dark:text-[#a8dba0] text-sm"
              >
                儲存變更
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
