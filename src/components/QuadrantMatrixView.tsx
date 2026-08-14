import React, { useState, useMemo } from 'react';
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
  Legend,
} from 'recharts';
import { LayoutGrid, Info, TrendingUp } from 'lucide-react';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';

interface QuadrantMatrixViewProps {
  transactions: Transaction[];
  onOpenQuickModalWithQuadrant?: (q: QuadrantType) => void;
}

const LUMP_SUM_COLOR = '#A8A29E'; // warm stone-400, visually distinct from the 4 quadrant colors

export const QuadrantMatrixView: React.FC<QuadrantMatrixViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<'this_month' | 'history'>('this_month');

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // --- 本月 (this month) breakdown ---
  const monthTx = useMemo(
    () => transactions.filter((tx) => tx.entry_date && tx.entry_date.startsWith(currentMonthPrefix)),
    [transactions, currentMonthPrefix]
  );

  const totalSpend = monthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const quadrantSums: Record<QuadrantType, number> = {
    NECESSARY_DAILY: 0,
    NECESSARY_URGENT: 0,
    UNNECESSARY_DAILY: 0,
    UNNECESSARY_URGENT: 0,
  };

  let lumpSumTotal = 0;
  let lumpSumCount = 0;

  monthTx.forEach((tx) => {
    if (tx.is_lump_sum) {
      lumpSumTotal += tx.amount || 0;
      lumpSumCount++;
    } else if (tx.quadrant && quadrantSums[tx.quadrant] !== undefined) {
      quadrantSums[tx.quadrant] += tx.amount || 0;
    }
  });

  const pieData = [
    ...QUADRANT_LIST.map((qKey) => ({
      key: qKey,
      name: QUADRANT_CONFIGS[qKey].title,
      value: quadrantSums[qKey],
      color: QUADRANT_CONFIGS[qKey].color,
    })),
    ...(lumpSumTotal > 0 ? [{ key: 'LUMP_SUM', name: '模糊概算', value: lumpSumTotal, color: LUMP_SUM_COLOR }] : []),
  ].filter((d) => d.value > 0);

  const hasMonthData = totalSpend > 0;

  // --- 歷史趨勢 (historical trend): monthly stacked bar, last 8 months ---
  const monthlyStackedData = useMemo(() => {
    const buckets: Record<
      string,
      { month: string; NECESSARY_DAILY: number; NECESSARY_URGENT: number; UNNECESSARY_DAILY: number; UNNECESSARY_URGENT: number; LUMP_SUM: number }
    > = {};

    const monthKeys: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      buckets[key] = {
        month: `${d.getMonth() + 1}月`,
        NECESSARY_DAILY: 0,
        NECESSARY_URGENT: 0,
        UNNECESSARY_DAILY: 0,
        UNNECESSARY_URGENT: 0,
        LUMP_SUM: 0,
      };
    }

    transactions.forEach((tx) => {
      if (!tx.entry_date) return;
      const key = tx.entry_date.slice(0, 7);
      if (!buckets[key]) return; // outside the 8-month window
      if (tx.is_lump_sum) {
        buckets[key].LUMP_SUM += tx.amount || 0;
      } else if (tx.quadrant && tx.quadrant in buckets[key]) {
        (buckets[key] as any)[tx.quadrant] += tx.amount || 0;
      }
    });

    return monthKeys.map((k) => buckets[k]);
  }, [transactions, now]);

  const hasHistoryData = monthlyStackedData.some(
    (m) => m.NECESSARY_DAILY + m.NECESSARY_URGENT + m.UNNECESSARY_DAILY + m.UNNECESSARY_URGENT + m.LUMP_SUM > 0
  );

  return (
    <div className="space-y-3">
      {/* Header & Mode Switch */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-stone-900 px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <LayoutGrid className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <h2 className="text-sm font-bold text-stone-900 dark:text-white truncate">2x2 四象限數據分析</h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setViewMode('this_month')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'this_month'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
            id="matrix-mode-this-month-btn"
          >
            本月
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'history'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
            id="matrix-mode-history-btn"
          >
            歷史趨勢
          </button>
        </div>
      </div>

      {viewMode === 'this_month' ? (
        <>
          {/* Donut chart: proportion across quadrants (+ lump sum) */}
          <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
            {hasMonthData ? (
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
                        contentStyle={{ fontSize: 11, borderRadius: 8, background: '#292524', border: 'none', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-stone-400">本月支出</span>
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
              <p className="text-xs text-stone-400 text-center py-6">本月尚無記帳資料</p>
            )}
          </div>

          {/* Lump-Sum summary (data only, entry is on the Quick tab) */}
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
        </>
      ) : (
        /* 歷史趨勢: monthly stacked bar chart, last 8 months */
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200">
            <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
            <span>近 8 個月支出趨勢（按象限堆疊）</span>
          </div>

          {hasHistoryData ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStackedData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,113,108,0.08)' }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, background: '#292524', border: 'none', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="NECESSARY_DAILY" stackId="m" name={QUADRANT_CONFIGS.NECESSARY_DAILY.title} fill={QUADRANT_CONFIGS.NECESSARY_DAILY.color} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="NECESSARY_URGENT" stackId="m" name={QUADRANT_CONFIGS.NECESSARY_URGENT.title} fill={QUADRANT_CONFIGS.NECESSARY_URGENT.color} />
                  <Bar dataKey="UNNECESSARY_DAILY" stackId="m" name={QUADRANT_CONFIGS.UNNECESSARY_DAILY.title} fill={QUADRANT_CONFIGS.UNNECESSARY_DAILY.color} />
                  <Bar dataKey="UNNECESSARY_URGENT" stackId="m" name={QUADRANT_CONFIGS.UNNECESSARY_URGENT.title} fill={QUADRANT_CONFIGS.UNNECESSARY_URGENT.color} />
                  <Bar dataKey="LUMP_SUM" stackId="m" name="模糊概算" fill={LUMP_SUM_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-stone-400 text-center py-10">尚無足夠的歷史資料</p>
          )}
        </div>
      )}
    </div>
  );
};
