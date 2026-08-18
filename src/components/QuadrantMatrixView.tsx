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
import { LayoutGrid, Info, TrendingUp, Calendar, Target } from 'lucide-react';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';

interface QuadrantMatrixViewProps {
  transactions: Transaction[];
  onOpenQuickModalWithQuadrant?: (q: QuadrantType) => void;
}

const LUMP_SUM_COLOR = '#A8A29E';

export const QuadrantMatrixView: React.FC<QuadrantMatrixViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<'this_month' | 'history'>('this_month');

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonthSoFar = now.getDate();

  const monthTx = useMemo(
    () => transactions.filter((tx) => tx.entry_date && tx.entry_date.startsWith(currentMonthPrefix)),
    [transactions, currentMonthPrefix]
  );

  const totalSpend = monthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const avgPerDay = dayOfMonthSoFar > 0 ? Math.round(totalSpend / dayOfMonthSoFar) : 0;

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

  const topQuadrant = QUADRANT_LIST.reduce<QuadrantType | null>((top, q) => {
    if (!top || quadrantSums[q] > quadrantSums[top]) return q;
    return top;
  }, null);

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

  // --- 歷史趨勢: monthly stacked bar, last 8 months ---
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
      if (!buckets[key]) return;
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

  // 8-month averages per quadrant, for the summary row below the history chart
  const monthsWithData = monthlyStackedData.filter(
    (m) => m.NECESSARY_DAILY + m.NECESSARY_URGENT + m.UNNECESSARY_DAILY + m.UNNECESSARY_URGENT + m.LUMP_SUM > 0
  ).length || 1;
  const avgByQuadrant: Record<QuadrantType, number> = {
    NECESSARY_DAILY: Math.round(monthlyStackedData.reduce((s, m) => s + m.NECESSARY_DAILY, 0) / monthsWithData),
    NECESSARY_URGENT: Math.round(monthlyStackedData.reduce((s, m) => s + m.NECESSARY_URGENT, 0) / monthsWithData),
    UNNECESSARY_DAILY: Math.round(monthlyStackedData.reduce((s, m) => s + m.UNNECESSARY_DAILY, 0) / monthsWithData),
    UNNECESSARY_URGENT: Math.round(monthlyStackedData.reduce((s, m) => s + m.UNNECESSARY_URGENT, 0) / monthsWithData),
  };

  return (
    <div className="nb-ruled rounded-3xl p-3.5 relative">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <div className="ml-4 space-y-3">
        {/* Header & Mode Switch */}
        <div className="flex items-center justify-between gap-2 bg-[#fdf8ec] dark:bg-[#221d12] px-4 py-3 nb-blob-1 border-2 border-[#4a3a20] dark:border-[#c9b98a]">
          <div className="flex items-center gap-1.5 min-w-0">
            <LayoutGrid className="w-4 h-4 text-orange-700 dark:text-orange-300 shrink-0" />
            <h2 className="font-hand text-base font-bold text-[#3a2e18] dark:text-white truncate">2x2 四象限數據分析</h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setViewMode('this_month')}
              className={`font-hand px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border-[1.5px] ${
                viewMode === 'this_month'
                  ? 'bg-orange-600 border-orange-800 text-white'
                  : 'bg-transparent border-[#a08a5c] text-[#7a6a4a] dark:text-[#b8a878]'
              }`}
              id="matrix-mode-this-month-btn"
            >
              本月
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`font-hand px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border-[1.5px] ${
                viewMode === 'history'
                  ? 'bg-orange-600 border-orange-800 text-white'
                  : 'bg-transparent border-[#a08a5c] text-[#7a6a4a] dark:text-[#b8a878]'
              }`}
              id="matrix-mode-history-btn"
            >
              歷史趨勢
            </button>
          </div>
        </div>

        {viewMode === 'this_month' ? (
          <>
            {/* Quick stat row: fills space with genuinely useful numbers */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '本月支出', value: `$${totalSpend.toLocaleString()}`, icon: Calendar },
                { label: '日均花費', value: `$${avgPerDay.toLocaleString()}`, icon: TrendingUp },
                { label: '最大宗類別', value: topQuadrant ? QUADRANT_CONFIGS[topQuadrant].title : '--', icon: Target },
              ].map((s) => (
                <div key={s.label} className="bg-[#fdf8ec] dark:bg-[#221d12] border-2 border-[#4a3a20] dark:border-[#c9b98a] nb-blob-2 p-2.5 text-center">
                  <s.icon className="w-3.5 h-3.5 mx-auto text-orange-700 dark:text-orange-300" />
                  <div className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white mt-1 truncate">{s.value}</div>
                  <div className="font-hand text-[9px] text-[#8a7a5a] dark:text-[#b8a878]">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Donut chart */}
            <div className="bg-[#fdf8ec] dark:bg-[#221d12] p-4 nb-blob-3 border-2 border-[#4a3a20] dark:border-[#c9b98a]">
              {hasMonthData ? (
                <div className="w-36 h-36 mx-auto relative mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} strokeWidth={0}>
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
                    <span className="font-hand text-[10px] text-[#8a7a5a] dark:text-[#b8a878]">本月支出</span>
                    <span className="font-hand text-base font-black font-mono text-[#3a2e18] dark:text-white">
                      ${totalSpend.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="font-hand text-xs text-[#8a7a5a] text-center py-6">本月尚無記帳資料</p>
              )}

              {/* Breakdown bars — stacked layout so labels never truncate */}
              {hasMonthData && (
                <div className="space-y-2 pt-2 border-t-[1.5px] border-dashed border-[#a08a5c]">
                  {pieData.map((d) => {
                    const pct = totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0;
                    return (
                      <div key={d.key}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="font-hand font-bold text-[#3a2e18] dark:text-white">{d.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[#5a4a2a] dark:text-[#d4c49a] shrink-0">
                            ${d.value.toLocaleString()} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#e8dcc0] dark:bg-[#3a3120] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lump-Sum summary */}
            {lumpSumCount > 0 && (
              <div className="bg-[#f5e9c8] dark:bg-[#3a2f18] p-3 nb-blob-4 border-2 border-dashed border-[#8a6a2a] flex items-center justify-between gap-2">
                <div className="font-hand flex items-center gap-1.5 text-xs text-[#5a4a2a] dark:text-[#d4c49a]">
                  <Info className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>模糊概算補登（不分象限，已計入總支出）</span>
                </div>
                <span className="font-hand text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                  {lumpSumCount} 筆 · ${lumpSumTotal.toLocaleString()}
                </span>
              </div>
            )}
          </>
        ) : (
          /* 歷史趨勢 */
          <div className="bg-[#fdf8ec] dark:bg-[#221d12] p-4 nb-blob-3 border-2 border-[#4a3a20] dark:border-[#c9b98a] space-y-3">
            <div className="font-hand flex items-center gap-1.5 text-xs font-bold text-[#5a4a2a] dark:text-[#d4c49a]">
              <TrendingUp className="w-3.5 h-3.5 text-orange-700 dark:text-orange-300" />
              <span>近 8 個月支出趨勢（按象限堆疊）</span>
            </div>

            {hasHistoryData ? (
              <>
                <div className="h-52">
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
                      <Bar dataKey="NECESSARY_DAILY" stackId="m" name={QUADRANT_CONFIGS.NECESSARY_DAILY.title} fill={QUADRANT_CONFIGS.NECESSARY_DAILY.color} />
                      <Bar dataKey="NECESSARY_URGENT" stackId="m" name={QUADRANT_CONFIGS.NECESSARY_URGENT.title} fill={QUADRANT_CONFIGS.NECESSARY_URGENT.color} />
                      <Bar dataKey="UNNECESSARY_DAILY" stackId="m" name={QUADRANT_CONFIGS.UNNECESSARY_DAILY.title} fill={QUADRANT_CONFIGS.UNNECESSARY_DAILY.color} />
                      <Bar dataKey="UNNECESSARY_URGENT" stackId="m" name={QUADRANT_CONFIGS.UNNECESSARY_URGENT.title} fill={QUADRANT_CONFIGS.UNNECESSARY_URGENT.color} />
                      <Bar dataKey="LUMP_SUM" stackId="m" name="模糊概算" fill={LUMP_SUM_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 8-month average per quadrant — fills the space below the chart usefully */}
                <div className="pt-2 border-t-[1.5px] border-dashed border-[#a08a5c] grid grid-cols-2 gap-2">
                  {QUADRANT_LIST.map((qKey) => (
                    <div key={qKey} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: QUADRANT_CONFIGS[qKey].color }} />
                        <span className="font-hand font-bold text-[#3a2e18] dark:text-white truncate">{QUADRANT_CONFIGS[qKey].title}</span>
                      </div>
                      <span className="font-mono text-[#5a4a2a] dark:text-[#d4c49a] shrink-0">月均 ${avgByQuadrant[qKey].toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="font-hand text-xs text-[#8a7a5a] text-center py-10">尚無足夠的歷史資料</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
