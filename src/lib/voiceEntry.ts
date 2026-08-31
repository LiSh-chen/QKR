/**
 * QuickLedger - Voice entry: speech-to-text + lightweight Mandarin parsing.
 *
 * Handles sentences like:
 *   "買牛奶90塊"  "花90塊買牛奶"  "午餐花了120元"  "咖啡65塊錢"
 * by pulling out the first amount + unit token, and treating whatever's
 * left (after stripping filler verbs like 買/花/花了/付) as the note.
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

/** Start a single voice-capture session; resolves once a final transcript arrives. */
export async function startListening({ onPartialResult, onFinalResult, onError }: StartListeningOptions): Promise<void> {
  if (!isNative()) {
    onError('語音記帳僅支援手機 App，網頁預覽無法使用。');
    return;
  }

  const granted = await requestVoicePermission();
  if (!granted) {
    onError('尚未取得麥克風/語音辨識權限。');
    return;
  }

  const partialListener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
    if (data.matches && data.matches.length > 0) {
      onPartialResult?.(data.matches[0]);
    }
  });

  try {
    listeningActive = true;
    const result = await SpeechRecognition.start({
      language: 'zh-TW',
      maxResults: 1,
      partialResults: true,
      popup: false,
    });
    const text = result?.matches?.[0] || '';
    if (text) {
      onFinalResult(text);
    } else {
      onError('沒有聽清楚，請再說一次。');
    }
  } catch (e: any) {
    onError(e?.message || '語音辨識發生錯誤。');
  } finally {
    listeningActive = false;
    partialListener.remove();
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
// Handles cardinal amounts like 九十 / 兩百五十 / 一千兩百 / 三萬 / 十五 / 零.
// Speech recognizers sometimes output Arabic digits and sometimes Chinese
// characters for the exact same spoken number, so both must parse identically.
const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0,
  一: 1, 兩: 2, 两: 2, 二: 2,
  三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_SMALL_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_NUMERAL_CHAR_CLASS = '零〇一二兩两三四五六七八九十百千萬万';

/** Parses a numeral run with no 萬/万 in it, e.g. "九十", "兩百五十", "十五". */
function parseChineseSmallSection(s: string): number {
  let result = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
    } else if (ch in CN_SMALL_UNITS) {
      // "十五" (no leading digit before 十) implicitly means 一十五
      const multiplier = current === 0 ? 1 : current;
      result += multiplier * CN_SMALL_UNITS[ch];
      current = 0;
    }
  }
  return result + current;
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

// Matches an amount expressed in either Arabic digits ("90", "12.5") or
// Chinese numerals ("九十", "兩百五十"), immediately followed by a currency unit.
const AMOUNT_PATTERN = new RegExp(
  `([0-9]+(?:\\.[0-9]+)?|[${CN_NUMERAL_CHAR_CLASS}]+)\\s*(元|塊錢|塊|圓)`
);

// Filler verbs/particles that describe the act of spending rather than the item itself.
const FILLER_WORDS = ['花了', '花費', '花', '買了', '買', '付了', '付', '支付', '消費', '購買', '共', '總共', '大概', '大約', '花掉'];

/**
 * Parses a spoken sentence into { amount, note }. Accepts Arabic digits and
 * Chinese numerals interchangeably, since they mean the same thing in speech.
 * e.g. "買牛奶90塊"   -> { amount: 90, note: "牛奶" }
 *      "買牛奶九十塊" -> { amount: 90, note: "牛奶" }
 *      "花兩百五十元買外套" -> { amount: 250, note: "外套" }
 *      "午餐花了120元" -> { amount: 120, note: "午餐" }
 */
export function parseVoiceText(rawText: string): ParsedVoiceEntry {
  const text = rawText.trim();
  const match = text.match(AMOUNT_PATTERN);

  if (!match) {
    return { amount: null, note: text, rawText: text };
  }

  const numeralToken = match[1];
  const amount = /^[0-9.]+$/.test(numeralToken) ? parseFloat(numeralToken) : chineseNumeralToNumber(numeralToken);

  // Remove the amount+unit token from the sentence; whatever remains is candidate note text.
  let remainder = (text.slice(0, match.index) + text.slice((match.index || 0) + match[0].length)).trim();

  // Strip leading/trailing filler verbs (longest match first so "花了" beats "花").
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const filler of sortedFillers) {
      if (remainder.startsWith(filler)) {
        remainder = remainder.slice(filler.length).trim();
        changed = true;
      }
      if (remainder.endsWith(filler)) {
        remainder = remainder.slice(0, remainder.length - filler.length).trim();
        changed = true;
      }
    }
  }

  // Common connector leftovers
  remainder = remainder.replace(/^(在|去|了|的)+/, '').replace(/(在|去|了|的)+$/, '').trim();

  return {
    amount: amount === null || isNaN(amount) ? null : amount,
    note: remainder || text,
    rawText: text,
  };
}
