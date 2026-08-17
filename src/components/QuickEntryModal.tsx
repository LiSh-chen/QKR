import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, CornerDownLeft, Sparkles, PiggyBank, Delete } from 'lucide-react';
import { QuadrantType, Transaction } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import {
  playClickSound,
  triggerHapticFeedback,
  recordSlaMetric,
  checkAndUpdateSpeedPB,
  getSpeedRankInfo,
} from '../lib/storage';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  initialSource?: string;
  initialAmount?: string;
  initialDate?: string;
  initialQuadrant?: QuadrantType | null;
  initialNote?: string;
}

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

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSource = 'widget',
  initialAmount = '',
  initialQuadrant,
  initialNote = '',
}) => {
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [note, setNote] = useState(initialNote);
  const [completedToast, setCompletedToast] = useState<{ ms: number; isNewPB: boolean; rankBadge: string } | null>(
    null
  );

  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      startTimeRef.current = performance.now();
      setAmountStr(initialAmount || '');
      setNote(initialNote || '');
      setCompletedToast(null);
    }
  }, [isOpen, initialAmount, initialNote]);

  if (!isOpen) return null;

  const handleKeyPress = (key: (typeof KEYPAD_KEYS)[number]) => {
    triggerHapticFeedback('light');
    playClickSound(900);
    if (key === 'C') {
      setAmountStr('');
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

  const isAmountValid = !isNaN(parseFloat(amountStr)) && parseFloat(amountStr) > 0;

  const finalizeSave = (amount: number, quadrant: QuadrantType | null, isLumpSum: boolean) => {
    const totalDuration = Math.max(120, Math.round(performance.now() - startTimeRef.current));
    const slaResult = recordSlaMetric(totalDuration, initialSource);
    const pbResult = checkAndUpdateSpeedPB(totalDuration);
    const rankInfo = getSpeedRankInfo(totalDuration);

    triggerHapticFeedback('success');
    playClickSound(pbResult.isNewPB ? 1800 : 1400);

    setCompletedToast({ ms: totalDuration, isNewPB: pbResult.isNewPB, rankBadge: rankInfo.badge });

    onSave({
      amount,
      quadrant,
      note: note.trim() || (isLumpSum ? '模糊概算記帳' : ''),
      is_lump_sum: isLumpSum,
      is_zero_spend: amount === 0,
      entry_method: (initialSource as any) || 'widget',
      entry_date: new Date().toISOString().split('T')[0],
      duration_ms: totalDuration,
    });

    // Give the toast a brief beat to show, then close.
    setTimeout(onClose, pbResult.isNewPB ? 650 : 320);
  };

  const handleQuadrantClick = (qKey: QuadrantType) => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    finalizeSave(parseFloat(amountStr), qKey, false);
  };

  const handleLumpSumClick = () => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    finalizeSave(parseFloat(amountStr), null, true);
  };

  const handleZeroSpendToday = () => {
    triggerHapticFeedback('success');
    finalizeSave(0, null, false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-br from-amber-50 via-orange-50 to-orange-100 dark:from-stone-900 dark:via-stone-800 dark:to-orange-950 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-orange-200 dark:border-orange-900/40 overflow-hidden"
          style={{
            maxHeight: 'calc(100dvh - max(24px, env(safe-area-inset-top)) - 24px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          id="quick-entry-modal"
        >
          <div className="p-3.5 space-y-2">
            {/* Compact header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate">極速記帳</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors shrink-0"
                id="close-quick-modal-btn"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Calculator-style amount display */}
            <div className="bg-white/70 dark:bg-black/40 rounded-2xl border border-orange-300 dark:border-orange-900/50 px-4 py-2 flex items-center justify-between">
              <span className="text-orange-600 dark:text-orange-400 font-bold text-lg font-mono">$</span>
              <span className="flex-1 text-right text-2xl font-mono font-bold text-stone-900 dark:text-white tabular-nums truncate">
                {amountStr || '0'}
              </span>
            </div>

            {/* Note (single line) */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註（選填）：例如便當、咖啡"
              className="w-full px-3 py-1 bg-white/60 dark:bg-black/30 text-stone-700 dark:text-stone-200 text-xs rounded-xl border border-orange-300 dark:border-orange-900/40 focus:border-amber-500 focus:outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
              id="quick-modal-note-input"
            />

            {/* Numeric keypad */}
            <div className="grid grid-cols-3 gap-1">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={`h-9 rounded-xl font-bold text-sm flex items-center justify-center transition-colors ${
                    key === 'C'
                      ? 'bg-gradient-to-b from-rose-500/90 to-rose-700/90 text-white'
                      : key === '⌫'
                        ? 'bg-gradient-to-b from-amber-500/90 to-orange-600/90 text-white'
                        : 'bg-gradient-to-b from-white to-orange-100 dark:from-stone-700 dark:to-stone-800 text-stone-800 dark:text-stone-100 border border-orange-200 dark:border-transparent'
                  }`}
                  id={`quick-modal-keypad-${key}`}
                >
                  {key === '⌫' ? <Delete className="w-3.5 h-3.5 mx-auto" /> : key}
                </button>
              ))}
            </div>

            {/* 2x2 quadrant grid + lump-sum + zero-spend, mirrors the Quick tab */}
            <div className="grid grid-cols-2 gap-1">
              {QUADRANT_LIST.map((qKey) => {
                const q = QUADRANT_CONFIGS[qKey];
                return (
                  <button
                    key={qKey}
                    onClick={() => handleQuadrantClick(qKey)}
                    className={`h-10 rounded-xl text-center transition-all flex items-center justify-center ${QUADRANT_BUTTON_STYLE[qKey]}`}
                    id={`quick-modal-quadrant-${qKey}`}
                  >
                    <span className="text-[11px] font-bold text-white drop-shadow-sm">{q.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1">
              <button
                onClick={handleLumpSumClick}
                className="flex-1 h-8 rounded-xl flex items-center justify-center gap-1 bg-gradient-to-b from-stone-300 to-stone-400 text-stone-900 text-[10px] font-bold"
                id="quick-modal-lump-sum-btn"
              >
                <PiggyBank className="w-3 h-3" /> 模糊概算補登
              </button>
              <button
                onClick={handleZeroSpendToday}
                className="flex-1 h-8 rounded-xl flex items-center justify-center gap-1 bg-gradient-to-b from-teal-300 to-teal-500 text-teal-950 text-[10px] font-bold"
                id="quick-modal-zero-spend-btn"
              >
                <Sparkles className="w-3 h-3" /> 今日 $0 支出
              </button>
            </div>
          </div>

          {/* SLA toast — absolutely positioned overlay so it never shifts layout / triggers scroll */}
          <AnimatePresence>
            {completedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute left-3 right-3 bottom-3 p-2.5 rounded-2xl text-white text-[11px] font-bold flex items-center justify-between shadow-lg pointer-events-none ${
                  completedToast.isNewPB
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                    : 'bg-emerald-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{completedToast.isNewPB ? '🏆' : completedToast.rankBadge}</span>
                  {completedToast.isNewPB ? '刷新個人最快紀錄！' : '記帳完成！'}
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                  {(completedToast.ms / 1000).toFixed(2)}s
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
