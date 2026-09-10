import React, { useState, useMemo } from 'react';
import { LayoutGrid, TrendingUp, Calendar } from 'lucide-react';
import { Transaction, QuadrantType } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { RoughBox } from './RoughBox';
import { RoughDonut, RoughStackedBarChart } from './RoughCharts';

interface QuadrantMatrixViewProps {
  transactions: Transaction[];
  onOpenQuickModalWithQuadrant?: (q: QuadrantType) => void;
  onNavigateToHistory?: (filter: { month?: string; quadrant?: string }) => void;
}

const LUMP_SUM_COLOR = '#A8A29E';

export const QuadrantMatrixView: React.FC<QuadrantMatrixViewProps> = ({ transactions, onNavigateToHistory }) => {
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

  const pieData = [
    ...QUADRANT_LIST.map((qKey) => ({
      key: qKey,
      name: QUADRANT_CONFIGS[qKey].title,
      value: quadrantSums[qKey],
      color: QUADRANT_CONFIGS[qKey].color,
    })),
    ...(lumpSumTotal > 0 ? [{ key: 'LUMP_SUM', name: '不分類', value: lumpSumTotal, color: LUMP_SUM_COLOR }] : []),
  ].filter((d) => d.value > 0);

  const hasMonthData = totalSpend > 0;

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

  const monthsWithData =
    monthlyStackedData.filter((m) => m.NECESSARY_DAILY + m.NECESSARY_URGENT + m.UNNECESSARY_DAILY + m.UNNECESSARY_URGENT + m.LUMP_SUM > 0).length || 1;
  const avgByQuadrant: Record<QuadrantType, number> = {
    NECESSARY_DAILY: Math.round(monthlyStackedData.reduce((s, m) => s + m.NECESSARY_DAILY, 0) / monthsWithData),
    NECESSARY_URGENT: Math.round(monthlyStackedData.reduce((s, m) => s + m.NECESSARY_URGENT, 0) / monthsWithData),
    UNNECESSARY_DAILY: Math.round(monthlyStackedData.reduce((s, m) => s + m.UNNECESSARY_DAILY, 0) / monthsWithData),
    UNNECESSARY_URGENT: Math.round(monthlyStackedData.reduce((s, m) => s + m.UNNECESSARY_URGENT, 0) / monthsWithData),
  };
  const avgLumpSum = Math.round(monthlyStackedData.reduce((s, m) => s + m.LUMP_SUM, 0) / monthsWithData);

  return (
    <div className="h-full nb-ruled rounded-3xl p-2.5 relative flex flex-col">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <div className="ml-4 space-y-1.5 overflow-y-auto flex-1 min-h-0">
        <RoughBox
          shape="rectangle"
          stroke="#3a2e18"
          strokeWidth={1.4}
          roughness={1.4}
          className="flex items-center justify-between gap-1.5 px-2.5 py-2"
        >
          <div className="flex items-center gap-1 min-w-0">
            <LayoutGrid className="w-4 h-4 text-orange-700 shrink-0" />
            <h2 className="font-hand pencil-text text-sm font-bold text-[#3a2e18] truncate">四象限分析</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode('this_month')}
              className={`font-hand pencil-text px-2 py-1 rounded-full text-[10px] font-bold transition-all border-[1.5px] ${
                viewMode === 'this_month' ? 'bg-orange-600 border-orange-800 text-white' : 'bg-transparent border-[#a08a5c] text-[#7a6a4a]'
              }`}
              id="matrix-mode-this-month-btn"
            >
              本月
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`font-hand pencil-text px-2 py-1 rounded-full text-[10px] font-bold transition-all border-[1.5px] ${
                viewMode === 'history' ? 'bg-orange-600 border-orange-800 text-white' : 'bg-transparent border-[#a08a5c] text-[#7a6a4a]'
              }`}
              id="matrix-mode-history-btn"
            >
              歷史
            </button>
          </div>
        </RoughBox>

        {viewMode === 'this_month' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '本月支出', value: `$${totalSpend.toLocaleString()}`, icon: Calendar, onClick: () => onNavigateToHistory?.({ month: currentMonthPrefix }) },
                { label: '日均花費', value: `$${avgPerDay.toLocaleString()}`, icon: TrendingUp, onClick: undefined },
              ].map((s) => (
                <RoughBox
                  key={s.label}
                  shape="rectangle"
                  stroke="#8a7454"
                  strokeWidth={1.3}
                  roughness={1.6}
                  onClick={s.onClick}
                  className={`p-2 text-center ${s.onClick ? 'cursor-pointer' : ''}`}
                >
                  <s.icon className="w-4 h-4 mx-auto text-orange-700" />
                  <div className="font-hand pencil-text text-base font-bold text-[#3a2e18] mt-1">{s.value}</div>
                  <div className="font-hand pencil-text text-[10px] text-[#8a7a5a]">{s.label}</div>
                </RoughBox>
              ))}
            </div>

            <RoughBox shape="rectangle" stroke="#3a2e18" strokeWidth={1.4} roughness={1.4} className="p-3">
              {hasMonthData ? (
                <div className="w-28 h-28 mx-auto relative mb-2">
                  <RoughDonut data={pieData.map((d) => ({ key: d.key, value: d.value, color: d.color }))} size={112} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-hand pencil-text text-[10px] text-[#8a7a5a]">本月支出</span>
                    <span className="font-hand pencil-text text-lg font-black font-mono text-[#3a2e18]">
                      ${totalSpend.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="font-hand pencil-text text-sm text-[#8a7a5a] text-center py-10">本月尚無記帳資料</p>
              )}

              {hasMonthData && (
                <div className="space-y-2.5 pt-3 border-t-[1.5px] border-dashed border-[#a08a5c]">
                  {pieData.map((d) => {
                    const pct = totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0;
                    return (
                      <button
                        key={d.key}
                        onClick={() => onNavigateToHistory?.({ month: currentMonthPrefix, quadrant: d.key })}
                        className="block w-full text-left"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <RoughBox
                              shape="ellipse"
                              stroke={d.color}
                              strokeWidth={1.2}
                              roughness={1.8}
                              fill={d.color}
                              fillStyle="hachure"
                              hachureGap={2}
                              className="w-3 h-3 shrink-0"
                            />
                            <span className="font-hand pencil-text font-bold text-[#3a2e18]">{d.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[#5a4a2a] shrink-0">
                            ${d.value.toLocaleString()} · {pct}%
                          </span>
                        </div>
                        <RoughBox shape="rectangle" stroke="#a08a5c" strokeWidth={1} roughness={1.5} className="h-3">
                          {pct > 0 && (
                            <RoughBox
                              shape="rectangle"
                              stroke={d.color}
                              strokeWidth={1}
                              roughness={1.6}
                              fill={d.color}
                              fillStyle="hachure"
                              hachureGap={2.5}
                              className="h-full"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                        </RoughBox>
                      </button>
                    );
                  })}
                </div>
              )}
            </RoughBox>
          </>
        ) : (
          <RoughBox shape="rectangle" stroke="#3a2e18" strokeWidth={1.4} roughness={1.4} className="p-2.5 space-y-2">
            <div className="font-hand pencil-text flex items-center gap-1.5 text-xs font-bold text-[#5a4a2a]">
              <TrendingUp className="w-3.5 h-3.5 text-orange-700" />
              <span>近 8 個月支出趨勢（按象限堆疊）</span>
            </div>

            {hasHistoryData ? (
              <>
                <RoughStackedBarChart
                  height={130}
                  data={monthlyStackedData.map((m) => ({
                    label: m.month,
                    segments: [
                      { key: 'NECESSARY_DAILY', value: m.NECESSARY_DAILY, color: QUADRANT_CONFIGS.NECESSARY_DAILY.color },
                      { key: 'NECESSARY_URGENT', value: m.NECESSARY_URGENT, color: QUADRANT_CONFIGS.NECESSARY_URGENT.color },
                      { key: 'UNNECESSARY_DAILY', value: m.UNNECESSARY_DAILY, color: QUADRANT_CONFIGS.UNNECESSARY_DAILY.color },
                      { key: 'UNNECESSARY_URGENT', value: m.UNNECESSARY_URGENT, color: QUADRANT_CONFIGS.UNNECESSARY_URGENT.color },
                      { key: 'LUMP_SUM', value: m.LUMP_SUM, color: LUMP_SUM_COLOR },
                    ],
                  }))}
                />

                <div className="pt-2 border-t-[1.5px] border-dashed border-[#a08a5c] grid grid-cols-2 gap-x-2 gap-y-1">
                  {QUADRANT_LIST.map((qKey) => (
                    <div key={qKey} className="flex items-center gap-1 min-w-0 text-[10px]">
                      <RoughBox
                        shape="ellipse"
                        stroke={QUADRANT_CONFIGS[qKey].color}
                        strokeWidth={1.1}
                        roughness={1.8}
                        fill={QUADRANT_CONFIGS[qKey].color}
                        fillStyle="hachure"
                        hachureGap={1.8}
                        className="w-2.5 h-2.5 shrink-0"
                      />
                      <span className="font-hand pencil-text font-bold text-[#3a2e18] truncate">{QUADRANT_CONFIGS[qKey].title}</span>
                      <span className="font-mono text-[#5a4a2a] shrink-0 ml-auto">${avgByQuadrant[qKey].toLocaleString()}</span>
                    </div>
                  ))}
                  {avgLumpSum > 0 && (
                    <div className="flex items-center gap-1 min-w-0 text-[10px] col-span-2">
                      <RoughBox
                        shape="ellipse"
                        stroke={LUMP_SUM_COLOR}
                        strokeWidth={1.1}
                        roughness={1.8}
                        fill={LUMP_SUM_COLOR}
                        fillStyle="hachure"
                        hachureGap={1.8}
                        className="w-2.5 h-2.5 shrink-0"
                      />
                      <span className="font-hand pencil-text font-bold text-[#3a2e18]">不分類</span>
                      <span className="font-mono text-[#5a4a2a] shrink-0 ml-auto">${avgLumpSum.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="font-hand pencil-text text-sm text-[#8a7a5a] text-center py-16">尚無足夠的歷史資料</p>
            )}
          </RoughBox>
        )}
      </div>
    </div>
  );
};
