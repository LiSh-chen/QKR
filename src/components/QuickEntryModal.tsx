import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Delete, Sparkles, PiggyBank } from 'lucide-react';
import { QuadrantType, Transaction } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import {
  playClickSound,
  triggerHapticFeedback,
  recordSlaMetric,
  checkAndUpdateSpeedPB,
  getSpeedRankInfo,
} from '../lib/storage';
import { useCalculator, CalcOperator } from '../lib/calculator';

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

const QUADRANT_STICKY_STYLE: Record<
  QuadrantType,
  { bg: string; border: string; text: string; rotate: string; radius: string }
> = {
  NECESSARY_DAILY: { bg: '#c8e6c0', border: '#2e5c26', text: '#2e5c26', rotate: '-1.5deg', radius: 'nb-blob-sticky-a' },
  NECESSARY_URGENT: { bg: '#bcd8f0', border: '#1e4a78', text: '#1e4a78', rotate: '1deg', radius: 'nb-blob-sticky-b' },
  UNNECESSARY_DAILY: { bg: '#f5dca0', border: '#7a5314', text: '#7a5314', rotate: '1.5deg', radius: 'nb-blob-sticky-a' },
  UNNECESSARY_URGENT: { bg: '#f0b8b8', border: '#7a2020', text: '#7a2020', rotate: '-1deg', radius: 'nb-blob-sticky-b' },
};

const DIGIT_ROTATIONS = ['-2deg', '1.5deg', '-1deg', '1deg', '-1.5deg', '2deg', '-2deg', '1deg', '-1deg', '-1deg', '1.5deg'];

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSource = 'widget',
  initialAmount = '',
  initialQuadrant,
  initialNote = '',
}) => {
  const calc = useCalculator();
  const [note, setNote] = useState(initialNote);
  const [completedToast, setCompletedToast] = useState<{ ms: number; isNewPB: boolean; rankBadge: string } | null>(
    null
  );

  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      startTimeRef.current = performance.now();
      calc.setDirectValue(initialAmount || '');
      setNote(initialNote || '');
      setCompletedToast(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialAmount, initialNote]);

  if (!isOpen) return null;

  const isAmountValid = !isNaN(calc.getEvaluatedAmount()) && calc.getEvaluatedAmount() > 0;

  const finalizeSave = (amount: number, quadrant: QuadrantType | null, isLumpSum: boolean) => {
    const totalDuration = Math.max(120, Math.round(performance.now() - startTimeRef.current));
    recordSlaMetric(totalDuration, initialSource);
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

    setTimeout(onClose, pbResult.isNewPB ? 650 : 320);
  };

  const handleQuadrantClick = (qKey: QuadrantType) => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    finalizeSave(calc.getEvaluatedAmount(), qKey, false);
  };

  const handleLumpSumClick = () => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    finalizeSave(calc.getEvaluatedAmount(), null, true);
  };

  const handleZeroSpendToday = () => {
    triggerHapticFeedback('success');
    finalizeSave(0, null, false);
  };

  const digitKey = (label: string, value: Parameters<typeof calc.pressDigit>[0], idx: number) => (
    <button
      key={label}
      onClick={() => {
        triggerHapticFeedback('light');
        playClickSound(900);
        calc.pressDigit(value);
      }}
      className="font-hand aspect-[1.3] nb-blob-1 bg-[#fefaf0] dark:bg-[#3a3120] border-[1.6px] border-[#4a3a20] dark:border-[#c9b98a] flex items-center justify-center font-bold text-[#3a2e18] dark:text-[#e8dcc0] text-sm"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`quick-modal-keypad-${label}`}
    >
      {label}
    </button>
  );

  const opKey = (label: string, op: CalcOperator, idx: number) => (
    <button
      key={label}
      onClick={() => {
        triggerHapticFeedback('light');
        playClickSound(1000);
        calc.pressOperator(op);
      }}
      className="font-hand aspect-[1.3] nb-blob-2 bg-[#e8dcc0] dark:bg-[#4a3f26] border-[1.6px] border-[#8a6a2a] dark:border-[#d4b878] flex items-center justify-center font-bold text-[#5a4014] dark:text-[#f0dca8] text-base"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`quick-modal-op-${label}`}
    >
      {label}
    </button>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm nb-ruled rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          style={{
            maxHeight: 'calc(100dvh - max(24px, env(safe-area-inset-top)) - 24px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          id="quick-entry-modal"
        >
          <div className="nb-binder" />
          <div className="nb-holes">
            <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
          </div>

          <div className="p-3 pl-6 space-y-1 ml-4">
            {/* Compact header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="w-4 h-4 text-orange-700 dark:text-orange-300 shrink-0" />
                <h3 className="font-hand text-base font-bold text-[#3a2e18] dark:text-white truncate">極速記帳</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-[#8a7a5a] hover:text-[#3a2e18] dark:hover:text-white transition-colors shrink-0"
                id="close-quick-modal-btn"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Receipt-style amount display */}
            <div
              className="bg-[#fdf8ec] dark:bg-[#221d12] border-2 border-[#3a2e18] dark:border-[#c9b98a] px-3 py-1.5 flex items-center justify-between"
              style={{ borderRadius: '180px 8px 180px 8px / 8px 180px 8px 180px', transform: 'rotate(-0.4deg)', boxShadow: '2px 2px 0 rgba(60,40,10,0.15)' }}
            >
              <span className="text-[#b08d57] dark:text-[#d4b878] font-bold text-sm font-hand">$</span>
              <span className="flex-1 text-right text-xl font-hand font-bold text-[#3a2e18] dark:text-white tabular-nums truncate">
                {calc.display || '0'}
              </span>
            </div>

            {/* Note */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註：便當、咖啡..."
              className="font-hand w-full px-2 py-0.5 bg-transparent text-[#5a4a2a] dark:text-[#d4c49a] text-xs border-b-[1.5px] border-dashed border-[#a08a5c] dark:border-[#8a7a5a] focus:border-amber-600 focus:outline-none placeholder:text-[#a08a5c]/70"
              id="quick-modal-note-input"
            />

            {/* Full calculator keypad */}
            <div className="grid grid-cols-4 gap-1 mt-0.5">
              {digitKey('7', '7', 0)}
              {digitKey('8', '8', 1)}
              {digitKey('9', '9', 2)}
              {opKey('÷', '÷', 3)}

              {digitKey('4', '4', 4)}
              {digitKey('5', '5', 5)}
              {digitKey('6', '6', 6)}
              {opKey('×', '×', 7)}

              {digitKey('1', '1', 8)}
              {digitKey('2', '2', 9)}
              {digitKey('3', '3', 10)}
              {opKey('−', '-', 0)}

              {digitKey('00', '00', 3)}
              {digitKey('0', '0', 6)}
              <button
                onClick={() => {
                  triggerHapticFeedback('medium');
                  playClickSound(500);
                  calc.clear();
                }}
                className="font-hand aspect-[1.3] nb-blob-3 bg-[#f5d6d6] dark:bg-[#4a2626] border-[1.6px] border-[#a33] dark:border-[#d47878] flex items-center justify-center font-bold text-[#7a1f1f] dark:text-[#f0a8a8] text-sm"
                style={{ transform: 'rotate(-1.5deg)' }}
                id="quick-modal-keypad-C"
              >
                C
              </button>
              {opKey('+', '+', 9)}
            </div>

            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => {
                  triggerHapticFeedback('light');
                  playClickSound(700);
                  calc.pressBackspace();
                }}
                className="font-hand nb-blob-4 bg-[#f5e0b8] dark:bg-[#4a3f1c] border-[1.6px] border-[#8a6a2a] dark:border-[#d4b878] flex items-center justify-center font-bold text-[#5a4014] dark:text-[#f0dca8] text-xs py-1.5"
                style={{ transform: 'rotate(-1deg)' }}
                id="quick-modal-backspace"
              >
                <Delete className="w-3.5 h-3.5 mx-auto" />
              </button>
              <button
                onClick={() => {
                  triggerHapticFeedback('medium');
                  playClickSound(1000);
                  calc.pressEquals();
                }}
                className="font-hand col-span-3 nb-blob-pill bg-[#c8e6c0] dark:bg-[#2e4a2a] border-[1.7px] border-[#2e5c26] dark:border-[#7ab86e] flex items-center justify-center font-bold text-[#2e5c26] dark:text-[#a8dba0] text-sm py-1.5"
                style={{ transform: 'rotate(0.5deg)' }}
                id="quick-modal-equals"
              >
                = 算一算
              </button>
            </div>

            {/* 2x2 quadrant sticky notes */}
            <div className="grid grid-cols-2 gap-1.5">
              {QUADRANT_LIST.map((qKey) => {
                const q = QUADRANT_CONFIGS[qKey];
                const s = QUADRANT_STICKY_STYLE[qKey];
                return (
                  <button
                    key={qKey}
                    onClick={() => handleQuadrantClick(qKey)}
                    className={`font-hand relative h-9 ${s.radius} text-center transition-all flex items-center justify-center`}
                    style={{ backgroundColor: s.bg, border: `1.6px solid ${s.border}`, transform: `rotate(${s.rotate})`, boxShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}
                    id={`quick-modal-quadrant-${qKey}`}
                  >
                    <div className="nb-tape" style={{ transform: `translateX(-50%) rotate(${s.rotate})` }} />
                    <span className="text-[11px] font-bold" style={{ color: s.text }}>
                      {q.title}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={handleLumpSumClick}
                className="font-hand flex-1 h-8 flex items-center justify-center gap-1 bg-[#d4c49a] dark:bg-[#4a3f26] border-[1.6px] border-dashed border-[#5a4a2a] dark:border-[#c9b98a] text-[#5a4a2a] dark:text-[#e8dcc0] text-[10px] font-bold"
                style={{ borderRadius: '180px 20px 180px 20px / 20px 180px 20px 180px' }}
                id="quick-modal-lump-sum-btn"
              >
                <PiggyBank className="w-3 h-3" /> 模糊概算補登
              </button>
              <button
                onClick={handleZeroSpendToday}
                className="font-hand flex-1 h-8 flex items-center justify-center gap-1 bg-[#bcd8f0] dark:bg-[#213c56] border-[1.6px] border-dashed border-[#1e4a78] text-[#1e4a78] dark:text-[#a8cdf0] text-[10px] font-bold"
                style={{ borderRadius: '20px 180px 20px 180px / 180px 20px 180px 20px' }}
                id="quick-modal-zero-spend-btn"
              >
                <Sparkles className="w-3 h-3" /> 今日 $0 支出
              </button>
            </div>
          </div>

          <AnimatePresence>
            {completedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`font-hand absolute left-3 right-3 bottom-3 p-2.5 rounded-2xl text-white text-[11px] font-bold flex items-center justify-between shadow-lg pointer-events-none ${
                  completedToast.isNewPB ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500' : 'bg-emerald-700'
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
