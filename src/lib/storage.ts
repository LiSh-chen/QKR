import { Transaction, UserSettings, StreakStats, QuadrantType } from '../types';
import { DEFAULT_USER_SETTINGS, getSeedTransactions } from '../data/seed';

const STORAGE_KEYS = {
  TRANSACTIONS: 'quickledger_transactions_v1',
  SETTINGS: 'quickledger_settings_v1',
  SLA_LOGS: 'quickledger_sla_logs_v1',
  SPEED_PB: 'quickledger_speed_pb_v1',
};

// --- Transactions CRUD ---
export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      const seed = getSeedTransactions();
      saveTransactions(seed);
      return seed;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load transactions', err);
    return getSeedTransactions();
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (err) {
    console.error('Failed to save transactions', err);
  }
}

export function addTransaction(tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Transaction {
  const current = loadTransactions();
  const nowIso = new Date().toISOString();
  const newTx: Transaction = {
    ...tx,
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // If adding $0 spend or new entry for a date that already has zero spend, clean up or override appropriately
  const updated = [newTx, ...current];
  saveTransactions(updated);
  return newTx;
}

export function updateTransaction(id: string, updates: Partial<Transaction>): Transaction[] {
  const current = loadTransactions();
  const updated = current.map((tx) =>
    tx.id === id ? { ...tx, ...updates, updated_at: new Date().toISOString() } : tx
  );
  saveTransactions(updated);
  return updated;
}

export function deleteTransaction(id: string): Transaction[] {
  const current = loadTransactions();
  const updated = current.filter((tx) => tx.id !== id);
  saveTransactions(updated);
  return updated;
}

// --- Settings ---
export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    return DEFAULT_USER_SETTINGS;
  }
}

export function hasPersistedSettings(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.SETTINGS) !== null;
  } catch (err) {
    return false;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

// --- Streak Calculation ---
export function calculateStreakStats(transactions: Transaction[]): StreakStats {
  // Map of date string YYYY-MM-DD -> has_entry
  const activeDatesMap = new Set<string>();
  let zeroSpendDays = 0;
  let lumpSumEntries = 0;

  transactions.forEach((tx) => {
    if (tx.entry_date) {
      activeDatesMap.add(tx.entry_date);
    }
    if (tx.is_zero_spend) zeroSpendDays++;
    if (tx.is_lump_sum) lumpSumEntries++;
  });

  const sortedDates = Array.from(activeDatesMap).sort().reverse();

  if (sortedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalLogDays: 0,
      zeroSpendDaysCount: zeroSpendDays,
      lumpSumEntriesCount: lumpSumEntries,
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  let currentStreak = 0;

  // Check if today or yesterday has entry
  let checkDate = new Date();
  if (!activeDatesMap.has(todayStr) && !activeDatesMap.has(yesterdayStr)) {
    currentStreak = 0;
  } else {
    // Start counting back from either today or yesterday
    if (!activeDatesMap.has(todayStr)) {
      checkDate = yesterdayDate;
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (activeDatesMap.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak historically
  let longestStreak = 0;
  let tempStreak = 0;

  if (sortedDates.length > 0) {
    let prevDate: Date | null = null;
    // Iterate from oldest to newest
    const chronologicalDates = Array.from(activeDatesMap)
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    chronologicalDates.forEach((d) => {
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffMs = d.getTime() - prevDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 3600 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = d;
    });
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalLogDays: activeDatesMap.size,
    zeroSpendDaysCount: zeroSpendDays,
    lumpSumEntriesCount: lumpSumEntries,
  };
}

// --- Sound / Haptic Effects ---
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function triggerHapticFeedback(type: 'light' | 'medium' | 'success' = 'light'): void {
  // Respect the user's toggle in Settings
  if (!loadUserSettings().haptic_feedback_enabled) return;

  if (Capacitor.isNativePlatform()) {
    // Real native vibration via the Capacitor Haptics plugin (works reliably on Android,
    // unlike the web Vibration API which Android's WebView does not support).
    try {
      if (type === 'success') {
        Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'medium') {
        Haptics.impact({ style: ImpactStyle.Medium });
      } else {
        Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // no-op
    }
    return;
  }

  // Browser fallback (e.g. `npm run dev`)
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'success') navigator.vibrate([15, 30, 45]);
    } catch {
      // Ignore vibration errors
    }
  }
}

export function playClickSound(freq: number = 800): void {
  // Respect the user's toggle in Settings
  if (!loadUserSettings().sound_effects_enabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

// --- SLA Logging ---
export interface SlaLog {
  timestamp: string;
  durationMs: number;
  source: string;
  passed: boolean;
}

export function recordSlaMetric(durationMs: number, source: string): SlaLog {
  const log: SlaLog = {
    timestamp: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
    durationMs,
    source,
    passed: durationMs <= 1000,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLA_LOGS);
    const logs: SlaLog[] = raw ? JSON.parse(raw) : [];
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.SLA_LOGS, JSON.stringify(logs.slice(0, 30)));
  } catch (err) {
    console.error('Failed to log SLA metric', err);
  }
  return log;
}

export function getSlaLogs(): SlaLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLA_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// --- Speed Gamification & Personal Best (PB) ---
export interface SpeedRankInfo {
  title: string;
  badge: string;
  color: string;
  bgColor: string;
  level: number;
}

export function getSpeedRankInfo(durationMs: number): SpeedRankInfo {
  if (durationMs <= 1000) {
    return { title: '閃電光速神手', badge: '⚡️', color: 'text-amber-500 dark:text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/30', level: 1 };
  } else if (durationMs <= 2000) {
    return { title: '極速流暢達人', badge: '🚀', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30', level: 2 };
  } else if (durationMs <= 3500) {
    return { title: '順手紀錄好手', badge: '⏱️', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-500/10 border-indigo-500/30', level: 3 };
  } else {
    return { title: '細心沉穩記帳員', badge: '🐢', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-500/10 border-slate-500/30', level: 4 };
  }
}

export function getSpeedPB(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPEED_PB);
    if (!raw) return null;
    const num = parseFloat(raw);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

export function checkAndUpdateSpeedPB(durationMs: number): { isNewPB: boolean; previousPB: number | null; newPB: number } {
  const currentPB = getSpeedPB();
  if (currentPB === null || durationMs < currentPB) {
    try {
      localStorage.setItem(STORAGE_KEYS.SPEED_PB, durationMs.toString());
    } catch (err) {
      console.error('Failed to save speed PB', err);
    }
    return { isNewPB: true, previousPB: currentPB, newPB: durationMs };
  }
  return { isNewPB: false, previousPB: currentPB, newPB: currentPB };
}
