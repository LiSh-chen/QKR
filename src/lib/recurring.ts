import { RecurringRule, Transaction } from '../types';
import { addTransaction, updateRecurringRule } from './storage';

function getCurrentMonthPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Sunday of the given date's week, as YYYY-MM-DD — used as the "period" key for weekly rules. */
function getCurrentWeekPeriod(d: Date): string {
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split('T')[0];
}

function isRuleDueToday(rule: RecurringRule, today: Date): boolean {
  if (!rule.enabled) return false;

  if (rule.frequency === 'monthly') {
    const period = getCurrentMonthPeriod(today);
    if (rule.lastTriggeredPeriod === period) return false;
    return today.getDate() >= (rule.dayOfMonth || 1);
  }

  const period = getCurrentWeekPeriod(today);
  if (rule.lastTriggeredPeriod === period) return false;
  return today.getDay() === (rule.dayOfWeek ?? 0);
}

export interface RecurringCheckResult {
  updatedRules: RecurringRule[];
  newTransactions: Transaction[];
  reminders: RecurringRule[];
}

/**
 * Call once per app launch. For every enabled rule that's newly due this
 * period: if autoRecord is on, silently write the transaction; otherwise
 * surface it so the caller can push a reminder. Either way the rule's
 * lastTriggeredPeriod is stamped so it won't fire again until next period.
 */
export function processRecurringRules(rules: RecurringRule[]): RecurringCheckResult {
  const today = new Date();
  const newTransactions: Transaction[] = [];
  const reminders: RecurringRule[] = [];
  let updatedRules = rules;

  rules.forEach((rule) => {
    if (!isRuleDueToday(rule, today)) return;

    const period = rule.frequency === 'monthly' ? getCurrentMonthPeriod(today) : getCurrentWeekPeriod(today);

    if (rule.autoRecord) {
      const tx = addTransaction({
        amount: rule.amount,
        quadrant: rule.quadrant,
        note: rule.note,
        is_lump_sum: false,
        is_zero_spend: false,
        entry_method: 'recurring',
        entry_date: today.toISOString().split('T')[0],
      });
      newTransactions.push(tx);
    } else {
      reminders.push(rule);
    }

    updatedRules = updateRecurringRule(rule.id, { lastTriggeredPeriod: period });
  });

  return { updatedRules, newTransactions, reminders };
}
