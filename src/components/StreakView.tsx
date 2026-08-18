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

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export const StreakView: React.FC<StreakViewProps> = ({ streakStats, transactions, onOpenQuickModal }) => {
  const today = new Date();
  const past28Days: Array<{ dateStr: string; dayNum: number; txs: Transaction[]; isToday: boolean }> = [];

  const txByDate: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    if (tx.entry_date) {
      if (!txByDate[tx.entry_date]) txByDate[tx.entry_date] = [];
      txByDate[tx.entry_date].push(tx);
    }
  });

  // Pad so the grid starts on a Sunday, giving a real calendar-page feel
  const startPad = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 27);
    return d.getDay();
  })();

  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    past28Days.push({ dateStr, dayNum: d.getDate(), txs: txByDate[dateStr] || [], isToday: i === 0 });
  }

  const speedPB = getSpeedPB();

  const badges = BADGES_DEF.map((b) => ({ ...b, achieved: streakStats.longestStreak >= b.required }));

  return (
    <div className="h-full flex flex-col gap-2.5 nb-ruled rounded-3xl p-3.5 relative">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>

      <div className="ml-4 flex flex-col h-full min-h-0 gap-2.5">
        {/* Header Banner */}
        <div
          className="bg-[#f5dca0] dark:bg-[#5c451c] border-2 border-[#7a5314] dark:border-[#d4b878] p-3.5 nb-blob-1 relative overflow-hidden shrink-0"
          style={{ transform: 'rotate(-0.3deg)' }}
        >
          <div className="absolute right-1 bottom-0 opacity-15 pointer-events-none">
            <Flame className="w-20 h-20 text-[#7a5314]" />
          </div>
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-hand text-lg font-black text-[#5a4014] dark:text-white flex items-center gap-1.5">
                <Flame className="w-5 h-5" /> 記帳習慣成就系統
              </h2>
              <p className="font-hand text-[10px] text-[#7a5314] dark:text-[#f0dca8] mt-0.5">連續天數最重要，$0 支出與模糊補登也算數！</p>
            </div>
            <div className="bg-[#fdf8ec] dark:bg-black/30 border-2 border-[#7a5314] dark:border-[#d4b878] px-4 py-1.5 nb-blob-pill text-center shrink-0">
              <span className="font-hand text-[9px] font-medium text-[#7a5314] dark:text-[#f0dca8] block">連續</span>
              <span className="font-hand text-2xl font-black tracking-tight text-[#5a4014] dark:text-white">
                {streakStats.currentStreak}
                <span className="text-xs font-normal"> 天</span>
              </span>
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          {[
            { label: '歷史最高', value: `${streakStats.longestStreak}天`, icon: Trophy },
            { label: '$0 天數', value: `${streakStats.zeroSpendDaysCount}天`, icon: Flame },
            { label: '總打卡', value: `${streakStats.totalLogDays}天`, icon: Calendar },
            { label: '極速 PB', value: speedPB ? `${(speedPB / 1000).toFixed(2)}s` : '--', icon: Zap },
          ].map((m, i) => (
            <div
              key={m.label}
              className="bg-[#fdf8ec] dark:bg-[#221d12] p-2.5 nb-blob-2 border-2 border-[#4a3a20] dark:border-[#c9b98a] text-center"
              style={{ transform: `rotate(${i % 2 === 0 ? '-0.6deg' : '0.6deg'})` }}
            >
              <m.icon className="w-4 h-4 mx-auto text-orange-700 dark:text-orange-300" />
              <div className="font-hand text-sm font-bold text-[#3a2e18] dark:text-white mt-1">{m.value}</div>
              <div className="font-hand text-[9px] text-[#8a7a5a] dark:text-[#b8a878]">{m.label}</div>
            </div>
          ))}
        </div>

        {/* 28-Day Streak Calendar (real calendar-page layout with weekday header) */}
        <div className="bg-[#fdf8ec] dark:bg-[#221d12] p-3.5 nb-blob-3 border-2 border-[#4a3a20] dark:border-[#c9b98a] flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-700 dark:text-orange-300" />
              <h3 className="font-hand font-bold text-[#3a2e18] dark:text-white text-sm">近 4 週打卡日曆</h3>
            </div>
            {onOpenQuickModal && (
              <button onClick={onOpenQuickModal} className="font-hand text-[11px] font-bold text-orange-700 dark:text-orange-300 underline decoration-wavy">
                + 今日打卡
              </button>
            )}
          </div>

          <div className="grid grid-cols-7 gap-1 shrink-0">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="font-hand text-center text-[9px] font-bold text-[#8a7a5a] dark:text-[#b8a878]">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1 content-start">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {past28Days.map((item, idx) => {
              const hasTx = item.txs.length > 0;
              const isZero = item.txs.some((t) => t.is_zero_spend);
              const isLump = item.txs.some((t) => t.is_lump_sum);

              let style = { bg: 'transparent', border: '#c9b98a', text: '#8a7a5a' };
              if (hasTx) {
                style = isZero
                  ? { bg: '#bcd8f0', border: '#1e4a78', text: '#1e4a78' }
                  : isLump
                    ? { bg: '#f5dca0', border: '#7a5314', text: '#7a5314' }
                    : { bg: '#c8e6c0', border: '#2e5c26', text: '#2e5c26' };
              }

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.1 }}
                  className="font-hand aspect-square rounded-lg border-[1.5px] text-center flex flex-col items-center justify-center transition-all"
                  style={{
                    backgroundColor: style.bg,
                    borderColor: style.border,
                    color: style.text,
                    boxShadow: item.isToday ? '0 0 0 2px #ea580c' : 'none',
                  }}
                  title={`${item.dateStr}: ${hasTx ? `${item.txs.length} 筆紀錄` : '未打卡'}`}
                >
                  <span className="text-[8px] opacity-80 leading-none">{item.dayNum}</span>
                  <span className="text-[10px] font-extrabold leading-none mt-0.5">{hasTx ? (isZero ? '$0' : '✓') : ''}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Badge grid with progress subtitle — fills width, not just a thin scroll strip */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t-[1.5px] border-dashed border-[#a08a5c] shrink-0">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`font-hand flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-[1.5px] ${
                  b.achieved
                    ? 'bg-[#f5dca0]/60 dark:bg-[#5c451c]/60 border-[#7a5314]'
                    : 'bg-transparent border-[#c9b98a] opacity-60'
                }`}
              >
                <span className="text-base shrink-0">{b.icon}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#3a2e18] dark:text-white truncate">{b.title}</div>
                  <div className="text-[8px] text-[#8a7a5a] dark:text-[#b8a878]">
                    {b.achieved ? '已解鎖' : `連續 ${b.required} 天解鎖 (${streakStats.currentStreak}/${b.required})`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
