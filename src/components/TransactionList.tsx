import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Trash2, Edit3, Smartphone, Bell, CornerDownLeft, Sparkles, AlertCircle, Download, CheckSquare, Square, Zap } from 'lucide-react';
import { Transaction, QuadrantType, EntryMethod } from '../types';
import { QUADRANT_CONFIGS } from '../constants/quadrants';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onOpenQuickModal: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onBatchDelete,
  onOpenQuickModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] = useState<string>('ALL');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredTx = transactions.filter((tx) => {
    // Search
    const matchesSearch =
      !searchTerm ||
      (tx.note && tx.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.amount.toString().includes(searchTerm);

    // Quadrant
    const matchesQuadrant =
      selectedQuadrantFilter === 'ALL' ||
      (selectedQuadrantFilter === 'LUMP_SUM' && tx.is_lump_sum) ||
      (selectedQuadrantFilter === 'ZERO' && tx.is_zero_spend) ||
      tx.quadrant === selectedQuadrantFilter;

    // Method
    const matchesMethod =
      selectedMethodFilter === 'ALL' || tx.entry_method === selectedMethodFilter;

    return matchesSearch && matchesQuadrant && matchesMethod;
  });

  const isAllSelected = filteredTx.length > 0 && filteredTx.every((tx) => selectedIds.includes(tx.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTx.map((tx) => tx.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`確定要刪除已勾選的 ${selectedIds.length} 筆記帳紀錄嗎？`)) {
      if (onBatchDelete) {
        onBatchDelete(selectedIds);
      } else {
        selectedIds.forEach((id) => onDelete(id));
      }
      setSelectedIds([]);
    }
  };

  const exportToCsv = () => {
    const exportData = selectedIds.length > 0
      ? filteredTx.filter((tx) => selectedIds.includes(tx.id))
      : filteredTx;

    const headers = ['日期', '金額(NTD)', '象限分類', '記帳來源', '備註', '模糊概算', '$0支出'];
    const rows = exportData.map((tx) => [
      tx.entry_date,
      tx.amount,
      tx.quadrant ? QUADRANT_CONFIGS[tx.quadrant].title : '未分類',
      tx.entry_method,
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

  const getMethodBadge = (method: EntryMethod) => {
    switch (method) {
      case 'widget':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
            <Zap className="w-3 h-3 text-emerald-500" /> 捷徑喚起
          </span>
        );
      case 'notification_quick_input':
      case 'notification_zero':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-medium">
            <Bell className="w-3 h-3" /> 推播寫入
          </span>
        );
      case 'lump_sum':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
            <CornerDownLeft className="w-3 h-3" /> 概算補登
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 font-medium">
            手動記帳
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Control Bar */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋記帳備註或金額..."
              className="w-full bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 rounded-2xl pl-10 pr-4 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <select
              value={selectedQuadrantFilter}
              onChange={(e) => setSelectedQuadrantFilter(e.target.value)}
              className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-700 dark:text-stone-200 focus:outline-none"
            >
              <option value="ALL">所有分類</option>
              <option value="NECESSARY_DAILY">必要 × 日常</option>
              <option value="NECESSARY_URGENT">必要 × 臨時</option>
              <option value="UNNECESSARY_DAILY">非必要 × 日常</option>
              <option value="UNNECESSARY_URGENT">非必要 × 臨時</option>
              <option value="LUMP_SUM">僅概算補登</option>
              <option value="ZERO">僅 $0 支出</option>
            </select>

            <select
              value={selectedMethodFilter}
              onChange={(e) => setSelectedMethodFilter(e.target.value)}
              className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-700 dark:text-stone-200 focus:outline-none"
            >
              <option value="ALL">所有來源</option>
              <option value="widget">Widget / 捷徑</option>
              <option value="notification_quick_input">推播輸入</option>
              <option value="notification_zero">推播 $0</option>
              <option value="lump_sum">概算補登</option>
              <option value="manual">手動</option>
            </select>

            <button
              onClick={exportToCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-2xs"
              title="將記帳清單匯出為 CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出 CSV</span>
            </button>
          </div>
        </div>

        {/* Multi-select Batch Toolbar */}
        {filteredTx.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-300">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-stone-400" />
              )}
              <span>{isAllSelected ? '取消全選' : '全選所有紀錄'}</span>
            </button>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  已選取 {selectedIds.length} 筆
                </span>
                <button
                  onClick={handleBatchDeleteClick}
                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>整批刪除</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction List Cards */}
      <div className="space-y-2.5">
        <AnimatePresence>
          {filteredTx.length === 0 ? (
            <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 text-center text-stone-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-sm font-medium">沒有找到符合條件的記帳紀錄</p>
              <button
                onClick={onOpenQuickModal}
                className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                + 立即新增一筆記帳
              </button>
            </div>
          ) : (
            filteredTx.map((tx) => {
              const qConfig = tx.quadrant ? QUADRANT_CONFIGS[tx.quadrant] : null;
              const isSelected = selectedIds.includes(tx.id);

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3 transition-all ${
                    isSelected
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox for batch select */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(tx.id)}
                      className="w-4 h-4 rounded border-stone-300 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />

                    {/* Quadrant Badge Icon / Indicator */}
                    <div className="flex-shrink-0">
                      {tx.is_zero_spend ? (
                        <span className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center font-bold text-xs">
                          $0
                        </span>
                      ) : tx.is_lump_sum ? (
                        <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 flex items-center justify-center font-bold text-xs">
                          補
                        </span>
                      ) : qConfig ? (
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${qConfig.badgeBg}`}
                        >
                          {qConfig.axisY[0]}
                        </span>
                      ) : (
                        <span className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 flex items-center justify-center font-bold text-xs">
                          ?
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 dark:text-white text-sm truncate">
                          {tx.note || (tx.is_zero_spend ? '今日 $0 支出' : qConfig?.title || '未分類')}
                        </span>
                        {qConfig && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${qConfig.badgeBg}`}>
                            {qConfig.title}
                          </span>
                        )}
                        {getMethodBadge(tx.entry_method)}
                      </div>

                      <div className="text-[11px] text-stone-400 mt-0.5 font-mono">
                        {tx.entry_date}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`font-mono font-extrabold text-base ${tx.is_zero_spend ? 'text-teal-600 dark:text-teal-400' : 'text-stone-900 dark:text-white'}`}>
                      ${tx.amount.toLocaleString()}
                    </span>

                    <button
                      onClick={() => onDelete(tx.id)}
                      className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="刪除紀錄"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

