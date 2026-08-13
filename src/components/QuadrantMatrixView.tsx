import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Info } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';

interface QuadrantMatrixViewProps {
  transactions: Transaction[];
  onOpenQuickModalWithQuadrant?: (q: QuadrantType) => void;
}

const LUMP_SUM_COLOR = '#A8A29E'; // warm stone-400, visually distinct from the 4 quadrant colors

export const QuadrantMatrixView: React.FC<QuadrantMatrixViewProps> = ({
  transactions,
  onOpenQuickModalWithQuadrant,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'this_month' | 'all'>('this_month');

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filteredTx = useMemo(
    () =>
      transactions.filter((tx) => {
        if (selectedPeriod === 'this_month') {
          return tx.entry_date && tx.entry_date.startsWith(currentMonthPrefix);
        }
        return true;
      }),
    [transactions, selectedPeriod, currentMonthPrefix]
  );

  const totalSpend = filteredTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

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

  const categorizedTotal = Object.values(quadrantSums).reduce((a, b) => a + b, 0);

  const pieData = [
    ...QUADRANT_LIST.map((qKey) => ({
      key: qKey,
      name: QUADRANT_CONFIGS[qKey].title,
      value: quadrantSums[qKey],
      color: QUADRANT_CONFIGS[qKey].color,
    })),
    ...(lumpSumTotal > 0 ? [{ key: 'LUMP_SUM', name: '模糊概算', value: lumpSumTotal, color: LUMP_SUM_COLOR }] : []),
  ].filter((d) => d.value > 0);

  const barData = QUADRANT_LIST.map((qKey) => ({
    name: QUADRANT_CONFIGS[qKey].axisY + QUADRANT_CONFIGS[qKey].axisX,
    fullName: QUADRANT_CONFIGS[qKey].title,
    value: quadrantSums[qKey],
    color: QUADRANT_CONFIGS[qKey].color,
  }));

  const hasData = totalSpend > 0;

  return (
    <div className="space-y-3">
      {/* Header & Filter (compact) */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-stone-900 px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <LayoutGrid className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h2 className="text-sm font-bold text-stone-900 dark:text-white truncate">2x2 四象限數據分析</h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setSelectedPeriod('this_month')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              selectedPeriod === 'this_month'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            本月
          </button>
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              selectedPeriod === 'all'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            全部歷史
          </button>
        </div>
      </div>

      {/* Donut chart: proportion across quadrants (+ lump sum) */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        {hasData ? (
          <div className="flex items-center gap-3">
            <div className="w-32 h-32 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="95%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, background: '#1c1917', border: 'none', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-stone-400">總支出</span>
                <span className="text-sm font-black font-mono text-stone-900 dark:text-white">
                  ${totalSpend.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              {pieData.map((d) => {
                const pct = totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0;
                return (
                  <div key={d.key} className="flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-stone-600 dark:text-stone-300 truncate">{d.name}</span>
                    </div>
                    <span className="font-mono font-bold text-stone-800 dark:text-stone-100 shrink-0">
                      ${d.value.toLocaleString()} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-400 text-center py-6">此區間尚無記帳資料</p>
        )}
      </div>

      {/* Bar chart: amount per quadrant */}
      {hasData && (
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgba(120,113,108,0.08)' }}
                  formatter={(value: number, _n: string, props: any) => [`$${value.toLocaleString()}`, props.payload.fullName]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, background: '#1c1917', border: 'none', color: '#fff' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick action chips: tap to log directly into a quadrant */}
      {onOpenQuickModalWithQuadrant && (
        <div className="grid grid-cols-2 gap-2">
          {QUADRANT_LIST.map((qKey) => {
            const q = QUADRANT_CONFIGS[qKey];
            return (
              <motion.button
                key={qKey}
                whileTap={{ scale: 0.96 }}
                onClick={() => onOpenQuickModalWithQuadrant(qKey)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all"
                style={{ borderColor: q.color + '55', color: q.color, backgroundColor: q.color + '14' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                <span className="truncate">+ {q.title}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Lump-Sum Catch-Up summary (data only, entry moved to the Quick tab) */}
      {lumpSumCount > 0 && (
        <div className="bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>模糊概算補登（不分象限，已計入總支出）</span>
          </div>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 shrink-0">
            {lumpSumCount} 筆 · ${lumpSumTotal.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};
