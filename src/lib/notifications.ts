/**
 * QuickLedger - Real System Notification Layer
 * Uses @capacitor/local-notifications so reminders show up as genuine
 * Android notification-tray items (works even when the app is closed),
 * instead of an in-app simulated banner or the unreliable Web Notification API.
 */
import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { RoutineCandidate } from './routine';
import { QuadrantType } from '../types';

// Fixed, stable notification ids so re-scheduling replaces rather than stacks up
const DAILY_REMINDER_ID = 1001;
const ROUTINE_REMINDER_BASE_ID = 2000; // + hash of tx id

export const ACTION_TYPE_DAILY = 'DAILY_REMINDER_ACTIONS';
export const ACTION_TYPE_ROUTINE = 'ROUTINE_REMINDER_ACTIONS';

export interface NotificationTapResult {
  kind: 'daily_zero' | 'daily_open' | 'routine_accept' | 'routine_adjust';
  amount?: number;
  quadrant?: QuadrantType | null;
  note?: string;
}

/** Ask the user for OS notification permission (required on Android 13+). */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (e) {
    console.warn('Notification permission request failed', e);
    return false;
  }
}

/** Register the tap-action buttons that appear directly on the notification. */
export async function registerNotificationActionTypes(): Promise<void> {
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_DAILY,
          actions: [
            { id: 'zero', title: '今日 $0 支出' },
            { id: 'open', title: '開啟記帳' },
          ],
        },
        {
          id: ACTION_TYPE_ROUTINE,
          actions: [
            { id: 'accept', title: '直接同意採用' },
            { id: 'adjust', title: '快速調整' },
          ],
        },
      ],
    });
  } catch (e) {
    console.warn('registerActionTypes failed', e);
  }
}

/** Schedule (or replace/cancel) the recurring daily settlement reminder. */
export async function scheduleDailyReminder(timeStr: string, enabled: boolean = true): Promise<void> {
  // Cancel any previous schedule for this id first (avoids duplicates on time change)
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  if (!enabled) return;

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_REMINDER_ID,
          title: 'QuickLedger 每日結算',
          body: '今天過得如何？花費記了嗎？點擊直接完成記帳。',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
          actionTypeId: ACTION_TYPE_DAILY,
        },
      ],
    });
  } catch (e) {
    console.warn('scheduleDailyReminder failed', e);
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  } catch (e) {
    console.warn('cancelDailyReminder failed', e);
  }
}

/** Fire an immediate real notification so the user can confirm it works. */
export async function sendTestNotification(): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999,
          title: 'QuickLedger 測試通知',
          body: '這是一則真正的系統通知，下拉通知列即可看到。',
          schedule: { at: new Date(Date.now() + 1000) },
          actionTypeId: ACTION_TYPE_DAILY,
        },
      ],
    });
  } catch (e) {
    console.warn('sendTestNotification failed', e);
  }
}

/** Push the "過時未記帳" routine-habit reminder as a real notification. */
export async function scheduleRoutineReminder(candidate: RoutineCandidate): Promise<void> {
  const idSuffix = Math.abs(hashString(candidate.pastTx.id)) % 10000;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ROUTINE_REMINDER_BASE_ID + idSuffix,
          title: '時段習慣提醒',
          body: `過時未記帳：昨天約 ${candidate.formattedTime} 有 [${
            candidate.pastTx.note || '習慣消費'
          } $${candidate.pastTx.amount}]，點擊補登！`,
          schedule: { at: new Date(Date.now() + 500) },
          actionTypeId: ACTION_TYPE_ROUTINE,
          extra: {
            amount: candidate.pastTx.amount,
            quadrant: candidate.pastTx.quadrant,
            note: candidate.pastTx.note || '',
          },
        },
      ],
    });
  } catch (e) {
    console.warn('scheduleRoutineReminder failed', e);
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** Wire up a single listener that turns any notification tap/action into app behaviour. */
export function addNotificationActionListener(
  onResult: (result: NotificationTapResult) => void
): void {
  LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
    const notif = action.notification;
    const extra = (notif.extra || {}) as { amount?: number; quadrant?: QuadrantType | null; note?: string };

    if (notif.id === DAILY_REMINDER_ID) {
      if (action.actionId === 'zero') {
        onResult({ kind: 'daily_zero' });
      } else {
        onResult({ kind: 'daily_open' });
      }
      return;
    }

    // Routine reminder notifications
    if (action.actionId === 'accept') {
      onResult({
        kind: 'routine_accept',
        amount: extra.amount,
        quadrant: extra.quadrant ?? null,
        note: extra.note,
      });
    } else {
      onResult({
        kind: 'routine_adjust',
        amount: extra.amount,
        quadrant: extra.quadrant ?? null,
        note: extra.note,
      });
    }
  });
}
