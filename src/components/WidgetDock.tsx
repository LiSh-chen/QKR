import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Smartphone, Share2, CheckCircle2, AlertCircle, PlusCircle, X } from 'lucide-react';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { QuadrantType, Transaction } from '../types';
import { triggerHapticFeedback, playClickSound } from '../lib/storage';

interface WidgetDockProps {
  onDirectSave: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onOpenQuickModal: (source: string, initialAmount?: string, initialQuadrant?: QuadrantType) => void;
  todayTotal: number;
  currentStreak: number;
}

export const WidgetDock: React.FC<WidgetDockProps> = ({
  onDirectSave,
  onOpenQuickModal,
  todayTotal,
  currentStreak,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [showError, setShowError] = useState(false);
  const [lastResult, setLastResult] = useState<{
    amount: number;
    quadrantTitle: string;
    durationSec: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number | null>(null);

  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    if (!startTimeRef.current && val) {
      startTimeRef.current = performance.now();
    }
    if (showError) setShowError(false);
    if (lastResult) setLastResult(null);
  };

  const handlePresetAdd = (addNum: number) => {
    triggerHapticFeedback('light');
    playClickSound(800);
    if (!startTimeRef.current) startTimeRef.current = performance.now();

    const currentNum = parseFloat(amountStr) || 0;
    setAmountStr((currentNum + addNum).toString());
    if (showError) setShowError(false);
    if (lastResult) setLastResult(null);
  };

  const handleQuadrantDirectClick = (qKey: QuadrantType) => {
    const amountNum = parseFloat(amountStr);

    if (isNaN(amountNum) || amountNum <= 0) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      setShowError(true);
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    // Measure completion duration
    const start = startTimeRef.current || performance.now();
    const durationMs = Math.max(120, Math.round(performance.now() - start));
    const durationSec = (durationMs / 1000).toFixed(2);

    triggerHapticFeedback('success');
    playClickSound(1200);

    const qConfig = QUADRANT_CONFIGS[qKey];

    // Save transaction directly
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

    // Show success result with completion time
    setLastResult({
      amount: amountNum,
      quadrantTitle: qConfig.title,
      durationSec,
    });

    // Reset inputs
    setAmountStr('');
    setNoteStr('');
    setShowError(false);
    startTimeRef.current = null;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
      <div className="relative z-10 space-y-5">
        {/* Header Title & Today Spend */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-emerald-400" />
              直連快捷記帳
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              直接輸入金額，點擊象限立即記帳
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">今日支出</span>
            <div className="text-lg font-black text-white font-mono">${todayTotal.toLocaleString()}</div>
          </div>
        </div>

        {/* Saved Success Notification Banner */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">${lastResult.amount}</span>
                  <span className="ml-1 text-emerald-300">({lastResult.quadrantTitle})</span>
                  <span className="ml-2 font-mono text-[11px] bg-emerald-900/80 px-2 py-0.5 rounded-full text-emerald-300 border border-emerald-700">
                    記帳耗時 {lastResult.durationSec} 秒
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLastResult(null)}
                className="text-emerald-400 hover:text-white text-xs p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direct Amount & Note Input Section */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/80 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <label className="text-slate-300">1. 輸入金額：</label>
              {showError && (
                <span className="text-rose-400 font-bold text-xs flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" /> 請先輸入金額
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-lg font-mono">
                $
              </span>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className={`w-full pl-8 pr-10 py-3 bg-slate-950 text-white font-mono font-bold text-xl rounded-xl border focus:outline-none transition-colors ${
                  showError
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
                id="main-direct-amount-input"
              />
              {amountStr && (
                <button
                  onClick={() => {
                    setAmountStr('');
                    setShowError(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
              {[50, 100, 150, 200, 500].map((addVal) => (
                <button
                  key={addVal}
                  onClick={() => handlePresetAdd(addVal)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold border border-slate-700 transition-colors whitespace-nowrap"
                >
                  +${addVal}
                </button>
              ))}
              {amountStr && (
                <button
                  onClick={() => setAmountStr('')}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-mono text-xs font-bold border border-rose-800 transition-colors whitespace-nowrap"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">2. 備註 (選填)：</label>
            <input
              type="text"
              value={noteStr}
              onChange={(e) => setNoteStr(e.target.value)}
              placeholder="例如：便當、美式咖啡、計程車"
              className="w-full px-3 py-2 bg-slate-950 text-slate-200 text-xs rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
              id="main-direct-note-input"
            />
          </div>
        </div>

        {/* 2x2 Direct Quadrant Action Buttons — laid out to mirror the actual quadrant axes:
            top row = 必要 (necessary), bottom row = 非必要 (unnecessary)
            left col = 日常 (daily),   right col = 臨時 (urgent) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">
            3. 點擊分類象限，直接完成記帳：
          </label>

          <div className="relative">
            {/* Axis labels */}
            <div className="flex justify-between text-[9px] font-bold text-slate-500 px-1 mb-1">
              <span>&larr; 日常</span>
              <span>臨時 &rarr;</span>
            </div>
            <div className="flex items-stretch gap-1">
              <div className="flex flex-col justify-around items-center text-[9px] font-bold text-slate-500 shrink-0 w-3">
                <span className="[writing-mode:vertical-rl] rotate-180">必要 ↑</span>
                <span className="[writing-mode:vertical-rl] rotate-180">非必要 ↓</span>
              </div>
              <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1">
                {QUADRANT_LIST.map((qKey) => {
                  const q = QUADRANT_CONFIGS[qKey];
                  return (
                    <motion.button
                      key={qKey}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleQuadrantDirectClick(qKey)}
                      className="aspect-square sm:aspect-auto sm:min-h-[92px] p-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 text-center transition-all group flex flex-col items-center justify-center gap-1 shadow-md"
                      id={`quadrant-direct-btn-${qKey}`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: q.color }}
                      />
                      <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors leading-tight">
                        {q.title}
                      </span>
                      <p className="text-[9px] text-slate-400 leading-tight line-clamp-2">
                        {q.subTitle}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Streak & Mobile App Tips */}
        <div className="bg-slate-900/70 p-3 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span>連續記帳天數：</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{currentStreak} 天 🔥</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>支援 Android 桌面 / 鎖定畫面 Widget 直連號召</span>
          </div>
        </div>
      </div>
    </div>
  );
};



