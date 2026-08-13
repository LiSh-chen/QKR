import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Delete, X, History, Check } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';

interface WidgetDockProps {
  transactions: Transaction[];
  onDirectSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onOpenQuickModal: (source: string, initialAmount?: string, initialQuadrant?: QuadrantType) => void;
  todayTotal: number;
  currentStreak: number;
}

// Quadrant visual styling: solid filled, glossy "pressable" buttons
const QUADRANT_BUTTON_STYLE: Record<QuadrantType, string> = {
  NECESSARY_DAILY:
    'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(5,150,105,0.45)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]',
  NECESSARY_URGENT:
    'bg-gradient-to-b from-sky-400 to-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(37,99,235,0.45)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]',
  UNNECESSARY_DAILY:
    'bg-gradient-to-b from-amber-400 to-orange-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(217,119,6,0.45)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]',
  UNNECESSARY_URGENT:
    'bg-gradient-to-b from-rose-400 to-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(220,38,38,0.45)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]',
};

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'] as const;

export const WidgetDock: React.FC<WidgetDockProps> = ({ transactions, onDirectSave, todayTotal }) => {
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [isLumpSum, setIsLumpSum] = useState(false);
  const [showError, setShowError] = useState(false);
  const [lastResult, setLastResult] = useState<{ label: string; durationSec?: string } | null>(null);
  const [selectedRecentIds, setSelectedRecentIds] = useState<Set<string>>(new Set());

  const startTimeRef = useRef<number | null>(null);

  // Yesterday's real transactions, available to re-log with one tap
  const recentCandidates = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return transactions
      .filter((t) => t.entry_date === yesterdayStr && !t.is_zero_spend && t.amount > 0)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 6);
  }, [transactions]);

  const clearFeedback = () => {
    if (showError) setShowError(false);
    if (lastResult) setLastResult(null);
  };

  const handleKeyPress = (key: (typeof KEYPAD_KEYS)[number]) => {
    triggerHapticFeedback('light');
    playClickSound(800);
    clearFeedback();

    if (!startTimeRef.current && key !== 'C') {
      startTimeRef.current = performance.now();
    }

    if (key === 'C') {
      setAmountStr('');
      startTimeRef.current = null;
      return;
    }

    if (key === '⌫') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }

    setAmountStr((prev) => {
      const next = prev === '0' ? key : prev + key;
      return next.length > 7 ? prev : next;
    });
  };

  const resetEntryState = () => {
    setAmountStr('');
    setNoteStr('');
    setShowError(false);
    startTimeRef.current = null;
  };

  const handleQuadrantDirectClick = (qKey: QuadrantType) => {
    const amountNum = parseFloat(amountStr);

    if (isNaN(amountNum) || amountNum <= 0) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      setShowError(true);
      return;
    }

    const start = startTimeRef.current || performance.now();
    const durationMs = Math.max(120, Math.round(performance.now() - start));
    const durationSec = (durationMs / 1000).toFixed(2);

    triggerHapticFeedback('success');
    playClickSound(1200);

    const qConfig = QUADRANT_CONFIGS[qKey];

    onDirectSave({
      amount: amountNum,
      quadrant: qKey,
      note: noteStr.trim(),
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'widget',
      entry_date: new Date().toISOString().split('T')[0],
      duration_ms: durationMs,
    });

    setLastResult({ label: `$${amountNum} (${qConfig.title})`, durationSec });
    resetEntryState();
  };

  const handleLumpSumConfirm = () => {
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      setShowError(true);
      return;
    }

    const start = startTimeRef.current || performance.now();
    const durationMs = Math.max(120, Math.round(performance.now() - start));

    triggerHapticFeedback('success');
    playClickSound(1200);

    onDirectSave({
      amount: amountNum,
      quadrant: null,
      note: noteStr.trim() || '模糊概算記帳',
      is_lump_sum: true,
      is_zero_spend: false,
      entry_method: 'widget',
      entry_date: new Date().toISOString().split('T')[0],
      duration_ms: durationMs,
    });

    setLastResult({ label: `$${amountNum} (模糊概算補登)` });
    resetEntryState();
  };

  const toggleRecentSelect = (id: string) => {
    triggerHapticFeedback('light');
    setSelectedRecentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRecentTx = recentCandidates.filter((t) => selectedRecentIds.has(t.id));
  const selectedRecentTotal = selectedRecentTx.reduce((sum, t) => sum + t.amount, 0);

  const handleApplySelectedRecent = () => {
    if (selectedRecentTx.length === 0) return;
    triggerHapticFeedback('success');
    playClickSound(1200);

    const todayStr = new Date().toISOString().split('T')[0];
    selectedRecentTx.forEach((t) => {
      onDirectSave({
        amount: t.amount,
        quadrant: t.quadrant,
        note: t.note,
        is_lump_sum: t.is_lump_sum,
        is_zero_spend: false,
        entry_method: 'recent_reuse',
        entry_date: todayStr,
      });
    });

    setLastResult({ label: `已套用 ${selectedRecentTx.length} 筆（共 $${selectedRecentTotal}）` });
    setSelectedRecentIds(new Set());
  };

  return (
    <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950 text-white rounded-3xl p-3.5 shadow-xl border border-orange-900/40 relative overflow-hidden">
      <div className="relative z-10 space-y-2.5">
        {/* Compact top bar: today's total */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] text-orange-200/70">今日支出</span>
          <span className="text-base font-black font-mono text-white">${todayTotal.toLocaleString()}</span>
        </div>

        {/* Success / Error feedback */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-bold text-white truncate">{lastResult.label}</span>
                {lastResult.durationSec && (
                  <span className="font-mono text-emerald-400 shrink-0">{lastResult.durationSec}s</span>
                )}
              </div>
              <button onClick={() => setLastResult(null)} className="text-emerald-400 hover:text-white shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calculator-style amount display */}
        <div
          className={`relative bg-black/40 rounded-2xl border px-4 py-2.5 flex items-center justify-between transition-colors ${
            showError ? 'border-rose-500' : 'border-orange-900/50'
          }`}
        >
          <span className="text-orange-400 font-bold text-xl font-mono">$</span>
          <span className="flex-1 text-right text-3xl font-mono font-bold text-white tabular-nums truncate">
            {amountStr || '0'}
          </span>
          {showError && (
            <span className="absolute -top-2 right-3 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" /> 請先輸入金額
            </span>
          )}
        </div>

        {/* Note + lump-sum toggle */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={noteStr}
            onChange={(e) => setNoteStr(e.target.value)}
            placeholder="備註（選填）：例如便當、咖啡"
            className="flex-1 min-w-0 px-3 py-1.5 bg-black/30 text-stone-200 text-xs rounded-xl border border-orange-900/40 focus:border-amber-500 focus:outline-none placeholder:text-stone-500"
            id="main-direct-note-input"
          />
          <label className="flex items-center gap-1 shrink-0 text-[10px] text-stone-300 px-2 py-1.5 rounded-xl bg-black/20 border border-orange-900/30 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLumpSum}
              onChange={(e) => {
                setIsLumpSum(e.target.checked);
                clearFeedback();
              }}
              className="w-3.5 h-3.5 rounded text-amber-500"
              id="lump-sum-toggle"
            />
            概算
          </label>
        </div>

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-1.5">
          {KEYPAD_KEYS.map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleKeyPress(key)}
              className={`h-10 rounded-xl font-bold text-base flex items-center justify-center transition-colors ${
                key === 'C'
                  ? 'bg-gradient-to-b from-rose-500/90 to-rose-700/90 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]'
                  : key === '⌫'
                    ? 'bg-gradient-to-b from-amber-500/90 to-orange-600/90 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]'
                    : 'bg-gradient-to-b from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              }`}
              id={`keypad-btn-${key}`}
            >
              {key === '⌫' ? <Delete className="w-4 h-4" /> : key}
            </motion.button>
          ))}
        </div>

        {/* Either the 2x2 quadrant grid, or the lump-sum confirm button */}
        {isLumpSum ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLumpSumConfirm}
            className="w-full h-12 rounded-xl font-bold text-sm bg-gradient-to-b from-stone-400 to-stone-500 text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(0,0,0,0.35)]"
            id="lump-sum-confirm-btn"
          >
            確認補登 ${amountStr || '0'}（模糊概算，不分象限）
          </motion.button>
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
            {QUADRANT_LIST.map((qKey) => {
              const q = QUADRANT_CONFIGS[qKey];
              return (
                <motion.button
                  key={qKey}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuadrantDirectClick(qKey)}
                  className={`h-12 rounded-xl text-center transition-all flex flex-col items-center justify-center leading-none ${QUADRANT_BUTTON_STYLE[qKey]}`}
                  id={`quadrant-direct-btn-${qKey}`}
                >
                  <span className="text-[11px] font-bold text-white drop-shadow-sm">{q.title}</span>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Yesterday's records — quick reuse (multi-select) */}
        {recentCandidates.length > 0 && (
          <div className="pt-1.5 border-t border-orange-900/30 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-200/70">
              <History className="w-3 h-3" />
              <span>昨日紀錄快速複用（可多選）</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {recentCandidates.map((t) => {
                const isSelected = selectedRecentIds.has(t.id);
                const qColor = t.quadrant ? QUADRANT_CONFIGS[t.quadrant].color : '#A8A29E';
                const label = t.note || (t.quadrant ? QUADRANT_CONFIGS[t.quadrant].title : '模糊概算');
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleRecentSelect(t.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                      isSelected
                        ? 'bg-amber-500/90 border-amber-400 text-stone-900 font-bold'
                        : 'bg-black/25 border-orange-900/40 text-stone-200'
                    }`}
                    id={`recent-reuse-chip-${t.id}`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: qColor }} />
                    )}
                    <span className="truncate max-w-[90px]">{label}</span>
                    <span className="font-mono shrink-0">${t.amount}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedRecentTx.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleApplySelectedRecent}
                  className="w-full py-2 rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-white font-bold text-xs shadow-md"
                  id="apply-selected-recent-btn"
                >
                  套用所選 {selectedRecentTx.length} 筆（共 ${selectedRecentTotal}）
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
