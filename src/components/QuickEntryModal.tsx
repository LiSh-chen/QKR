import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Delete, Sparkles } from 'lucide-react';
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
import { RoughBox } from './RoughBox';

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

const QUADRANT_INK: Record<QuadrantType, string> = {
  NECESSARY_DAILY: '#2e5c26',
  NECESSARY_URGENT: '#1e4a78',
  UNNECESSARY_DAILY: '#7a5314',
  UNNECESSARY_URGENT: '#7a2020',
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
      note: note.trim() || (isLumpSum ? '不分類記帳' : ''),
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
    <RoughBox
      key={label}
      shape="ellipse"
      stroke="#3a2e18"
      strokeWidth={1.5}
      roughness={2.1}
      onClick={() => {
        triggerHapticFeedback('light');
        playClickSound(900);
        calc.pressDigit(value);
      }}
      className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#3a2e18] text-xs cursor-pointer"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`quick-modal-keypad-${label}`}
    >
      {label}
    </RoughBox>
  );

  const opKey = (label: string, op: CalcOperator, idx: number) => (
    <RoughBox
      key={label}
      shape="ellipse"
      stroke="#7a4a1a"
      strokeWidth={1.5}
      roughness={2.1}
      onClick={() => {
        triggerHapticFeedback('light');
        playClickSound(1000);
        calc.pressOperator(op);
      }}
      className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#7a4a1a] text-sm cursor-pointer"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`quick-modal-op-${label}`}
    >
      {label}
    </RoughBox>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="w-4 h-4 text-orange-700 shrink-0" />
                <h3 className="font-hand pencil-text text-base font-bold text-[#3a2e18] truncate">極速記帳</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-[#8a7a5a] hover:text-[#3a2e18] transition-colors shrink-0"
                id="close-quick-modal-btn"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <RoughBox
              shape="rectangle"
              stroke="#3a2e18"
              strokeWidth={1.8}
              roughness={1.6}
              className="relative px-3 py-1.5 flex items-center justify-between"
              style={{ transform: 'rotate(-0.3deg)' }}
            >
              <span className="text-[#b08d57] font-bold text-sm font-hand pencil-text">$</span>
              <span className="flex-1 text-right text-xl font-hand pencil-text font-bold text-[#3a2e18] tabular-nums truncate">
                {calc.display || '0'}
              </span>
            </RoughBox>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註：便當、咖啡..."
              className="font-hand pencil-text w-full px-2 py-0.5 bg-transparent text-[#5a4a2a] text-xs border-b-[1.5px] border-dashed border-[#8a7454] focus:border-amber-700 focus:outline-none placeholder:text-[#a08a5c]/70"
              id="quick-modal-note-input"
            />

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
              <RoughBox
                shape="ellipse"
                stroke="#8a1f1f"
                strokeWidth={1.6}
                roughness={2.2}
                onClick={() => {
                  triggerHapticFeedback('medium');
                  playClickSound(500);
                  calc.clear();
                }}
                className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#8a1f1f] text-xs cursor-pointer"
                style={{ transform: 'rotate(-1.5deg)' }}
                id="quick-modal-keypad-C"
              >
                C
              </RoughBox>
              {opKey('+', '+', 9)}
            </div>

            <div className="grid grid-cols-4 gap-1">
              <RoughBox
                shape="ellipse"
                stroke="#7a4a1a"
                strokeWidth={1.5}
                roughness={2}
                onClick={() => {
                  triggerHapticFeedback('light');
                  playClickSound(700);
                  calc.pressBackspace();
                }}
                className="font-hand h-9 flex items-center justify-center font-bold text-[#7a4a1a] cursor-pointer"
                style={{ transform: 'rotate(-1deg)' }}
                id="quick-modal-backspace"
              >
                <Delete className="w-3.5 h-3.5 mx-auto" />
              </RoughBox>
              <RoughBox
                shape="rectangle"
                stroke="#2e5c26"
                strokeWidth={1.8}
                roughness={1.8}
                fill="#2e5c2622"
                fillStyle="hachure"
                hachureGap={4}
                onClick={() => {
                  triggerHapticFeedback('medium');
                  playClickSound(1000);
                  calc.pressEquals();
                }}
                className="font-hand pencil-text col-span-3 h-8 flex items-center justify-center font-bold text-[#2e5c26] text-xs cursor-pointer"
                id="quick-modal-equals"
              >
                = 算一算
              </RoughBox>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {QUADRANT_LIST.map((qKey, i) => {
                const q = QUADRANT_CONFIGS[qKey];
                const ink = QUADRANT_INK[qKey];
                const rotate = ['-1.2deg', '1deg', '1.2deg', '-1deg'][i];
                return (
                  <RoughBox
                    key={qKey}
                    shape="rectangle"
                    stroke={ink}
                    strokeWidth={1.8}
                    roughness={1.8}
                    fill={`${ink}22`}
                    fillStyle="hachure"
                    hachureGap={4}
                    hachureAngle={i % 2 === 0 ? 45 : -45}
                    onClick={() => handleQuadrantClick(qKey)}
                    className="font-hand pencil-text relative h-9 text-center flex items-center justify-center cursor-pointer"
                    style={{ transform: `rotate(${rotate})` }}
                    id={`quick-modal-quadrant-${qKey}`}
                  >
                    <span className="text-[11px] font-bold" style={{ color: ink }}>
                      {q.title}
                    </span>
                  </RoughBox>
                );
              })}
            </div>

            <div className="flex gap-1.5">
              <RoughBox
                shape="rectangle"
                stroke="#5a4a2a"
                strokeWidth={1.5}
                roughness={1.8}
                onClick={handleLumpSumClick}
                className="font-hand pencil-text flex-1 h-9 flex items-center justify-center gap-1 text-[#5a4a2a] text-[10px] font-bold cursor-pointer"
                id="quick-modal-lump-sum-btn"
              >
                不分類補登
              </RoughBox>
              <RoughBox
                shape="rectangle"
                stroke="#1e4a78"
                strokeWidth={1.5}
                roughness={1.8}
                onClick={handleZeroSpendToday}
                className="font-hand pencil-text flex-1 h-8 flex items-center justify-center gap-1 text-[#1e4a78] text-[10px] font-bold cursor-pointer"
                id="quick-modal-zero-spend-btn"
              >
                <Sparkles className="w-3 h-3" /> 今日 $0 支出
              </RoughBox>
            </div>
          </div>

          <AnimatePresence>
            {completedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`font-hand pencil-text absolute left-3 right-3 bottom-3 p-2.5 rounded-2xl text-white text-[11px] font-bold flex items-center justify-between shadow-lg pointer-events-none ${
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
