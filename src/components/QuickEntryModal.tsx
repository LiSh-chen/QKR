import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Clock, CornerDownLeft, Sparkles, AlertCircle, Trophy, Award } from 'lucide-react';
import { QuadrantType, Transaction } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import {
  playClickSound,
  triggerHapticFeedback,
  recordSlaMetric,
  getSpeedPB,
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

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSource = 'widget',
  initialAmount = '',
  initialDate,
  initialQuadrant,
  initialNote = '',
}) => {
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType | null>(initialQuadrant || null);
  const [note, setNote] = useState(initialNote);
  const [entryDate, setEntryDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [isLumpSum, setIsLumpSum] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [currentPB, setCurrentPB] = useState<number | null>(null);
  const [completedSla, setCompletedSla] = useState<{
    ms: number;
    passed: boolean;
    isNewPB: boolean;
    rankTitle: string;
    rankBadge: string;
  } | null>(null);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const now = performance.now();
      startTimeRef.current = now;
      setAmountStr(initialAmount || '');
      setCurrentPB(getSpeedPB());

      // Detect quadrant from initialQuadrant prop or parse from initialSource
      let defaultQ: QuadrantType | null = initialQuadrant || null;
      if (!defaultQ && initialSource) {
        for (const qKey of QUADRANT_LIST) {
          if (initialSource.includes(qKey)) {
            defaultQ = qKey as QuadrantType;
            break;
          }
        }
      }
      setSelectedQuadrant(defaultQ);

      setNote(initialNote || '');
      setIsLumpSum(false);
      setCompletedSla(null);
      setEntryDate(initialDate || new Date().toISOString().split('T')[0]);

      // Focus input immediately for ultra-low latency
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialAmount, initialDate, initialQuadrant, initialSource]);

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    triggerHapticFeedback('light');
    playClickSound(900);

    if (val === 'DEL') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    if (val === 'CLEAR') {
      setAmountStr('');
      return;
    }
    if (amountStr.length >= 7) return; // Prevent unreasonable amounts
    setAmountStr((prev) => (prev === '0' ? val : prev + val));
  };

  const handleQuadrantSelect = (q: QuadrantType) => {
    setSelectedQuadrant(q);
    triggerHapticFeedback('medium');
    playClickSound(1100);

    // Auto save if amount is valid
    const num = parseFloat(amountStr);
    if (!isNaN(num) && num > 0) {
      finalizeSave(num, q);
    }
  };

  const handleFormSubmit = () => {
    const num = parseFloat(amountStr);
    if (!isNaN(num) && num > 0) {
      if (isLumpSum) {
        finalizeSave(num, null);
      } else if (selectedQuadrant) {
        finalizeSave(num, selectedQuadrant);
      }
    }
  };

  const finalizeSave = (amount: number, quadrant: QuadrantType | null) => {
    const totalDuration = Math.round(performance.now() - startTimeRef.current);
    const slaResult = recordSlaMetric(totalDuration, initialSource);
    const pbResult = checkAndUpdateSpeedPB(totalDuration);
    const rankInfo = getSpeedRankInfo(totalDuration);

    setCompletedSla({
      ms: totalDuration,
      passed: slaResult.passed,
      isNewPB: pbResult.isNewPB,
      rankTitle: rankInfo.title,
      rankBadge: rankInfo.badge,
    });

    if (pbResult.isNewPB) {
      triggerHapticFeedback('success');
      playClickSound(1800);
    } else {
      triggerHapticFeedback('success');
      playClickSound(1400);
    }

    setTimeout(() => {
      onSave({
        amount,
        quadrant: isLumpSum ? null : quadrant,
        note: note.trim() || (isLumpSum ? '模糊概算記帳' : ''),
        is_lump_sum: isLumpSum,
        is_zero_spend: amount === 0,
        entry_method: (initialSource as any) || 'widget',
        entry_date: entryDate,
        duration_ms: totalDuration,
      });
      onClose();
    }, pbResult.isNewPB ? 700 : 350);
  };

  const handleZeroSpendToday = () => {
    triggerHapticFeedback('success');
    finalizeSave(0, null);
  };

  const isAmountValid = !isNaN(parseFloat(amountStr)) && parseFloat(amountStr) > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden max-h-[92vh] flex flex-col"
          id="quick-entry-modal"
        >
          {/* Header & SLA Timer */}
          <div className="px-5 pt-4 pb-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                  極速 2x2 記帳
                  {isLumpSum && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-medium">
                      模糊補登
                    </span>
                  )}
                  {selectedQuadrant && !isLumpSum && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      ✓ {QUADRANT_CONFIGS[selectedQuadrant].title}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {selectedQuadrant
                    ? `已直連預選象限：${QUADRANT_CONFIGS[selectedQuadrant].title} （輸入金額即可一鍵送出）`
                    : `來源：${initialSource.includes('widget') || initialSource.includes('quick_dock') ? '0.1秒極速直連板' : '手動快捷鍵'}`}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
              id="close-quick-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Amount Display & Input */}
            <div className="bg-stone-50 dark:bg-stone-800/60 p-4 rounded-2xl border border-stone-200 dark:border-stone-700/60 flex flex-col items-center justify-center relative">
              <span className="text-xs font-medium text-stone-400 mb-1">輸入金額 ($ NTD)</span>
              <div className="flex items-baseline justify-center gap-1 w-full">
                <span className="text-2xl font-bold text-stone-400">$</span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFormSubmit();
                    }
                  }}
                  placeholder="0"
                  className="text-4xl font-extrabold text-stone-900 dark:text-white bg-transparent text-center focus:outline-none w-48 font-mono tracking-tight"
                  id="amount-input-field"
                />
              </div>

              {/* Date & Note Inputs */}
              <div className="w-full mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-700/80 flex flex-wrap sm:flex-nowrap gap-2 text-xs">
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-700 dark:text-stone-200 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <input
                  type="text"
                  maxLength={100}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFormSubmit();
                    }
                  }}
                  placeholder="備註（選填，如：午餐便當）..."
                  className="flex-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 text-stone-700 dark:text-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Frequent Preset Chips */}
              <div className="w-full mt-3.5 pt-2.5 border-t border-stone-200/60 dark:border-stone-700/60">
                <div className="text-[11px] font-bold text-stone-400 mb-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" /> 高頻常用速點捷徑：
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  {[
                    { label: '☕️ 冰美式 $65', amount: '65', quadrant: 'NECESSARY_DAILY' as QuadrantType, note: '冰美式' },
                    { label: '🍱 午餐便當 $120', amount: '120', quadrant: 'NECESSARY_DAILY' as QuadrantType, note: '午餐便當' },
                    { label: '🚌 悠遊卡 $200', amount: '200', quadrant: 'NECESSARY_DAILY' as QuadrantType, note: '悠遊卡加值' },
                    { label: '🛒 日用品 $350', amount: '350', quadrant: 'NECESSARY_DAILY' as QuadrantType, note: '日用品' },
                    { label: '🥤 手搖飲 $65', amount: '65', quadrant: 'UNNECESSARY_DAILY' as QuadrantType, note: '手搖飲' },
                    { label: '🎬 看電影 $350', amount: '350', quadrant: 'UNNECESSARY_DAILY' as QuadrantType, note: '看電影' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAmountStr(preset.amount);
                        setSelectedQuadrant(preset.quadrant);
                        setNote(preset.note);
                        triggerHapticFeedback('light');
                      }}
                      className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-stone-200 dark:border-stone-700 hover:border-emerald-400 text-stone-700 dark:text-stone-300 font-medium transition-colors shadow-2xs"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Mode Toggle Row */}
            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={handleZeroSpendToday}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium hover:bg-teal-100 transition-colors"
                id="zero-spend-quick-btn"
              >
                <Sparkles className="w-3.5 h-3.5" />
                今日 $0 支出（一鍵紀錄）
              </button>

              <label className="flex items-center gap-2 cursor-pointer text-stone-600 dark:text-stone-300 select-none">
                <input
                  type="checkbox"
                  checked={isLumpSum}
                  onChange={(e) => setIsLumpSum(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <span>模糊概算補登 (不分象限)</span>
              </label>
            </div>

            {/* Primary Action Button (When Quadrant Pre-selected & Amount Valid) */}
            {!isLumpSum && (
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={!isAmountValid || !selectedQuadrant}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isAmountValid && selectedQuadrant
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white shadow-emerald-600/30 cursor-pointer'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed shadow-none border border-stone-200 dark:border-stone-700'
                }`}
                id="confirm-quick-save-btn"
              >
                <CornerDownLeft className="w-4 h-4" />
                {isAmountValid && selectedQuadrant ? (
                  <span>
                    一鍵完成記帳：【{QUADRANT_CONFIGS[selectedQuadrant].title}】 ${amountStr}
                  </span>
                ) : !selectedQuadrant ? (
                  <span>請點選下方象限分類</span>
                ) : (
                  <span>請輸入金額 (${QUADRANT_CONFIGS[selectedQuadrant].title})</span>
                )}
              </button>
            )}

            {/* 2x2 Quadrant Selector Matrix */}
            {!isLumpSum ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    象限分類（點擊可切換或直接送出）：
                  </span>
                  {!selectedQuadrant && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 請選擇分類
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {QUADRANT_LIST.map((qKey) => {
                    const q = QUADRANT_CONFIGS[qKey];
                    const isSelected = selectedQuadrant === qKey;

                    return (
                      <motion.button
                        key={qKey}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleQuadrantSelect(qKey)}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all min-h-[90px] relative overflow-hidden cursor-pointer ${
                          isSelected
                            ? `${q.activeColor} shadow-md ring-2 ring-emerald-500 scale-[1.01]`
                            : `${q.bgColor} ${q.borderColor} ${q.hoverColor} text-stone-800 dark:text-stone-100 opacity-80 hover:opacity-100`
                        }`}
                        id={`quadrant-btn-${qKey}`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-sm flex items-center gap-1">
                            {q.title}
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold ml-1">
                                ✓ 已預選
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/30 border border-stone-200 dark:border-stone-700">
                            {q.axisX} · {q.axisY}
                          </span>
                        </div>

                        <p className="text-xs opacity-80 line-clamp-1">{q.subTitle}</p>

                        <div className="mt-2 text-[10px] opacity-70 flex flex-wrap gap-1">
                          {q.examples.slice(0, 2).map((ex, idx) => (
                            <span key={idx} className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                              {ex}
                            </span>
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-2">
                <p className="font-bold">💡 模糊概算補登模式說明：</p>
                <p>
                  忘記前幾天明細時，可用總額概算回溯。此紀錄計入「總支出」與「連續記帳天數（Streak）」，但不會強行歸類四象限，保持報表數據準確。
                </p>
                <button
                  type="button"
                  onClick={() => isAmountValid && finalizeSave(parseFloat(amountStr), null)}
                  disabled={!isAmountValid}
                  className="w-full mt-2 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  id="confirm-lump-sum-btn"
                >
                  <CornerDownLeft className="w-4 h-4" /> 確認補登 ${amountStr || '0'}
                </button>
              </div>
            )}

            {/* Quick Virtual Keypad */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'DEL'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadPress(k)}
                    className="py-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 font-mono font-bold text-stone-800 dark:text-stone-100 text-base active:scale-95 transition-transform"
                  >
                    {k === 'DEL' ? '⌫' : k === 'CLEAR' ? 'C' : k}
                  </button>
                ))}
              </div>
            </div>

            {/* SLA Completion Toast */}
            {completedSla && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`p-3 rounded-2xl text-white text-xs font-bold flex items-center justify-between shadow-lg ${
                  completedSla.isNewPB
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 ring-2 ring-amber-300'
                    : 'bg-emerald-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{completedSla.isNewPB ? '🏆' : completedSla.rankBadge}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>
                        {completedSla.isNewPB ? '🎉 刷新個人最快紀錄！' : '⚡ 記帳完成！'}
                      </span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                        {(completedSla.ms / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <p className="text-[10px] font-normal opacity-90">
                      解鎖稱號：【{completedSla.rankTitle}】
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">
                  {completedSla.isNewPB ? '新紀錄 PB!' : '紀錄在案'}
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
