import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Delete, X, History, Check, RotateCcw, Mic, Clock3 } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';
import { useCalculator, CalcOperator } from '../lib/calculator';

interface WidgetDockProps {
  transactions: Transaction[];
  onDirectSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onOpenQuickModal: (source: string, initialAmount?: string, initialQuadrant?: QuadrantType) => void;
  onOpenVoiceModal: () => void;
  onOpenClassify: (tx: { id: string; amount: number; note?: string }) => void;
  todayTotal: number;
}

// Sticky-note look per quadrant: real photographed note + text/rotation only
// (the photo itself already has the color, curled corner, and shadow baked in)
const QUADRANT_STICKY_STYLE: Record<
  QuadrantType,
  { photoClass: string; text: string; darkText: string; rotate: string }
> = {
  NECESSARY_DAILY: { photoClass: 'nb-sticky-green', text: '#1e3a17', darkText: '#e8f5e0', rotate: '-1.5deg' },
  NECESSARY_URGENT: { photoClass: 'nb-sticky-blue', text: '#0f2d47', darkText: '#e8f2fa', rotate: '1deg' },
  UNNECESSARY_DAILY: { photoClass: 'nb-sticky-yellow', text: '#5c3d0a', darkText: '#fdf3d8', rotate: '1.5deg' },
  UNNECESSARY_URGENT: { photoClass: 'nb-sticky-red', text: '#5c1414', darkText: '#fce8e8', rotate: '-1deg' },
};

const KEYPAD_RING_CLASSES = ['nb-ring-1', 'nb-ring-2', 'nb-ring-3', 'nb-ring-4', 'nb-ring-5', 'nb-ring-6', 'nb-ring-7', 'nb-ring-8'];

const DIGIT_ROTATIONS = ['-2deg', '1.5deg', '-1deg', '1deg', '-1.5deg', '2deg', '-2deg', '1deg', '-1deg', '-1deg', '1.5deg'];

export const WidgetDock: React.FC<WidgetDockProps> = ({
  transactions,
  onDirectSave,
  onOpenVoiceModal,
  onOpenClassify,
  todayTotal,
}) => {
  const calc = useCalculator();
  const [noteStr, setNoteStr] = useState('');
  const [showError, setShowError] = useState(false);
  const [lastResult, setLastResult] = useState<{ label: string; durationSec?: string } | null>(null);

  // Auto-dismiss the floating note-paper toast after a couple of seconds.
  React.useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setLastResult(null), 2200);
    return () => clearTimeout(t);
  }, [lastResult]);
  const [selectedRecentIds, setSelectedRecentIds] = useState<Set<string>>(new Set());
  const [showRecentPicker, setShowRecentPicker] = useState(false);

  const startTimeRef = useRef<number | null>(null);

  const pendingClassifyTxs = useMemo(
    () => transactions.filter((t) => t.needs_classification).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    [transactions]
  );

  const recentCandidates = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return transactions
      .filter((t) => t.entry_date === yesterdayStr && !t.is_zero_spend && t.amount > 0)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 10);
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
    setShowRecentPicker(false);
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
      className={`font-hand h-9 nb-ring-photo ${KEYPAD_RING_CLASSES[idx % KEYPAD_RING_CLASSES.length]} flex items-center justify-center font-bold text-[#3a2e18] text-sm active:scale-95 transition-transform`}
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
      className={`font-hand h-9 nb-ring-photo ${KEYPAD_RING_CLASSES[idx % KEYPAD_RING_CLASSES.length]} flex items-center justify-center font-bold text-[#7a4a1a] text-base active:scale-95 transition-transform`}
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`keypad-op-${label}`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col nb-ruled text-[#3a2e18] rounded-3xl p-3 shadow-xl relative overflow-hidden">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      {/* Success / Error feedback — a floating note-paper toast anchored to the
          OUTER card (not the scrollable/offset inner content), so it's always
          properly centered and never gets clipped by inner overflow-y-auto. */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute left-1/2 top-14 z-30 w-[85%] max-w-[280px]"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div
              className="nb-note-photo nb-note-white relative px-4 py-3"
              style={{ filter: 'drop-shadow(2px 6px 10px rgba(0,0,0,0.4))' }}
            >
              <div className="font-hand flex items-center justify-between gap-2 text-xs text-[#2e5c26]">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-bold truncate">{lastResult.label}</span>
                  {lastResult.durationSec && <span className="font-mono shrink-0">{lastResult.durationSec}s</span>}
                </div>
                <button onClick={() => setLastResult(null)} className="shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col h-full min-h-0 gap-1.5 ml-4 overflow-y-auto">
        {/* Compact top bar: today's total */}
        <div className="flex items-center justify-between px-0.5 shrink-0">
          <span className="text-[11px] text-[#8a7a5a]">今日支出</span>
          <span className="text-base font-black font-mono text-[#4a3a20]">${todayTotal.toLocaleString()}</span>
        </div>

        {/* Voice entry — a real stamped-tag photo so it matches the rest of the
            paper/ink aesthetic instead of a flat modern gradient pill */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            triggerHapticFeedback('light');
            onOpenVoiceModal();
          }}
          className="font-hand nb-tag-photo nb-tag-stamp-lg w-full h-11 flex items-center justify-center gap-2 text-[#1e4a2e] shrink-0"
          id="widget-voice-entry-btn"
        >
          <Mic className="w-4 h-4" />
          <span className="text-sm font-bold">語音記帳（用講的）</span>
        </motion.button>

        {/* Pending "稍後分類" reminder */}
        {pendingClassifyTxs.length > 0 && (
          <button
            onClick={() => {
              const t = pendingClassifyTxs[0];
              onOpenClassify({ id: t.id, amount: t.amount, note: t.note });
            }}
            className="font-hand flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f5e0b8] border-[1.4px] border-dashed border-[#8a6a2a] text-[#5a4014] text-xs font-bold shrink-0 rounded-lg"
            id="widget-pending-classify-banner"
          >
            <Clock3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">還有 {pendingClassifyTxs.length} 筆待分類（點擊立即處理）</span>
          </button>
        )}

        {/* Amount display — a real white note-paper photo, matching the rest
            of the physical-object aesthetic instead of a flat CSS box */}
        <div
          className="nb-note-photo nb-note-white relative px-4 py-2.5 flex items-center justify-between shrink-0"
          style={{ transform: 'rotate(-0.3deg)' }}
        >
          <span className="text-[#b08d57] font-bold text-base font-hand">$</span>
          <span className="flex-1 text-right text-2xl font-hand font-bold text-[#3a2e18] tabular-nums truncate">
            {calc.display || '0'}
          </span>
          {showError && (
            <span className="font-hand absolute -top-2 right-3 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" /> 請先輸入金額
            </span>
          )}
        </div>

        {/* Note — bigger tap target so it isn't accidentally missed or fat-fingered */}
        <input
          type="text"
          value={noteStr}
          onChange={(e) => setNoteStr(e.target.value)}
          placeholder="備註：便當、咖啡..."
          className="font-hand w-full px-3 py-2 bg-transparent text-[#5a4a2a] text-sm border-b-[1.5px] border-dashed border-[#8a7454] focus:border-amber-700 focus:outline-none placeholder:text-[#a08a5c]/70 shrink-0"
          id="main-direct-note-input"
        />

        {/* Full calculator keypad: digits + operators + 00 + C + backspace + equals */}
        <div className="grid grid-cols-4 gap-1.5 shrink-0">
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
            className="font-hand h-9 nb-ring-photo nb-ring-3 flex items-center justify-center font-bold text-[#8a1f1f] text-sm active:scale-95 transition-transform"
            style={{ transform: 'rotate(-1.5deg)' }}
            id="keypad-btn-C"
          >
            C
          </button>
          {opKey('+', '+', 9)}
        </div>

        <div className="grid grid-cols-4 gap-1.5 shrink-0">
          <button
            onClick={() => {
              triggerHapticFeedback('light');
              playClickSound(700);
              clearFeedback();
              calc.pressBackspace();
            }}
            className="font-hand h-9 nb-ring-photo nb-ring-5 flex items-center justify-center font-bold text-[#5a4014] text-xs active:scale-95 transition-transform"
            style={{ transform: 'rotate(-1deg)' }}
            id="keypad-btn-backspace"
          >
            <Delete className="w-4 h-4 mx-auto" />
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('medium');
              playClickSound(1000);
              clearFeedback();
              calc.pressEquals();
            }}
            className="font-hand nb-tag-photo nb-tag-stamp-sm col-span-3 h-9 flex items-center justify-center font-bold text-[#1e4a2e] text-sm active:scale-95 transition-transform"
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
                className={`font-hand nb-sticky-photo ${s.photoClass} relative h-11 text-center transition-all flex items-center justify-center`}
                style={{ transform: `rotate(${s.rotate})` }}
                id={`quadrant-direct-btn-${qKey}`}
              >
                <span className="text-xs font-bold" style={{ color: s.text }}>
                  {q.title}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex gap-1.5 shrink-0">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLumpSumClick}
            className="font-hand nb-tag-photo nb-tag-1 flex-1 h-11 flex items-center justify-center text-[#4a3010]"
            id="lump-sum-confirm-btn"
          >
            <span className="text-[11px] font-bold">模糊概算</span>
          </motion.button>

          {/* Recent-reuse: a single button — tapping opens a picker instead of always
              showing the full list, so this doesn't compete for space day-to-day. */}
          {recentCandidates.length > 0 && (
            <button
              onClick={() => setShowRecentPicker(true)}
              className="font-hand nb-tag-photo nb-tag-2 flex-1 h-11 flex items-center justify-center gap-1 text-[#4a3010]"
              id="open-recent-reuse-picker-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">昨日複用（{recentCandidates.length}）</span>
            </button>
          )}
        </div>
      </div>

      {/* Recent-reuse picker (popup) */}
      <AnimatePresence>
        {showRecentPicker && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-xs nb-ruled rounded-3xl p-3 pl-5 relative max-h-[80%] flex flex-col"
            >
              <div className="flex items-center justify-between shrink-0 mb-2">
                <div className="font-hand flex items-center gap-1.5 text-sm font-bold text-[#3a2e18]">
                  <History className="w-4 h-4" />
                  <span>昨日紀錄快速複用（可多選）</span>
                </div>
                <button onClick={() => setShowRecentPicker(false)} className="text-[#8a7a5a] shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                {recentCandidates.map((t, i) => {
                  const isSelected = selectedRecentIds.has(t.id);
                  const qColor = t.quadrant ? QUADRANT_CONFIGS[t.quadrant].color : '#A8A29E';
                  const label = t.note || (t.quadrant ? QUADRANT_CONFIGS[t.quadrant].title : '模糊概算');
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleRecentSelect(t.id)}
                      className={`font-hand w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-[1.5px] transition-all shrink-0 ${
                        isSelected
                          ? 'bg-amber-400 border-amber-600 text-stone-900 font-bold'
                          : 'bg-[#fdf8ec] border-[#4a3a20] text-[#3a2e18]'
                      }`}
                      style={{ borderRadius: i % 2 === 0 ? '4px 12px 4px 12px' : '12px 4px 12px 4px' }}
                      id={`recent-reuse-chip-${t.id}`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: qColor }} />
                      )}
                      <span className="truncate flex-1 text-left">{label}</span>
                      <span className="font-mono font-bold shrink-0">${t.amount}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleApplySelectedRecent}
                disabled={selectedRecentTx.length === 0}
                className="font-hand w-full py-2.5 nb-blob-pill bg-[#f5dca0] border-[1.6px] border-[#8a6a2a] text-[#5a4014] font-bold text-sm shrink-0 mt-2 disabled:opacity-40"
                id="apply-selected-recent-btn"
              >
                {selectedRecentTx.length > 0
                  ? `套用所選 ${selectedRecentTx.length} 筆（共 $${selectedRecentTotal}）`
                  : '請先選擇要套用的紀錄'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
