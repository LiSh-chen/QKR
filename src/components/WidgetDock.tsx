import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Delete, X, History, Check, PiggyBank } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';
import { useCalculator, CalcOperator } from '../lib/calculator';

interface WidgetDockProps {
  transactions: Transaction[];
  onDirectSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onOpenQuickModal: (source: string, initialAmount?: string, initialQuadrant?: QuadrantType) => void;
  todayTotal: number;
  currentStreak: number;
}

// Sticky-note look per quadrant: fill / border / text color / tape rotation / card rotation
const QUADRANT_STICKY_STYLE: Record<
  QuadrantType,
  { bg: string; darkBg: string; border: string; text: string; darkText: string; rotate: string; radius: string }
> = {
  NECESSARY_DAILY: { bg: '#c8e6c0', darkBg: '#2e4a2a', border: '#2e5c26', text: '#2e5c26', darkText: '#a8dba0', rotate: '-1.5deg', radius: 'nb-blob-sticky-a' },
  NECESSARY_URGENT: { bg: '#bcd8f0', darkBg: '#213c56', border: '#1e4a78', text: '#1e4a78', darkText: '#a8cdf0', rotate: '1deg', radius: 'nb-blob-sticky-b' },
  UNNECESSARY_DAILY: { bg: '#f5dca0', darkBg: '#5c451c', border: '#7a5314', text: '#7a5314', darkText: '#f0cf8a', rotate: '1.5deg', radius: 'nb-blob-sticky-a' },
  UNNECESSARY_URGENT: { bg: '#f0b8b8', darkBg: '#5c2626', border: '#7a2020', text: '#7a2020', darkText: '#f0a8a8', rotate: '-1deg', radius: 'nb-blob-sticky-b' },
};

const DIGIT_ROTATIONS = ['-2deg', '1.5deg', '-1deg', '1deg', '-1.5deg', '2deg', '-2deg', '1deg', '-1deg', '-1deg', '1.5deg'];

export const WidgetDock: React.FC<WidgetDockProps> = ({ transactions, onDirectSave, todayTotal }) => {
  const calc = useCalculator();
  const [noteStr, setNoteStr] = useState('');
  const [showError, setShowError] = useState(false);
  const [lastResult, setLastResult] = useState<{ label: string; durationSec?: string } | null>(null);
  const [selectedRecentIds, setSelectedRecentIds] = useState<Set<string>>(new Set());

  const startTimeRef = useRef<number | null>(null);

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

  const markStart = () => {
    if (!startTimeRef.current) startTimeRef.current = performance.now();
  };

  const resetEntryState = () => {
    calc.clear();
    setNoteStr('');
    setShowError(false);
    startTimeRef.current = null;
  };

  const requireValidAmount = (): number | null => {
    const amountNum = calc.getEvaluatedAmount();
    if (isNaN(amountNum) || amountNum <= 0) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      setShowError(true);
      return null;
    }
    return amountNum;
  };

  const handleQuadrantDirectClick = (qKey: QuadrantType) => {
    const amountNum = requireValidAmount();
    if (amountNum === null) return;

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

  const handleLumpSumClick = () => {
    const amountNum = requireValidAmount();
    if (amountNum === null) return;

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
      entry_method: 'lump_sum',
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

  const digitKey = (label: string, value: Parameters<typeof calc.pressDigit>[0], idx: number) => (
    <button
      key={label}
      onClick={() => {
        markStart();
        triggerHapticFeedback('light');
        playClickSound(800);
        clearFeedback();
        calc.pressDigit(value);
      }}
      className="font-hand aspect-[1.3] nb-blob-1 bg-[#fefaf0] dark:bg-[#3a3120] border-[1.6px] border-[#4a3a20] dark:border-[#c9b98a] flex items-center justify-center font-bold text-[#3a2e18] dark:text-[#e8dcc0] text-sm"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`keypad-btn-${label}`}
    >
      {label}
    </button>
  );

  const opKey = (label: string, op: CalcOperator, idx: number) => (
    <button
      key={label}
      onClick={() => {
        markStart();
        triggerHapticFeedback('light');
        playClickSound(900);
        clearFeedback();
        calc.pressOperator(op);
      }}
      className="font-hand aspect-[1.3] nb-blob-2 bg-[#e8dcc0] dark:bg-[#4a3f26] border-[1.6px] border-[#8a6a2a] dark:border-[#d4b878] flex items-center justify-center font-bold text-[#5a4014] dark:text-[#f0dca8] text-base"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`keypad-op-${label}`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col nb-ruled text-[#3a2e18] dark:text-[#e8dcc0] rounded-3xl p-3 shadow-xl relative overflow-hidden">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0 gap-1 ml-4">
        {/* Compact top bar: today's total */}
        <div className="flex items-center justify-between px-0.5 shrink-0">
          <span className="text-[11px] text-[#8a7a5a] dark:text-[#b8a878]">今日支出</span>
          <span className="text-base font-black font-mono text-[#4a3a20] dark:text-white">${todayTotal.toLocaleString()}</span>
        </div>

        {/* Success / Error feedback */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="font-hand bg-[#c8e6c0] dark:bg-[#2e4a2a] border-[1.6px] border-[#2e5c26] text-[#2e5c26] dark:text-[#a8dba0] rounded-xl px-3 py-1 flex items-center justify-between gap-2 text-[11px] shrink-0 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold truncate">{lastResult.label}</span>
                {lastResult.durationSec && <span className="font-mono shrink-0">{lastResult.durationSec}s</span>}
              </div>
              <button onClick={() => setLastResult(null)} className="shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt-style amount display */}
        <div
          className={`relative bg-[#fdf8ec] dark:bg-[#221d12] border-2 px-3 py-1.5 flex items-center justify-between shrink-0 transition-colors ${
            showError ? 'border-rose-500' : 'border-[#3a2e18] dark:border-[#c9b98a]'
          }`}
          style={{ borderRadius: '180px 8px 180px 8px / 8px 180px 8px 180px', transform: 'rotate(-0.4deg)', boxShadow: '2px 2px 0 rgba(60,40,10,0.15)' }}
        >
          <span className="text-[#b08d57] dark:text-[#d4b878] font-bold text-sm font-hand">$</span>
          <span className="flex-1 text-right text-xl font-hand font-bold text-[#3a2e18] dark:text-white tabular-nums truncate">
            {calc.display || '0'}
          </span>
          {showError && (
            <span className="font-hand absolute -top-2 right-3 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" /> 請先輸入金額
            </span>
          )}
        </div>

        {/* Note (single compact line) */}
        <input
          type="text"
          value={noteStr}
          onChange={(e) => setNoteStr(e.target.value)}
          placeholder="備註：便當、咖啡..."
          className="font-hand w-full px-2 py-0.5 bg-transparent text-[#5a4a2a] dark:text-[#d4c49a] text-xs border-b-[1.5px] border-dashed border-[#a08a5c] dark:border-[#8a7a5a] focus:border-amber-600 focus:outline-none placeholder:text-[#a08a5c]/70 shrink-0"
          id="main-direct-note-input"
        />

        {/* Full calculator keypad: digits + operators + 00 + C + backspace + equals */}
        <div className="grid grid-cols-4 gap-1 shrink-0 mt-0.5">
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
              clearFeedback();
              calc.clear();
              startTimeRef.current = null;
            }}
            className="font-hand aspect-[1.3] nb-blob-3 bg-[#f5d6d6] dark:bg-[#4a2626] border-[1.6px] border-[#a33] dark:border-[#d47878] flex items-center justify-center font-bold text-[#7a1f1f] dark:text-[#f0a8a8] text-sm"
            style={{ transform: 'rotate(-1.5deg)' }}
            id="keypad-btn-C"
          >
            C
          </button>
          {opKey('+', '+', 9)}
        </div>

        <div className="grid grid-cols-4 gap-1 shrink-0 mb-0.5">
          <button
            onClick={() => {
              triggerHapticFeedback('light');
              playClickSound(700);
              clearFeedback();
              calc.pressBackspace();
            }}
            className="font-hand nb-blob-4 bg-[#f5e0b8] dark:bg-[#4a3f1c] border-[1.6px] border-[#8a6a2a] dark:border-[#d4b878] flex items-center justify-center font-bold text-[#5a4014] dark:text-[#f0dca8] text-xs py-1.5"
            style={{ transform: 'rotate(-1deg)' }}
            id="keypad-btn-backspace"
          >
            <Delete className="w-3.5 h-3.5 mx-auto" />
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('medium');
              playClickSound(1000);
              clearFeedback();
              calc.pressEquals();
            }}
            className="font-hand col-span-3 nb-blob-pill bg-[#c8e6c0] dark:bg-[#2e4a2a] border-[1.7px] border-[#2e5c26] dark:border-[#7ab86e] flex items-center justify-center font-bold text-[#2e5c26] dark:text-[#a8dba0] text-sm py-1.5"
            style={{ transform: 'rotate(0.5deg)' }}
            id="keypad-btn-equals"
          >
            = 算一算
          </button>
        </div>

        {/* 2x2 Quadrant sticky notes + a dedicated lump-sum button */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          {QUADRANT_LIST.map((qKey) => {
            const q = QUADRANT_CONFIGS[qKey];
            const s = QUADRANT_STICKY_STYLE[qKey];
            return (
              <motion.button
                key={qKey}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleQuadrantDirectClick(qKey)}
                className={`font-hand relative h-9 ${s.radius} text-center transition-all flex items-center justify-center`}
                style={{
                  backgroundColor: s.bg,
                  border: `1.6px solid ${s.border}`,
                  transform: `rotate(${s.rotate})`,
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.2)',
                }}
                id={`quadrant-direct-btn-${qKey}`}
              >
                <div className="nb-tape" style={{ transform: `translateX(-50%) rotate(${s.rotate})` }} />
                <span className="text-[11px] font-bold" style={{ color: s.text }}>
                  {q.title}
                </span>
              </motion.button>
            );
          })}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLumpSumClick}
            className="font-hand col-span-2 h-8 flex items-center justify-center gap-1.5 bg-[#d4c49a] dark:bg-[#4a3f26] border-[1.6px] border-dashed border-[#5a4a2a] dark:border-[#c9b98a] text-[#5a4a2a] dark:text-[#e8dcc0]"
            style={{ borderRadius: '180px 20px 180px 20px / 20px 180px 20px 180px', transform: 'rotate(0.5deg)' }}
            id="lump-sum-confirm-btn"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">模糊概算補登（不分象限）</span>
          </motion.button>
        </div>

        {/* Yesterday's records — quick reuse (multi-select), its own scroll region only */}
        {recentCandidates.length > 0 && (
          <div className="pt-1 border-t-[1.5px] border-dashed border-[#a08a5c] dark:border-[#8a7a5a] flex-1 min-h-0 flex flex-col gap-1">
            <div className="font-hand flex items-center gap-1.5 text-[10px] font-bold text-[#7a6a4a] dark:text-[#b8a878] shrink-0">
              <History className="w-3 h-3" />
              <span>昨日紀錄快速複用（可多選）</span>
            </div>

            <div className="flex flex-wrap gap-1 overflow-y-auto flex-1 min-h-0 content-start">
              {recentCandidates.map((t, i) => {
                const isSelected = selectedRecentIds.has(t.id);
                const qColor = t.quadrant ? QUADRANT_CONFIGS[t.quadrant].color : '#A8A29E';
                const label = t.note || (t.quadrant ? QUADRANT_CONFIGS[t.quadrant].title : '模糊概算');
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleRecentSelect(t.id)}
                    className={`font-hand flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border-[1.5px] transition-all shrink-0 ${
                      isSelected
                        ? 'bg-amber-400 border-amber-600 text-stone-900 font-bold'
                        : 'bg-[#fdf8ec] dark:bg-[#221d12] border-[#4a3a20] dark:border-[#c9b98a] text-[#3a2e18] dark:text-[#e8dcc0]'
                    }`}
                    style={{ borderRadius: i % 2 === 0 ? '3px 8px 3px 8px' : '8px 3px 8px 3px', transform: `rotate(${i % 2 === 0 ? '-1.5deg' : '1.5deg'})` }}
                    id={`recent-reuse-chip-${t.id}`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: qColor }} />
                    )}
                    <span className="truncate max-w-[80px]">{label}</span>
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
                  className="font-hand w-full py-1.5 nb-blob-pill bg-[#f5dca0] dark:bg-[#5c451c] border-[1.6px] border-[#8a6a2a] text-[#5a4014] dark:text-[#f0dca8] font-bold text-xs shrink-0"
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
