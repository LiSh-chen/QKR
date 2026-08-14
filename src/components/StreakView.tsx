import React from 'react';
import { motion } from 'motion/react';
import { Flame, Trophy, Calendar, Zap } from 'lucide-react';
import { StreakStats, Transaction } from '../types';
import { getSpeedPB, getSpeedRankInfo } from '../lib/storage';

interface StreakViewProps {
  streakStats: StreakStats;
  transactions: Transaction[];
  onOpenQuickModal?: () => void;
}

const BADGES_DEF = [
  { id: 'streak_3', title: '啟動新手', required: 3, icon: '🌱' },
  { id: 'streak_7', title: '習慣養成', required: 7, icon: '🌿' },
  { id: 'streak_14', title: '堅毅不拔', required: 14, icon: '🌳' },
  { id: 'streak_30', title: '極低摩擦大師', required: 30, icon: '🏆' },
];

export const StreakView: React.FC<StreakViewProps> = ({ streakStats, transactions, onOpenQuickModal }) => {
  const today = new Date();
  const past21Days: Array<{ dateStr: string; dayNum: number; txs: Transaction[]; isToday: boolean }> = [];

  const txByDate: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    if (tx.entry_date) {
      if (!txByDate[tx.entry_date]) txByDate[tx.entry_date] = [];
      txByDate[tx.entry_date].push(tx);
    }
  });

  for (let i = 20; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    past21Days.push({ dateStr, dayNum: d.getDate(), txs: txByDate[dateStr] || [], isToday: i === 0 });
  }

  const speedPB = getSpeedPB();
  const pbRank = speedPB ? getSpeedRankInfo(speedPB) : null;

  const badges = BADGES_DEF.map((b) => ({ ...b, achieved: streakStats.longestStreak >= b.required }));

  return (
    <div className="h-full flex flex-col gap-2.5">
      {/* Header Banner (compact) */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-4 rounded-3xl shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none">
          <Flame className="w-32 h-32" />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-amber-200" /> 記帳習慣成就系統
            </h2>
            <p className="text-[10px] text-amber-100 mt-0.5">重視連續天數，$0 支出與模糊補登也算數！</p>
          </div>
          <div className="bg-white/15 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-2xl text-center shrink-0">
            <span className="text-[9px] font-medium text-amber-100 block">連續</span>
            <span className="text-2xl font-black font-mono tracking-tight">{streakStats.currentStreak}<span className="text-xs font-normal"> 天</span></span>
          </div>
        </div>
      </div>

      {/* Compact metrics row (incl. speed PB, replacing the separate SLA hall-of-fame card) */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {[
          { label: '歷史最高', value: `${streakStats.longestStreak}天`, icon: Trophy, color: 'text-indigo-500' },
          { label: '$0 天數', value: `${streakStats.zeroSpendDaysCount}天`, icon: Flame, color: 'text-teal-500' },
          { label: '總打卡', value: `${streakStats.totalLogDays}天`, icon: Calendar, color: 'text-emerald-500' },
          { label: '極速 PB', value: speedPB ? `${(speedPB / 1000).toFixed(2)}s` : '--', icon: Zap, color: 'text-amber-500' },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-stone-900 p-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm text-center">
            <m.icon className={`w-4 h-4 mx-auto ${m.color}`} />
            <div className="text-sm font-bold font-mono text-stone-900 dark:text-white mt-1">{m.value}</div>
            <div className="text-[9px] text-stone-400">{m.label}</div>
          </div>
        ))}
      </div>

      {/* 21-Day Streak Calendar Grid (compact) */}
      <div className="bg-white dark:bg-stone-900 p-3.5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex-1 min-h-0 flex flex-col gap-2">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h3 className="font-bold text-stone-900 dark:text-white text-xs">近 21 天打卡地圖</h3>
          </div>
          {onOpenQuickModal && (
            <button onClick={onOpenQuickModal} className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline">
              + 今日打卡
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {past21Days.map((item, idx) => {
            const hasTx = item.txs.length > 0;
            const isZero = item.txs.some((t) => t.is_zero_spend);
            const isLump = item.txs.some((t) => t.is_lump_sum);

            let bgClass = 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500 border-stone-200 dark:border-stone-700';
            if (hasTx) {
              bgClass = isZero
                ? 'bg-teal-500 text-white font-bold border-teal-600'
                : isLump
                  ? 'bg-amber-500 text-white font-bold border-amber-600'
                  : 'bg-emerald-500 text-white font-bold border-emerald-600';
            }

            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.08 }}
                className={`aspect-square rounded-lg border text-center flex flex-col items-center justify-center transition-all ${bgClass} ${
                  item.isToday ? 'ring-2 ring-orange-500 ring-offset-1' : ''
                }`}
                title={`${item.dateStr}: ${hasTx ? `${item.txs.length} 筆紀錄` : '未打卡'}`}
              >
                <span className="text-[8px] opacity-80 leading-none">{item.dateStr.slice(8)}</span>
                <span className="text-[10px] font-extrabold font-mono leading-none mt-0.5">
                  {hasTx ? (isZero ? '$0' : '✓') : ''}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Badge strip (horizontal scroll, compact) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 border-t border-stone-100 dark:border-stone-800 shrink-0">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-bold whitespace-nowrap shrink-0 ${
                b.achieved
                  ? 'bg-amber-500/10 border-amber-500/30 text-stone-900 dark:text-white'
                  : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700/60 text-stone-400 opacity-60'
              }`}
              title={`連續記帳 ${b.required} 天`}
            >
              <span>{b.icon}</span>
              <span>{b.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
