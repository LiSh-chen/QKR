import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Delete, X } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';

interface WidgetDockProps {
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

export const WidgetDock: React.FC<WidgetDockProps> = ({ onDirectSave, onOpenQuickModal, todayTotal }) => {
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [showError, setShowError] = useState(false);
  const [lastResult, setLastResult] = useState<{
    amount: number;
    quadrantTitle: string;
    durationSec: string;
  } | null>(null);

  const startTimeRef = useRef<number | null>(null);

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

    // Digit key — cap length to avoid absurd amounts, no leading zeros
    setAmountStr((prev) => {
      const next = prev === '0' ? key : prev + key;
      return next.length > 7 ? prev : next;
    });
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

    setLastResult({ amount: amountNum, quadrantTitle: qConfig.title, durationSec });

    setAmountStr('');
    setNoteStr('');
    setShowError(false);
    startTimeRef.current = null;
  };

  return (
    <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950 text-white rounded-3xl p-3.5 shadow-xl border border-orange-900/40 relative overflow-hidden">
      <div className="relative z-10 space-y-2.5">
        {/* Compact top bar: today's total + inline feedback */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] text-orange-200/70">今日支出</span>
          <span className="text-base font-black font-mono text-white">${todayTotal.toLocaleString()}</span>
        </div>

        {/* Success / Error feedback (overlays, doesn't push layout) */}
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
                <span className="font-bold text-white">${lastResult.amount}</span>
                <span className="text-emerald-300 truncate">({lastResult.quadrantTitle})</span>
                <span className="font-mono text-emerald-400 shrink-0">{lastResult.durationSec}s</span>
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

        {/* Note (single compact line) */}
        <input
          type="text"
          value={noteStr}
          onChange={(e) => setNoteStr(e.target.value)}
          placeholder="備註（選填）：例如便當、咖啡"
          className="w-full px-3 py-1.5 bg-black/30 text-stone-200 text-xs rounded-xl border border-orange-900/40 focus:border-amber-500 focus:outline-none placeholder:text-stone-500"
          id="main-direct-note-input"
        />

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

        {/* 2x2 Quadrant grid — mirrors the actual axes:
            top row = 必要 (necessary), bottom row = 非必要 (unnecessary)
            left col = 日常 (daily),   right col = 臨時 (urgent) */}
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
      </div>
    </div>
  );
};
