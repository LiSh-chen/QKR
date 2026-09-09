import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Delete, X, History, Check, RotateCcw, Mic, Clock3 } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';
import { useCalculator, CalcOperator } from '../lib/calculator';
import { RoughBox } from './RoughBox';

interface WidgetDockProps {
  transactions: Transaction[];
  onDirectSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onOpenQuickModal: (source: string, initialAmount?: string, initialQuadrant?: QuadrantType) => void;
  onOpenVoiceModal: () => void;
  onOpenClassify: (tx: { id: string; amount: number; note?: string }) => void;
  todayTotal: number;
}

const QUADRANT_INK: Record<QuadrantType, string> = {
  NECESSARY_DAILY: '#2e5c26',
  NECESSARY_URGENT: '#1e4a78',
  UNNECESSARY_DAILY: '#7a5314',
  UNNECESSARY_URGENT: '#7a2020',
};

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
    <RoughBox
      key={label}
      shape="ellipse"
      stroke="#3a2e18"
      strokeWidth={1.6}
      roughness={2.1}
      onClick={() => {
        markStart();
        triggerHapticFeedback('light');
        playClickSound(800);
        clearFeedback();
        calc.pressDigit(value);
      }}
      className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#3a2e18] text-sm cursor-pointer"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`keypad-btn-${label}`}
    >
      {label}
    </RoughBox>
  );

  const opKey = (label: string, op: CalcOperator, idx: number) => (
    <RoughBox
      key={label}
      shape="ellipse"
      stroke="#7a4a1a"
      strokeWidth={1.6}
      roughness={2.1}
      onClick={() => {
        markStart();
        triggerHapticFeedback('light');
        playClickSound(900);
        clearFeedback();
        calc.pressOperator(op);
      }}
      className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#7a4a1a] text-base cursor-pointer"
      style={{ transform: `rotate(${DIGIT_ROTATIONS[idx]})` }}
      id={`keypad-op-${label}`}
    >
      {label}
    </RoughBox>
  );

  return (
    <div className="h-full flex flex-col nb-ruled text-[#3a2e18] rounded-3xl p-3 shadow-xl relative overflow-hidden">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute left-1/2 top-14 z-30 w-[85%] max-w-[280px]"
            style={{ transform: 'translateX(-50%)' }}
          >
            <RoughBox
              shape="rectangle"
              stroke="#2e5c26"
              strokeWidth={2}
              roughness={1.8}
              fill="#f1e9d2"
              fillStyle="solid"
              className="relative px-4 py-3"
              style={{ filter: 'drop-shadow(2px 6px 10px rgba(0,0,0,0.4))' }}
            >
              <div className="font-hand pencil-text flex items-center justify-between gap-2 text-xs text-[#2e5c26]">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-bold truncate">{lastResult.label}</span>
                  {lastResult.durationSec && <span className="font-mono shrink-0">{lastResult.durationSec}s</span>}
                </div>
                <button onClick={() => setLastResult(null)} className="shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </RoughBox>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col h-full min-h-0 gap-1.5 ml-4 overflow-y-auto">
        <div className="flex items-center justify-between px-0.5 shrink-0">
          <span className="font-hand pencil-text text-[11px] text-[#8a7a5a]">今日支出</span>
          <span className="font-hand pencil-text text-base font-black font-mono text-[#4a3a20]">${todayTotal.toLocaleString()}</span>
        </div>

        <RoughBox
          shape="rectangle"
          stroke="#c9683c"
          strokeWidth={2.2}
          roughness={2}
          fill="#c9683c15"
          fillStyle="hachure"
          hachureGap={5}
          onClick={() => {
            triggerHapticFeedback('light');
            onOpenVoiceModal();
          }}
          className="font-hand pencil-text w-full h-11 flex items-center justify-center gap-2 text-[#7a3d14] shrink-0 cursor-pointer"
          id="widget-voice-entry-btn"
        >
          <Mic className="w-4 h-4" />
          <span className="text-sm font-bold">語音記帳（用講的）</span>
        </RoughBox>

        {pendingClassifyTxs.length > 0 && (
          <button
            onClick={() => {
              const t = pendingClassifyTxs[0];
              onOpenClassify({ id: t.id, amount: t.amount, note: t.note });
            }}
            className="font-hand pencil-text flex items-center gap-1.5 px-2.5 py-1.5 border-[1.4px] border-dashed border-[#8a6a2a] text-[#5a4014] text-xs font-bold shrink-0 rounded-lg"
            id="widget-pending-classify-banner"
          >
            <Clock3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">還有 {pendingClassifyTxs.length} 筆待分類（點擊立即處理）</span>
          </button>
        )}

        <RoughBox
          shape="rectangle"
          stroke={showError ? '#c0392b' : '#3a2e18'}
          strokeWidth={2}
          roughness={1.6}
          className="relative px-4 py-2.5 flex items-center justify-between shrink-0"
          style={{ transform: 'rotate(-0.3deg)' }}
        >
          <span className="text-[#b08d57] font-bold text-base font-hand pencil-text">$</span>
          <span className="flex-1 text-right text-2xl font-hand pencil-text font-bold text-[#3a2e18] tabular-nums truncate">
            {calc.display || '0'}
          </span>
          {showError && (
            <span className="font-hand pencil-text absolute -top-2 right-3 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" /> 請先輸入金額
            </span>
          )}
        </RoughBox>

        <input
          type="text"
          value={noteStr}
          onChange={(e) => setNoteStr(e.target.value)}
          placeholder="備註：便當、咖啡..."
          className="font-hand pencil-text w-full px-3 py-2 bg-transparent text-[#5a4a2a] text-sm border-b-[1.5px] border-dashed border-[#8a7454] focus:border-amber-700 focus:outline-none placeholder:text-[#a08a5c]/70 shrink-0"
          id="main-direct-note-input"
        />

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
          <RoughBox
            shape="ellipse"
            stroke="#8a1f1f"
            strokeWidth={1.8}
            roughness={2.2}
            onClick={() => {
              triggerHapticFeedback('medium');
              playClickSound(500);
              clearFeedback();
              calc.clear();
              startTimeRef.current = null;
            }}
            className="font-hand pencil-text h-9 flex items-center justify-center font-bold text-[#8a1f1f] text-sm cursor-pointer"
            style={{ transform: 'rotate(-1.5deg)' }}
            id="keypad-btn-C"
          >
            C
          </RoughBox>
          {opKey('+', '+', 9)}
        </div>

        <div className="grid grid-cols-4 gap-1.5 shrink-0">
          <RoughBox
            shape="ellipse"
            stroke="#5a4014"
            strokeWidth={1.6}
            roughness={2}
            onClick={() => {
              triggerHapticFeedback('light');
              playClickSound(700);
              clearFeedback();
              calc.pressBackspace();
            }}
            className="font-hand h-9 flex items-center justify-center font-bold text-[#5a4014] cursor-pointer"
            style={{ transform: 'rotate(-1deg)' }}
            id="keypad-btn-backspace"
          >
            <Delete className="w-4 h-4 mx-auto" />
          </RoughBox>
          <RoughBox
            shape="rectangle"
            stroke="#2e5c26"
            strokeWidth={2}
            roughness={1.8}
            fill="#2e5c2622"
            fillStyle="hachure"
            hachureGap={4}
            onClick={() => {
              triggerHapticFeedback('medium');
              playClickSound(1000);
              clearFeedback();
              calc.pressEquals();
            }}
            className="font-hand pencil-text col-span-3 h-9 flex items-center justify-center font-bold text-[#2e5c26] text-sm cursor-pointer"
            id="keypad-btn-equals"
          >
            = 算一算
          </RoughBox>
        </div>

        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          {QUADRANT_LIST.map((qKey, i) => {
            const q = QUADRANT_CONFIGS[qKey];
            const ink = QUADRANT_INK[qKey];
            const rotate = ['-1.2deg', '1deg', '1.2deg', '-1deg'][i];
            return (
              <RoughBox
                key={qKey}
                shape="rectangle"
                stroke={ink}
                strokeWidth={2}
                roughness={1.8}
                fill={`${ink}22`}
                fillStyle="hachure"
                hachureGap={4}
                hachureAngle={i % 2 === 0 ? 45 : -45}
                onClick={() => handleQuadrantDirectClick(qKey)}
                className="font-hand pencil-text relative h-11 text-center flex items-center justify-center cursor-pointer"
                style={{ transform: `rotate(${rotate})` }}
                id={`quadrant-direct-btn-${qKey}`}
              >
                <span className="text-xs font-bold" style={{ color: ink }}>
                  {q.title}
                </span>
              </RoughBox>
            );
          })}
        </div>

        <div className="flex gap-1.5 shrink-0">
          <RoughBox
            shape="rectangle"
            stroke="#5a4a2a"
            strokeWidth={1.6}
            roughness={1.8}
            onClick={handleLumpSumClick}
            className="font-hand pencil-text flex-1 h-11 flex items-center justify-center text-[#5a4a2a] cursor-pointer"
            id="lump-sum-confirm-btn"
          >
            <span className="text-[11px] font-bold">模糊概算</span>
          </RoughBox>

          {recentCandidates.length > 0 && (
            <RoughBox
              shape="rectangle"
              stroke="#3a2e18"
              strokeWidth={1.6}
              roughness={1.8}
              onClick={() => setShowRecentPicker(true)}
              className="font-hand pencil-text flex-1 h-11 flex items-center justify-center gap-1 text-[#3a2e18] cursor-pointer"
              id="open-recent-reuse-picker-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">昨日複用（{recentCandidates.length}）</span>
            </RoughBox>
          )}
        </div>
      </div>

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
                <div className="font-hand pencil-text flex items-center gap-1.5 text-sm font-bold text-[#3a2e18]">
                  <History className="w-4 h-4" />
                  <span>昨日紀錄快速複用（可多選）</span>
                </div>
                <button onClick={() => setShowRecentPicker(false)} className="text-[#8a7a5a] shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                {recentCandidates.map((t) => {
                  const isSelected = selectedRecentIds.has(t.id);
                  const qColor = t.quadrant ? QUADRANT_CONFIGS[t.quadrant].color : '#A8A29E';
                  const label = t.note || (t.quadrant ? QUADRANT_CONFIGS[t.quadrant].title : '模糊概算');
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleRecentSelect(t.id)}
                      className={`font-hand pencil-text w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-[1.5px] rounded-xl transition-all shrink-0 ${
                        isSelected ? 'bg-amber-400 border-amber-600 text-stone-900 font-bold' : 'bg-[#fdf8ec] border-[#4a3a20] text-[#3a2e18]'
                      }`}
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
                className="font-hand pencil-text w-full py-2.5 rounded-full bg-[#f5dca0] border-[1.6px] border-[#8a6a2a] text-[#5a4014] font-bold text-sm shrink-0 mt-2 disabled:opacity-40"
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
