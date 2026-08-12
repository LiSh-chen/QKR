import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, AlertCircle, PieChart, TrendingUp, Sparkles, Info, HelpCircle } from 'lucide-react';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';

interface QuadrantMatrixViewProps {
  transactions: Transaction[];
  onOpenQuickModalWithQuadrant?: (q: QuadrantType) => void;
}

export const QuadrantMatrixView: React.FC<QuadrantMatrixViewProps> = ({
  transactions,
  onOpenQuickModalWithQuadrant,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'this_month' | 'all'>('this_month');

  // Filter transactions
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filteredTx = transactions.filter((tx) => {
    if (selectedPeriod === 'this_month') {
      return tx.entry_date && tx.entry_date.startsWith(currentMonthPrefix);
    }
    return true;
  });

  // Totals
  const totalSpend = filteredTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Quadrant Totals (excluding lump sum & zero spend)
  const quadrantSums: Record<QuadrantType, number> = {
    NECESSARY_DAILY: 0,
    NECESSARY_URGENT: 0,
    UNNECESSARY_DAILY: 0,
    UNNECESSARY_URGENT: 0,
  };

  let lumpSumTotal = 0;
  let lumpSumCount = 0;

  filteredTx.forEach((tx) => {
    if (tx.is_lump_sum) {
      lumpSumTotal += tx.amount || 0;
      lumpSumCount++;
    } else if (tx.quadrant && quadrantSums[tx.quadrant] !== undefined) {
      quadrantSums[tx.quadrant] += tx.amount || 0;
    }
  });

  // Calculate categorized total (excluding lump sum) to evaluate percentage
  const categorizedTotal = Object.values(quadrantSums).reduce((a, b) => a + b, 0);

  // Financial Health Advice logic
  const unnecessaryDailyRatio = categorizedTotal > 0 ? quadrantSums.UNNECESSARY_DAILY / categorizedTotal : 0;
  const unnecessaryUrgentRatio = categorizedTotal > 0 ? quadrantSums.UNNECESSARY_URGENT / categorizedTotal : 0;
  const necessaryDailyRatio = categorizedTotal > 0 ? quadrantSums.NECESSARY_DAILY / categorizedTotal : 0;

  let adviceBadge = {
    title: '開銷結構相當健康',
    desc: '您的支出主要集中在必要開銷，能有效掌控衝動消費與日常微小浪費。',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  };

  if (unnecessaryDailyRatio > 0.35) {
    adviceBadge = {
      title: '日常微小浪費警訊 ⚠️',
      desc: '「非必要 × 日常」積少成多（如每日咖啡/手搖/訂閱），建議檢視訂閱服務或設定每週手搖飲額度。',
      color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
    };
  } else if (unnecessaryUrgentRatio > 0.3) {
    adviceBadge = {
      title: '衝動與娛樂消費偏高 🛍️',
      desc: '「非必要 × 臨時」支出占比高，建議在進行高額大餐或衝動購物前建立 48 小時冷卻期。',
      color: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200',
    };
  } else if (necessaryDailyRatio > 0.6) {
    adviceBadge = {
      title: '踏實生活開支比例過半 👍',
      desc: '您的生活基礎開銷非常扎實，這是最穩健的財務習慣。',
      color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
    };
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2x2 四象限智慧分析</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              F1 & F4 規格
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            以「必要性」與「規律性」兩軸診斷財務健康，極低認知負擔。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSelectedPeriod('this_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedPeriod === 'this_month'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            本月資料
          </button>
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedPeriod === 'all'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            全部歷史
          </button>
        </div>
      </div>

      {/* Financial Health Overview Card */}
      <div className={`p-5 rounded-3xl border shadow-sm ${adviceBadge.color} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-base">{adviceBadge.title}</h3>
          </div>
          <span className="text-xs font-mono font-bold bg-white/60 dark:bg-black/30 px-2.5 py-1 rounded-full">
            總計 ${totalSpend.toLocaleString()}
          </span>
        </div>
        <p className="text-xs leading-relaxed">{adviceBadge.desc}</p>
      </div>

      {/* 2x2 Matrix Visual Display */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Axes Labels Indicator */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
          <span className="flex items-center gap-1">&uarr; 必要 (Necessary)</span>
          <span className="flex items-center gap-1">&darr; 非必要 (Unnecessary)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUADRANT_LIST.map((qKey) => {
            const q = QUADRANT_CONFIGS[qKey];
            const sum = quadrantSums[qKey];
            const pct = categorizedTotal > 0 ? Math.round((sum / categorizedTotal) * 100) : 0;

            return (
              <motion.div
                key={qKey}
                whileHover={{ scale: 1.01 }}
                className={`p-5 rounded-2xl border ${q.bgColor} ${q.borderColor} space-y-3 relative overflow-hidden`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${q.badgeBg}`}>
                      {q.axisY} × {q.axisX}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                      {q.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{q.subTitle}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                      ${sum.toLocaleString()}
                    </div>
                    <div className="text-xs font-bold text-slate-500 font-mono">{pct}% 占比</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: q.color }}
                  />
                </div>

                {/* Example Items */}
                <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex gap-1.5 flex-wrap">
                    {q.examples.map((ex, idx) => (
                      <span key={idx} className="bg-white/70 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                        {ex}
                      </span>
                    ))}
                  </div>

                  {onOpenQuickModalWithQuadrant && (
                    <button
                      onClick={() => onOpenQuickModalWithQuadrant(qKey)}
                      className="text-xs font-bold hover:underline"
                      style={{ color: q.color }}
                    >
                      + 記一筆
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Lump-Sum Catch-Up Section (Specification 2.4 - F4) */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              模糊概算補登隔離區 (F4 規格)
            </h3>
          </div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
            {lumpSumCount} 筆補登 · 共 ${lumpSumTotal.toLocaleString()}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          系統將概算補登（`is_lump_sum = true`）紀錄獨立顯示於此，並完整計入「總支出」與「連續天數」，絕不污染四象限比例分析。
        </p>
      </div>
    </div>
  );
};
