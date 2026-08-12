import { Transaction, QuadrantType } from '../types';

export interface RoutineCandidate {
  pastTx: Transaction;
  timeSlotLabel: string;
  formattedTime: string;
  overdueHours: number; // How many hours overdue (at least 1.0)
}

export function getFormattedTimeFromIso(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '12:00';
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '12:00';
  }
}

export function getTimeSlotLabel(hour: number): string {
  if (hour >= 5 && hour < 11) return '早晨早餐時段';
  if (hour >= 11 && hour < 14) return '午餐時間';
  if (hour >= 14 && hour < 17) return '下午茶/點心時段';
  if (hour >= 17 && hour < 21) return '晚餐時間';
  return '夜間時段';
}

/**
 * Checks YESTERDAY's transactions to find one whose time-of-day has now passed
 * TODAY by at least 1 hour without a matching entry logged today yet.
 * If found, returns it so it can be offered back to the user as
 * "you logged this around this time yesterday — same thing today?"
 */
export function findRoutineCandidate(
  transactions: Transaction[],
  dismissedCandidateIds: string[] = []
): RoutineCandidate | null {
  const now = new Date();
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().split('T')[0];

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get today's logged transactions
  const todayTxs = transactions.filter((t) => t.entry_date === todayStr);

  // Only look at yesterday's real (non-zero, non-lump-sum) transactions
  const yesterdayTxs = transactions.filter(
    (t) =>
      t.entry_date === yesterdayStr &&
      !t.is_zero_spend &&
      !t.is_lump_sum &&
      t.amount > 0 &&
      !dismissedCandidateIds.includes(t.id)
  );

  // Group today's txs by hour slots
  const todaySlotHours = new Set(
    todayTxs.map((t) => {
      try {
        return new Date(t.created_at).getHours();
      } catch {
        return -1;
      }
    })
  );

  for (const pastTx of yesterdayTxs) {
    let pastMinuteOfDay = 12 * 60; // default 12:00
    try {
      const d = new Date(pastTx.created_at);
      if (!isNaN(d.getTime())) {
        pastMinuteOfDay = d.getHours() * 60 + d.getMinutes();
      }
    } catch {
      pastMinuteOfDay = 12 * 60;
    }

    // 1-HOUR INTERVAL RULE:
    // Current time must be AT LEAST 60 minutes past yesterday's transaction time
    const minutesPassed = currentMinuteOfDay - pastMinuteOfDay;
    const isOverdueByOneHour = minutesPassed >= 60;

    const pastHour = Math.floor(pastMinuteOfDay / 60);

    // Check if today already has a transaction in a similar time slot (within 2 hours) or with similar note
    const alreadyLoggedTodayInSlot =
      Array.from(todaySlotHours).some((h) => Math.abs(h - pastHour) <= 2) ||
      todayTxs.some((t) => t.note && pastTx.note && t.note.trim() === pastTx.note.trim());

    if (isOverdueByOneHour && !alreadyLoggedTodayInSlot) {
      const overdueHours = parseFloat((minutesPassed / 60).toFixed(1));
      return {
        pastTx,
        timeSlotLabel: getTimeSlotLabel(pastHour),
        formattedTime: getFormattedTimeFromIso(pastTx.created_at),
        overdueHours: Math.max(1.0, overdueHours),
      };
    }
  }

  return null;
}
