import { Transaction } from '../types';
import { QUADRANT_LIST } from '../constants/quadrants';

export interface InsightResult {
  emoji: string;
  title: string;
  lines: string[];
}

type InsightFn = (transactions: Transaction[]) => InsightResult | null;

function dayKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** 1. 衝動指數趨勢 — 「非必要×偶發」佔比逐月變化 */
const impulseIndexTrend: InsightFn = (transactions) => {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}月` });
  }

  const ratios = months.map(({ key, label }) => {
    const monthTx = transactions.filter((t) => t.entry_date?.startsWith(key));
    const total = monthTx.reduce((s, t) => s + t.amount, 0);
    const impulse = monthTx.filter((t) => t.quadrant === 'UNNECESSARY_URGENT').reduce((s, t) => s + t.amount, 0);
    const pct = total > 0 ? Math.round((impulse / total) * 100) : 0;
    return { label, pct };
  });

  if (ratios.every((r) => r.pct === 0)) return null;

  const latest = ratios[ratios.length - 1];
  const bar = (pct: number) => '█'.repeat(Math.max(1, Math.round(pct / 10))) + '░'.repeat(Math.max(0, 10 - Math.round(pct / 10)));
  const verdict =
    latest.pct >= 55 ? '這個月有點失控 🔥' : latest.pct >= 35 ? '偶爾放縱一下，還在可接受範圍' : '這個月很克制，繼續保持！';

  return {
    emoji: '🎯',
    title: '衝動指數趨勢',
    lines: [...ratios.map((r) => `${r.label} ${bar(r.pct)} ${r.pct}%`), '', verdict],
  };
};

/** 2. 最貴的一天 / 最省的一天 */
const extremeDays: InsightFn = (transactions) => {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter((t) => t.entry_date?.startsWith(monthPrefix));
  if (monthTx.length === 0) return null;

  const byDay: Record<string, { total: number; notes: string[] }> = {};
  monthTx.forEach((t) => {
    if (!t.entry_date) return;
    if (!byDay[t.entry_date]) byDay[t.entry_date] = { total: 0, notes: [] };
    byDay[t.entry_date].total += t.amount;
    if (t.note) byDay[t.entry_date].notes.push(t.note);
  });

  const days = Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  if (days.length === 0) return null;

  const priciest = days.reduce((a, b) => (b.total > a.total ? b : a));
  const cheapest = days.reduce((a, b) => (b.total < a.total ? b : a));

  return {
    emoji: '📅',
    title: '本月最貴 / 最省的一天',
    lines: [
      `💸 最貴：${priciest.date.slice(5)} 花了 $${priciest.total.toLocaleString()}`,
      priciest.notes.length > 0 ? `　　（${priciest.notes.slice(0, 3).join('、')}）` : '',
      `🌱 最省：${cheapest.date.slice(5)} 只花了 $${cheapest.total.toLocaleString()}`,
    ].filter(Boolean),
  };
};

/** 3. 星期消費熱點 */
const weekdayHotspot: InsightFn = (transactions) => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 56);
  const recentTx = transactions.filter((t) => t.entry_date && new Date(t.entry_date) >= cutoff);
  if (recentTx.length < 5) return null;

  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  recentTx.forEach((t) => {
    if (!t.entry_date) return;
    const dow = new Date(t.entry_date).getDay();
    sums[dow] += t.amount;
    counts[dow]++;
  });

  const avgs = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  const maxIdx = avgs.indexOf(Math.max(...avgs));
  const validAvgs = avgs.filter((_, i) => counts[i] > 0);
  const minIdx = avgs.indexOf(Math.min(...validAvgs));

  return {
    emoji: '📊',
    title: '星期消費熱點（近8週）',
    lines: [
      `週${labels[maxIdx]}是你最容易花錢的日子，平均一次 $${Math.round(avgs[maxIdx]).toLocaleString()}`,
      `週${labels[minIdx]}相對最省，平均只花 $${Math.round(avgs[minIdx]).toLocaleString()}`,
    ],
  };
};

/** 4. 「照這樣花，一年後...」推算 */
const yearlyProjection: InsightFn = (transactions) => {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter((t) => t.entry_date?.startsWith(monthPrefix));
  const total = monthTx.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return null;

  const avgPerDay = total / now.getDate();
  const yearProjection = Math.round(avgPerDay * 365);
  const monthProjection = Math.round(avgPerDay * 30);

  return {
    emoji: '🔮',
    title: '照這樣的花錢速度...',
    lines: [
      `你目前日均花費 $${Math.round(avgPerDay).toLocaleString()}`,
      `📆 一個月下來大約 $${monthProjection.toLocaleString()}`,
      `📈 一整年下來大約 $${yearProjection.toLocaleString()}`,
      yearProjection > 300000 ? '（這數字有點嚇人，要不要看看能省哪裡？）' : '（還算穩健，繼續保持）',
    ],
  };
};

/** 5. 這個月最像哪個月（依四象限花費結構的相似度，非金額大小） */
const mostSimilarMonth: InsightFn = (transactions) => {
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const [currentKey, ...pastKeys] = monthKeys;

  const vectorFor = (key: string): number[] | null => {
    const monthTx = transactions.filter((t) => t.entry_date?.startsWith(key) && t.quadrant);
    const total = monthTx.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return null;
    return QUADRANT_LIST.map((q) => monthTx.filter((t) => t.quadrant === q).reduce((s, t) => s + t.amount, 0) / total);
  };

  const currentVec = vectorFor(currentKey);
  if (!currentVec) return null;

  let bestKey: string | null = null;
  let bestScore = -1;
  pastKeys.forEach((key) => {
    const vec = vectorFor(key);
    if (!vec) return;
    const dot = vec.reduce((s, v, i) => s + v * currentVec[i], 0);
    const magA = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(currentVec.reduce((s, v) => s + v * v, 0));
    const score = magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  if (!bestKey || bestScore < 0.7) return null;

  const [, m] = (bestKey as string).split('-');
  return {
    emoji: '🔁',
    title: '這個月最像哪個月？',
    lines: [
      `這個月的花錢「結構」跟 ${Number(m)} 月最相似（相似度 ${Math.round(bestScore * 100)}%）`,
      '不是金額像，是必要/非必要、固定/偶發的比例分佈很接近',
      '好像又進入某種固定循環了 👀',
    ],
  };
};

const ALL_INSIGHTS: InsightFn[] = [impulseIndexTrend, extremeDays, weekdayHotspot, yearlyProjection, mostSimilarMonth];

/** Short labels for each wedge of the lottery wheel, same order as ALL_INSIGHTS. */
export const INSIGHT_WHEEL_LABELS = ['衝動指數', '最貴/省日', '星期熱點', '年度推算', '最像哪月'];
export const INSIGHT_WHEEL_COLORS = ['#7a2020', '#1e4a78', '#2e5c26', '#7a5314', '#5a3d78'];

function seededIndex(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % mod;
}

export interface DailyInsightPick {
  index: number;
  result: InsightResult;
}

/**
 * Picks today's insight index (same pick all day, changes tomorrow), or a
 * fresh random one if forceRandom is set. Falls back through the other
 * modules in rotation if the first pick has no usable data, so the wheel
 * never lands on a segment with nothing to show.
 */
export function pickDailyInsight(transactions: Transaction[], forceRandom = false): DailyInsightPick | null {
  const startIdx = forceRandom
    ? Math.floor(Math.random() * ALL_INSIGHTS.length)
    : seededIndex(dayKey(new Date()), ALL_INSIGHTS.length);

  for (let offset = 0; offset < ALL_INSIGHTS.length; offset++) {
    const idx = (startIdx + offset) % ALL_INSIGHTS.length;
    const result = ALL_INSIGHTS[idx](transactions);
    if (result) return { index: idx, result };
  }
  return null;
}

