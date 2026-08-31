/**
 * QuickLedger - 極低摩擦力記帳 APP
 * Data Models & Types Specification
 */

export type QuadrantType =
  | 'NECESSARY_DAILY'    // 必要 × 固定
  | 'NECESSARY_URGENT'   // 必要 × 偶發
  | 'UNNECESSARY_DAILY'  // 非必要 × 固定
  | 'UNNECESSARY_URGENT';// 非必要 × 偶發

export type EntryMethod =
  | 'widget'                   // 桌面/鎖定畫面 Widget 快速喚起
  | 'notification_quick_input' // 推播通知欄快速輸入
  | 'notification_zero'        // 推播通知欄一鍵 $0 支出
  | 'lump_sum'                 // 模糊概算補登
  | 'voice'                    // 語音記帳
  | 'recent_reuse'             // 昨日紀錄快速複用
  | 'manual';                  // 主 App 手動記帳

export interface Transaction {
  id: string;
  amount: number;
  quadrant: QuadrantType | null; // null when is_lump_sum = true, or when needs_classification = true
  note?: string;
  is_lump_sum: boolean;         // 模糊概算補登
  is_zero_spend: boolean;       // 今日 $0 支出紀錄
  needs_classification?: boolean; // true: 已記金額/備註，但象限「稍後分類」尚未選擇
  voice_raw_text?: string;      // 語音記帳時，STT 辨識出的完整原始語句（供事後核對備查）
  entry_method: EntryMethod;
  entry_date: string;           // YYYY-MM-DD
  created_at: string;           // ISO timestamp
  updated_at: string;           // ISO timestamp
  duration_ms?: number;         // 記帳耗時 (毫秒) 用於極速稱號與打卡地圖印記
}

export interface DailyStreak {
  date: string;                 // YYYY-MM-DD
  has_entry: boolean;           // 當日是否有任何形式的記帳行為
  is_zero_spend_day: boolean;
  total_amount: number;
}

export interface UserSettings {
  id: string;
  daily_reminder_time: string;  // e.g. "21:30"
  reminder_enabled: boolean;
  default_quadrant_for_quick_input: QuadrantType | 'UNCLASSIFIED';
  haptic_feedback_enabled: boolean;
  sound_effects_enabled: boolean;
  dark_mode_enabled: boolean;
}

export interface QuadrantMeta {
  type: QuadrantType;
  title: string;
  subTitle: string;
  examples: string[];
  axisX: '固定' | '偶發';
  axisY: '必要' | '非必要';
  color: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
  activeColor: string;
  badgeBg: string;
  textColor: string;
  iconName: string;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalLogDays: number;
  zeroSpendDaysCount: number;
  lumpSumEntriesCount: number;
}
