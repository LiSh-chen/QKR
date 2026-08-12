import { QuadrantMeta, QuadrantType } from '../types';

export const QUADRANT_CONFIGS: Record<QuadrantType, QuadrantMeta> = {
  NECESSARY_DAILY: {
    type: 'NECESSARY_DAILY',
    title: '必要 × 日常',
    subTitle: '生存與生活基礎開銷',
    examples: ['三餐飲食', '房租水電', '通勤交通', '日常用品'],
    axisX: '日常',
    axisY: '必要',
    color: '#059669', // Emerald
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    hoverColor: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
    activeColor: 'bg-emerald-600 text-white dark:bg-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    iconName: 'UtensilsCrossed',
  },
  NECESSARY_URGENT: {
    type: 'NECESSARY_URGENT',
    title: '必要 × 臨時',
    subTitle: '突發且不可避免的開支',
    examples: ['看診醫藥', '突發修繕', '公務規費', '臨時維修'],
    axisX: '臨時',
    axisY: '必要',
    color: '#2563EB', // Blue
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
    hoverColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/60',
    activeColor: 'bg-blue-600 text-white dark:bg-blue-500',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200',
    textColor: 'text-blue-700 dark:text-blue-300',
    iconName: 'Stethoscope',
  },
  UNNECESSARY_DAILY: {
    type: 'UNNECESSARY_DAILY',
    title: '非必要 × 日常',
    subTitle: '習慣性微小的娛樂或享受',
    examples: ['手搖飲/咖啡', '訂閱服務', '日常零食', '手遊微課'],
    axisX: '日常',
    axisY: '非必要',
    color: '#D97706', // Amber
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    hoverColor: 'hover:bg-amber-100 dark:hover:bg-amber-900/60',
    activeColor: 'bg-amber-600 text-white dark:bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
    textColor: 'text-amber-700 dark:text-amber-300',
    iconName: 'Coffee',
  },
  UNNECESSARY_URGENT: {
    type: 'UNNECESSARY_URGENT',
    title: '非必要 × 臨時',
    subTitle: '偶發高額或衝動消費',
    examples: ['奢侈名牌', '大餐聚會', '旅遊娛樂', '衝動購物'],
    axisX: '臨時',
    axisY: '非必要',
    color: '#DC2626', // Red
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
    hoverColor: 'hover:bg-rose-100 dark:hover:bg-rose-900/60',
    activeColor: 'bg-rose-600 text-white dark:bg-rose-500',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200',
    textColor: 'text-rose-700 dark:text-rose-300',
    iconName: 'ShoppingBag',
  },
};

export const QUADRANT_LIST: QuadrantType[] = [
  'NECESSARY_DAILY',
  'NECESSARY_URGENT',
  'UNNECESSARY_DAILY',
  'UNNECESSARY_URGENT',
];
