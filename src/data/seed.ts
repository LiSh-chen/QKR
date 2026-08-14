import { Transaction, UserSettings } from '../types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'user_default',
  daily_reminder_time: '21:30',
  reminder_enabled: true,
  default_quadrant_for_quick_input: 'UNNECESSARY_DAILY',
  haptic_feedback_enabled: true,
  sound_effects_enabled: true,
  dark_mode_enabled: false,
};

export function getSeedTransactions(): Transaction[] {
  const today = new Date();
  
  const formatDate = (offsetDays: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  const createIsoWithHour = (offsetDays: number, hour: number, minute: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() - offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const nowIso = new Date().toISOString();

  const recentTransactions: Transaction[] = [
    {
      id: 'tx_seed_yesterday_lunch',
      amount: 120,
      quadrant: 'NECESSARY_DAILY',
      note: '午餐便當與熱湯',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'manual',
      entry_date: formatDate(1), // Yesterday
      created_at: createIsoWithHour(1, 12, 15), // Yesterday 12:15
      updated_at: createIsoWithHour(1, 12, 15),
    },
    {
      id: 'tx_seed_1',
      amount: 120,
      quadrant: 'NECESSARY_DAILY',
      note: '早安牛肉蛋吐司',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'manual',
      entry_date: formatDate(0), // Today
      created_at: createIsoWithHour(0, 8, 10),
      updated_at: createIsoWithHour(0, 8, 10),
    },
    {
      id: 'tx_seed_2',
      amount: 65,
      quadrant: 'UNNECESSARY_DAILY',
      note: '冰美式咖啡',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'widget',
      entry_date: formatDate(0), // Today
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_3',
      amount: 250,
      quadrant: 'NECESSARY_DAILY',
      note: '捷運悠遊卡加值',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'manual',
      entry_date: formatDate(1), // Yesterday
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_4',
      amount: 500,
      quadrant: null,
      note: '模糊概算補登（昨日娛樂與點心）',
      is_lump_sum: true,
      is_zero_spend: false,
      entry_method: 'lump_sum',
      entry_date: formatDate(1), // Yesterday
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_5',
      amount: 0,
      quadrant: null,
      note: '今日無任何額外消費',
      is_lump_sum: false,
      is_zero_spend: true,
      entry_method: 'notification_zero',
      entry_date: formatDate(2), // 2 days ago
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_6',
      amount: 850,
      quadrant: 'NECESSARY_URGENT',
      note: '感冒耳鼻喉科診所看診',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'manual',
      entry_date: formatDate(3), // 3 days ago
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_7',
      amount: 180,
      quadrant: 'UNNECESSARY_DAILY',
      note: '下午茶蛋糕甜點',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'notification_quick_input',
      entry_date: formatDate(4), // 4 days ago
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_8',
      amount: 3200,
      quadrant: 'UNNECESSARY_URGENT',
      note: '朋友聚餐大餐慶生',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'manual',
      entry_date: formatDate(5), // 5 days ago
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'tx_seed_9',
      amount: 450,
      quadrant: 'NECESSARY_DAILY',
      note: '全聯超市一週食材採買',
      is_lump_sum: false,
      is_zero_spend: false,
      entry_method: 'widget',
      entry_date: formatDate(6), // 6 days ago
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  return [...recentTransactions, ...generateHistoricalMonthlyData(today)];
}

/**
 * Synthesizes ~6 months of prior spending history (a handful of transactions per
 * quadrant per month, with gently varying totals) purely so charts that visualize
 * month-over-month trends (2x2 分析 > 歷史趨勢) have something real to render.
 * Seeded/deterministic (no Math.random) so re-loading the app gives stable demo data.
 */
function generateHistoricalMonthlyData(today: Date): Transaction[] {
  const items: Transaction[] = [];
  const quadrantMonthlyPlan: Array<{
    quadrant: Transaction['quadrant'];
    note: string;
    baseAmounts: number[]; // one entry per synthetic transaction that month
  }> = [
    { quadrant: 'NECESSARY_DAILY', note: '每月固定生活開銷', baseAmounts: [3200, 1800, 950] },
    { quadrant: 'NECESSARY_URGENT', note: '臨時必要支出', baseAmounts: [1200, 600] },
    { quadrant: 'UNNECESSARY_DAILY', note: '日常小確幸', baseAmounts: [450, 380, 290] },
    { quadrant: 'UNNECESSARY_URGENT', note: '衝動或聚會消費', baseAmounts: [900, 500] },
  ];

  // 2..7 months ago (skip current + last month, which are already covered by recent seed data)
  for (let monthsAgo = 2; monthsAgo <= 7; monthsAgo++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 15);
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    // Gentle month-to-month variation so the stacked bar chart isn't perfectly flat
    const variation = 1 + ((monthsAgo % 3) - 1) * 0.15;

    quadrantMonthlyPlan.forEach((plan, planIdx) => {
      plan.baseAmounts.forEach((base, txIdx) => {
        const day = 3 + planIdx * 6 + txIdx * 4 + (monthsAgo % 5);
        const safeDay = Math.min(day, 27);
        const entryDate = new Date(y, m, safeDay, 9 + txIdx * 3, 20);
        const amount = Math.round((base * variation) / 5) * 5;

        items.push({
          id: `tx_hist_${y}_${m}_${planIdx}_${txIdx}`,
          amount,
          quadrant: plan.quadrant,
          note: plan.note,
          is_lump_sum: false,
          is_zero_spend: false,
          entry_method: 'manual',
          entry_date: entryDate.toISOString().split('T')[0],
          created_at: entryDate.toISOString(),
          updated_at: entryDate.toISOString(),
        });
      });
    });
  }

  return items;
}
