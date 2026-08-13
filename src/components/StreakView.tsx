import React from 'react';
import { motion } from 'motion/react';
import { Flame, Trophy, Calendar, Award, CheckCircle2, Sparkles, ShieldCheck, Zap, Timer } from 'lucide-react';
import { StreakStats, Transaction } from '../types';
import { getSpeedPB, getSpeedRankInfo } from '../lib/storage';

interface StreakViewProps {
  streakStats: StreakStats;
  transactions: Transaction[];
  onOpenQuickModal?: () => void;
}

export const StreakView: React.FC<StreakViewProps> = ({
  streakStats,
  transactions,
  onOpenQuickModal,
}) => {
  // Generate last 30 days calendar grid
  const today = new Date();
  const past30Days: Array<{ dateStr: string; dayNum: number; txs: Transaction[]; isToday: boolean }> = [];

  // Map transactions by YYYY-MM-DD
  const txByDate: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    if (tx.entry_date) {
      if (!txByDate[tx.entry_date]) txByDate[tx.entry_date] = [];
      txByDate[tx.entry_date].push(tx);
    }
  });

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    past30Days.push({
      dateStr,
      dayNum: d.getDate(),
      txs: txByDate[dateStr] || [],
      isToday: i === 0,
    });
  }

  // Speed SLA statistics calculation
  const speedPB = getSpeedPB();
  const pbRank = speedPB ? getSpeedRankInfo(speedPB) : null;
  const fastTxsCount = transactions.filter((t) => t.duration_ms && t.duration_ms <= 2000).length;
  const lightningTxsCount = transactions.filter((t) => t.duration_ms && t.duration_ms <= 1000).length;

  // Badges logic
  const badges = [
    {
      id: 'speed_pb',
      title: pbRank ? pbRank.title : '極速記帳員',
      desc: speedPB ? `個人最快紀錄: ${(speedPB / 1000).toFixed(2)}s` : '完成一次極速記帳即可解鎖',
      required: 1,
      icon: pbRank ? pbRank.badge : '⚡️',
      achieved: speedPB !== null,
    },
    {
      id: 'streak_3',
      title: '啟動新手',
      desc: '連續記帳 3 天',
      required: 3,
      icon: '🌱',
      achieved: streakStats.longestStreak >= 3,
    },
    {
      id: 'streak_7',
      title: '習慣養成',
      desc: '連續記帳 7 天',
      required: 7,
      icon: '🌿',
      achieved: streakStats.longestStreak >= 7,
    },
    {
      id: 'streak_14',
      title: '堅毅不拔',
      desc: '連續記帳 14 天',
      required: 14,
      icon: '🌳',
      achieved: streakStats.longestStreak >= 14,
    },
    {
      id: 'streak_30',
      title: '極低摩擦大師',
      desc: '連續記帳 30 天',
      required: 30,
      icon: '🏆',
      achieved: streakStats.longestStreak >= 30,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none">
          <Flame className="w-64 h-64" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-white/20 rounded-xl">
                <Flame className="w-6 h-6 animate-pulse text-amber-200" />
              </span>
              <h2 className="text-2xl font-black tracking-tight">記帳習慣成就系統</h2>
            </div>
            <p className="text-xs text-amber-100 max-w-md">
              核心原則：重視 Streak 連續天數，而非資料完整度。今日 $0 支出與模糊補登皆能維持連續天數！
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 rounded-2xl text-center self-stretch sm:self-auto flex sm:flex-col justify-between items-center">
            <span className="text-xs font-medium text-amber-100">當前連續記帳</span>
            <span className="text-3xl font-black font-mono tracking-tight text-white flex items-center gap-1 justify-center">
              {streakStats.currentStreak} <span className="text-sm font-normal">天 🔥</span>
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-400">當前連續 Streak</div>
            <div className="text-lg font-bold font-mono text-stone-900 dark:text-white">
              {streakStats.currentStreak} 天
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-400">歷史最高天數</div>
            <div className="text-lg font-bold font-mono text-stone-900 dark:text-white">
              {streakStats.longestStreak} 天
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-400">$0 支出天數</div>
            <div className="text-lg font-bold font-mono text-stone-900 dark:text-white">
              {streakStats.zeroSpendDaysCount} 天
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-400">總累積打卡天數</div>
            <div className="text-lg font-bold font-mono text-stone-900 dark:text-white">
              {streakStats.totalLogDays} 天
            </div>
          </div>
        </div>
      </div>

      {/* Speed SLA Hall of Fame Card */}
      <div className="bg-gradient-to-r from-stone-900 via-indigo-950 to-stone-900 text-white p-5 rounded-3xl border border-indigo-500/30 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">⚡️ 極速記帳計時戰績榜</h3>
                {pbRank && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pbRank.bgColor} ${pbRank.color}`}>
                    {pbRank.badge} {pbRank.title}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                每次喚起記帳均由高精準度 SLA 記時器監控，解鎖成就印記並地圖連擊打卡！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between bg-stone-800/80 px-4 py-2 rounded-2xl border border-stone-700">
            <div>
              <div className="text-[10px] text-stone-400">個人最快紀錄 (PB)</div>
              <div className="text-lg font-black font-mono text-amber-400">
                {speedPB ? `${(speedPB / 1000).toFixed(2)}s` : '無紀錄'}
              </div>
            </div>
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
            <span className="text-stone-400 text-[11px]">神速稱號徽章</span>
            <div className="font-bold text-white mt-1 flex items-center gap-1.5">
              <span>{pbRank ? pbRank.badge : '⏱️'}</span>
              <span>{pbRank ? pbRank.title : '未解鎖'}</span>
            </div>
          </div>

          <div className="bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
            <span className="text-stone-400 text-[11px]">&le; 2.0s 極速完成筆數</span>
            <div className="font-bold font-mono text-emerald-400 text-sm mt-1">
              {fastTxsCount} 筆 (含 {lightningTxsCount} 筆 &le; 1s)
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-stone-800/60 p-3 rounded-2xl border border-stone-700/60">
            <span className="text-stone-400 text-[11px]">打卡地圖極速印記</span>
            <div className="font-bold text-indigo-300 mt-1 flex items-center gap-1">
              <span>⚡️ 月曆金標連擊</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Streak Calendar Grid */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-stone-900 dark:text-white text-base">近 30 天習慣打卡地圖</h3>
          </div>
          {onOpenQuickModal && (
            <button
              onClick={onOpenQuickModal}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              + 今日打卡記帳
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {past30Days.map((item, idx) => {
            const hasTx = item.txs.length > 0;
            const isZero = item.txs.some((t) => t.is_zero_spend);
            const isLump = item.txs.some((t) => t.is_lump_sum);
            const fastestDayTx = item.txs
              .filter((t) => typeof t.duration_ms === 'number')
              .sort((a, b) => (a.duration_ms || 9999) - (b.duration_ms || 9999))[0];
            const hasSpeedStamp = fastestDayTx && fastestDayTx.duration_ms && fastestDayTx.duration_ms <= 2000;

            let bgClass = 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500 border-stone-200 dark:border-stone-700';

            if (hasTx) {
              if (isZero) {
                bgClass = 'bg-teal-500 text-white font-bold border-teal-600 shadow-sm';
              } else if (isLump) {
                bgClass = 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm';
              } else {
                bgClass = 'bg-emerald-500 text-white font-bold border-emerald-600 shadow-sm';
              }
            }

            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.08 }}
                className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between h-16 transition-all relative ${bgClass} ${
                  item.isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                }`}
                title={`${item.dateStr}: ${hasTx ? `${item.txs.length} 筆紀錄` : '未打卡'}${
                  hasSpeedStamp ? ` | ⚡️ 極速記帳: ${(fastestDayTx.duration_ms! / 1000).toFixed(2)}s` : ''
                }`}
              >
                {/* Speed Stamp Icon */}
                {hasSpeedStamp && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-stone-900 flex items-center justify-center text-[10px] font-black shadow-md border border-white"
                    title={`⚡️ 極速印記: ${(fastestDayTx.duration_ms! / 1000).toFixed(2)}s`}
                  >
                    ⚡
                  </span>
                )}

                <span className="text-[10px] opacity-80">{item.dateStr.slice(5)}</span>
                <span className="text-sm font-extrabold font-mono">
                  {hasTx ? (isZero ? '★ $0' : '✓') : item.dayNum}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" /> 一般消費
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-teal-500" /> $0 支出日
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" /> 模糊補登
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-stone-200 dark:bg-stone-700" /> 未記帳
          </span>
        </div>
      </div>

      {/* Achievement Badges */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-stone-900 dark:text-white text-base">連續 Streak 勳章牆</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                b.achieved
                  ? 'bg-amber-500/10 border-amber-500/30 text-stone-900 dark:text-white'
                  : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700/60 opacity-60'
              }`}
            >
              <span className="text-3xl">{b.icon}</span>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-1">
                  {b.title}
                  {b.achieved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
