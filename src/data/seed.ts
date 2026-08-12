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

  return [
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
}
