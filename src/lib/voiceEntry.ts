/**
 * QuickLedger - Voice entry: speech-to-text + lightweight Mandarin parsing.
 *
 * Handles sentences like:
 *   "買牛奶90塊"  "花90塊買牛奶"  "午餐花了120元"  "咖啡65塊錢"  "午餐一百五"
 * by pulling out an amount + (optional) currency unit, and treating whatever's
 * left (after stripping filler verbs immediately touching the amount, like
 * 買/花/花了/付) as the note. The full recognized sentence is always preserved
 * too, since the cleanup rules are heuristic and imperfect.
 */
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const isNative = () => Capacitor.isNativePlatform();

export async function requestVoicePermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { speechRecognition } = await SpeechRecognition.checkPermissions();
    if (speechRecognition === 'granted') return true;
    const result = await SpeechRecognition.requestPermissions();
    return result.speechRecognition === 'granted';
  } catch (e) {
    console.error('Voice permission request failed', e);
    return false;
  }
}

export async function isVoiceAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { available } = await SpeechRecognition.available();
    return available;
  } catch {
    return false;
  }
}

interface StartListeningOptions {
  onPartialResult?: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (message: string) => void;
}

let listeningActive = false;
const LISTENING_TIMEOUT_MS = 15000; // safety net in case the plugin never fires 'listeningState: stopped'

/**
 * Start a single voice-capture session.
 *
 * IMPORTANT (plugin quirk): when `partialResults: true`, `SpeechRecognition.start()`
 * resolves almost immediately WITHOUT the final transcript — the real result only
 * ever arrives through the `partialResults` event stream, finalized when the
 * `listeningState` event reports `status: 'stopped'`. Treating start()'s resolved
 * value as the answer (as an earlier version of this file did) meant every call
 * looked like "didn't hear anything", even though the mic was working fine.
 */
export async function startListening({ onPartialResult, onFinalResult, onError }: StartListeningOptions): Promise<void> {
  if (!isNative()) {
    onError('語音記帳僅支援手機 App，網頁預覽無法使用。');
    return;
  }

  const granted = await requestVoicePermission();
  if (!granted) {
    onError('尚未取得麥克風/語音辨識權限，請到系統設定開啟。');
    return;
  }

  let latestText = '';
  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const partialListener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
    if (data.matches && data.matches.length > 0) {
      latestText = data.matches[0];
      onPartialResult?.(latestText);
    }
  });

  const stateListener = await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
    if (data.status === 'stopped') {
      finish();
    }
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    listeningActive = false;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    partialListener.remove();
    stateListener.remove();
    if (latestText.trim()) {
      onFinalResult(latestText.trim());
    } else {
      onError('沒有聽清楚，請靠近麥克風再說一次。');
    }
  };

  timeoutHandle = setTimeout(() => {
    if (!settled) {
      SpeechRecognition.stop().catch(() => {});
      finish();
    }
  }, LISTENING_TIMEOUT_MS);

  try {
    listeningActive = true;
    await SpeechRecognition.start({
      language: 'zh-TW',
      maxResults: 1,
      partialResults: true,
      popup: false,
    });
    // Note: intentionally NOT using the resolved value here — see doc comment above.
    // Some platforms may still resolve start() only once listening truly ends,
    // so also treat that resolution as a legitimate finish signal:
    finish();
  } catch (e: any) {
    if (!settled) {
      settled = true;
      listeningActive = false;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      partialListener.remove();
      stateListener.remove();
      onError(e?.message || '語音辨識發生錯誤，請再試一次。');
    }
  }
}

export async function stopListening(): Promise<void> {
  if (!isNative() || !listeningActive) return;
  try {
    await SpeechRecognition.stop();
  } catch {
    // no-op
  }
}

export interface ParsedVoiceEntry {
  amount: number | null;
  note: string;
  rawText: string;
}

// --- Chinese numeral (中文數字) -> number -----------------------------------
const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0,
  一: 1, 兩: 2, 两: 2, 二: 2,
  三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_SMALL_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_NUMERAL_CHAR_CLASS = '零〇一二兩两三四五六七八九十百千萬万';

/**
 * Parses a numeral run with no 萬/万 in it, e.g. "九十", "兩百五十", "十五".
 * Also handles the common colloquial shorthand where the trailing unit is
 * dropped — "一百五" (一百五「十」) means 150, "兩千三" means 2300 — by
 * treating a bare trailing digit as filling the next place value down from
 * whatever unit was last used, same as a native speaker would infer it.
 */
function parseChineseSmallSection(s: string): number {
  let result = 0;
  let current = 0;
  let lastUnit: number | null = null;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
    } else if (ch in CN_SMALL_UNITS) {
      const multiplier = current === 0 ? 1 : current;
      const unitVal = CN_SMALL_UNITS[ch];
      result += multiplier * unitVal;
      lastUnit = unitVal;
      current = 0;
    }
  }
  if (current > 0 && lastUnit && lastUnit > 10) {
    // Colloquial shorthand: trailing bare digit is one place value below lastUnit.
    result += current * (lastUnit / 10);
  } else {
    result += current;
  }
  return result;
}

/** Parses a full Chinese numeral phrase (may include 萬/万) into a number, or null if unparseable. */
export function chineseNumeralToNumber(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (![...trimmed].every((ch) => ch in CN_DIGITS || ch in CN_SMALL_UNITS || ch === '萬' || ch === '万')) {
    return null;
  }

  const wanIdx = trimmed.search(/[萬万]/);
  if (wanIdx === -1) {
    return parseChineseSmallSection(trimmed);
  }

  const beforeWan = trimmed.slice(0, wanIdx);
  const afterWan = trimmed.slice(wanIdx + 1);
  const wanMultiplier = beforeWan ? parseChineseSmallSection(beforeWan) : 1;
  const remainder = afterWan ? parseChineseSmallSection(afterWan) : 0;
  return wanMultiplier * 10000 + remainder;
}

// Currency units, including common STT homophone mis-transcriptions
// ("快" instead of "塊", "員" instead of "圓").
const UNIT_ALTERNATION = '元|塊錢|塊|圓|快|員';

// Matches an amount expressed in either Arabic digits ("90", "12.5") or
// Chinese numerals ("九十", "兩百五十"), immediately followed by a currency unit.
const AMOUNT_WITH_UNIT_PATTERN = new RegExp(
  `([0-9]+(?:\\.[0-9]+)?|[${CN_NUMERAL_CHAR_CLASS}]+)\\s*(${UNIT_ALTERNATION})`,
  'g'
);

// Fallback for colloquial amounts spoken with NO unit at all ("午餐一百五",
// "車錢兩百") — only tried when no unit-marked amount is found, and only
// anchored to the END of the sentence to avoid false-positives elsewhere.
const BARE_TRAILING_AMOUNT_PATTERN = new RegExp(`([0-9]+(?:\\.[0-9]+)?|[${CN_NUMERAL_CHAR_CLASS}]+)$`);

// Filler verbs/particles that describe the act of spending rather than the item itself.
// Sorted longest-first so "花了" is tried before the bare "花".
const FILLER_WORDS = ['花了', '花費', '花掉', '買了', '付了', '刷了', '匯了', '匯款', '扣款', '大概', '大約', '總共', '花', '買', '付', '刷', '支付', '消費', '購買', '共']
  .sort((a, b) => b.length - a.length);

/** Strips at most one filler word from the END of `s` (used just before the amount). */
function stripTrailingFiller(s: string): string {
  for (const filler of FILLER_WORDS) {
    if (s.endsWith(filler)) return s.slice(0, s.length - filler.length).trim();
  }
  return s;
}

/** Strips at most one filler word from the START of `s` (used just after the amount). */
function stripLeadingFiller(s: string): string {
  for (const filler of FILLER_WORDS) {
    if (s.startsWith(filler)) return s.slice(filler.length).trim();
  }
  return s;
}

/**
 * Parses a spoken sentence into { amount, note, rawText }. Accepts Arabic
 * digits and Chinese numerals interchangeably. When a sentence contains more
 * than one number+unit (e.g. an item name that happens to include a number,
 * like "買十元壽司花了50塊"), the LAST occurrence is treated as the actual
 * amount paid, since that's how such sentences are conventionally structured
 * in speech ("...動作+東西+最後才是總金額").
 *
 * Cleanup of filler verbs (買/花/付...) only ever touches the text immediately
 * flanking the matched amount — never the rest of the sentence — so it won't
 * accidentally eat into place or item names that happen to start/end with the
 * same character (e.g. "去花蓮買名產" keeps "花蓮" intact).
 */
export function parseVoiceText(rawText: string): ParsedVoiceEntry {
  const text = rawText.trim();

  const matches = [...text.matchAll(AMOUNT_WITH_UNIT_PATTERN)];
  const match = matches.length > 0 ? matches[matches.length - 1] : null;

  if (match && match.index !== undefined) {
    const numeralToken = match[1];
    const amount = /^[0-9.]+$/.test(numeralToken) ? parseFloat(numeralToken) : chineseNumeralToNumber(numeralToken);

    let before = text.slice(0, match.index);
    let after = text.slice(match.index + match[0].length);
    before = stripTrailingFiller(before);
    after = stripLeadingFiller(after);
    const remainder = `${before}${after}`.trim();

    return {
      amount: amount === null || isNaN(amount) ? null : amount,
      note: remainder || text,
      rawText: text,
    };
  }

  // No explicit unit found — try a colloquial bare-number-at-the-end fallback.
  const bareMatch = text.match(BARE_TRAILING_AMOUNT_PATTERN);
  if (bareMatch && bareMatch.index !== undefined) {
    const numeralToken = bareMatch[1];
    const amount = /^[0-9.]+$/.test(numeralToken) ? parseFloat(numeralToken) : chineseNumeralToNumber(numeralToken);
    if (amount !== null && !isNaN(amount)) {
      const before = stripTrailingFiller(text.slice(0, bareMatch.index));
      return { amount, note: before || text, rawText: text };
    }
  }

  return { amount: null, note: text, rawText: text };
}
