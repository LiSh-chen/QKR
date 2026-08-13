/**
 * QuickLedger - 極低摩擦力記帳 APP (Ultra-Low Friction Expense Tracker)
 * Specification v1.0 Compliant Implementation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapApp } from '@capacitor/app';
import { LayoutGrid, Flame, List, Settings, Plus, Zap } from 'lucide-react';

import { Transaction, UserSettings, QuadrantType } from './types';
import {
  loadTransactions,
  saveTransactions,
  addTransaction,
  deleteTransaction,
  loadUserSettings,
  saveUserSettings,
  hasPersistedSettings,
  calculateStreakStats,
  triggerHapticFeedback,
  playClickSound,
} from './lib/storage';
import { getSeedTransactions } from './data/seed';
import { QUADRANT_LIST } from './constants/quadrants';

// Components
import { QuickEntryModal } from './components/QuickEntryModal';
import { WidgetDock } from './components/WidgetDock';
import { QuadrantMatrixView } from './components/QuadrantMatrixView';
import { StreakView } from './components/StreakView';
import { TransactionList } from './components/TransactionList';
import { SettingsView } from './components/SettingsView';
import { findRoutineCandidate } from './lib/routine';
import {
  requestNotificationPermissions,
  registerNotificationActionTypes,
  scheduleDailyReminder,
  scheduleRoutineReminder,
  addNotificationActionListener,
  NotificationTapResult,
} from './lib/notifications';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>(loadUserSettings());
  const [activeTab, setActiveTab] = useState<'quick' | 'matrix' | 'streak' | 'history' | 'settings'>(
    'quick'
  );

  const isDarkMode = userSettings.dark_mode_enabled;

  // Quick Entry Modal state
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickModalSource, setQuickModalSource] = useState('widget');
  const [quickModalInitialAmount, setQuickModalInitialAmount] = useState('');
  const [quickModalInitialQuadrant, setQuickModalInitialQuadrant] = useState<QuadrantType | null>(null);
  const [quickModalInitialNote, setQuickModalInitialNote] = useState('');

  // Routine Reminder dismissal / already-notified state (avoid re-firing the same candidate)
  const [dismissedRoutineIds, setDismissedRoutineIds] = useState<string[]>([]);
  const [notifiedRoutineId, setNotifiedRoutineId] = useState<string | null>(null);

  // --- Init: load data, deep links, notification permissions/listener ---
  useEffect(() => {
    const loaded = loadTransactions();
    setTransactions(loaded);

    // First run only: default dark mode to the system preference
    if (!hasPersistedSettings() && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      handleUpdateSettings({ dark_mode_enabled: true });
    }

    const checkUrlAndOpenModal = (urlString: string) => {
      try {
        const url = new URL(urlString);
        const quadrantParam = url.searchParams.get('quadrant') as QuadrantType | null;
        if (quadrantParam && QUADRANT_LIST.includes(quadrantParam)) {
          handleOpenQuickModal('widget', '', quadrantParam);
        } else if (url.searchParams.has('action') || url.pathname.includes('add')) {
          handleOpenQuickModal('widget');
        }
      } catch (e) {
        // Ignore invalid URL parse
      }
    };

    if (window.location.search) {
      checkUrlAndOpenModal(window.location.href);
    }

    // Deep link open from the real Android home-screen Widget
    CapApp.addListener('appUrlOpen', (data) => {
      if (data.url) checkUrlAndOpenModal(data.url);
    });

    // Real system notification setup
    requestNotificationPermissions();
    registerNotificationActionTypes();
    addNotificationActionListener(handleNotificationTap);
  }, []);

  // Keep the daily settlement reminder in sync with settings (real OS notification)
  useEffect(() => {
    scheduleDailyReminder(userSettings.daily_reminder_time, userSettings.reminder_enabled);
  }, [userSettings.daily_reminder_time, userSettings.reminder_enabled]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Routine Reminder candidate detection -> fire as a REAL system notification
  const routineCandidate = findRoutineCandidate(transactions, dismissedRoutineIds);

  useEffect(() => {
    if (routineCandidate && routineCandidate.pastTx.id !== notifiedRoutineId) {
      scheduleRoutineReminder(routineCandidate);
      setNotifiedRoutineId(routineCandidate.pastTx.id);
    }
  }, [routineCandidate?.pastTx.id]);

  // Handle a tap / action-button press coming from a system notification
  const handleNotificationTap = (result: NotificationTapResult) => {
    switch (result.kind) {
      case 'daily_zero':
        handleSaveTransaction({
          amount: 0,
          quadrant: null,
          note: '今日 $0 支出（推播一鍵完成）',
          is_lump_sum: false,
          is_zero_spend: true,
          entry_method: 'notification_zero',
          entry_date: new Date().toISOString().split('T')[0],
        });
        break;
      case 'daily_open':
        handleOpenQuickModal('notification_quick_input');
        break;
      case 'routine_accept':
        if (typeof result.amount === 'number') {
          handleSaveTransaction({
            amount: result.amount,
            quadrant: result.quadrant ?? null,
            note: result.note || '自動帶入昨日相同時段消費',
            is_lump_sum: false,
            is_zero_spend: false,
            entry_method: 'notification_quick_input',
            entry_date: new Date().toISOString().split('T')[0],
          });
        }
        break;
      case 'routine_adjust':
        handleOpenQuickModal(
          'routine_notification',
          typeof result.amount === 'number' ? result.amount.toString() : '',
          result.quadrant ?? null,
          result.note
        );
        break;
    }
  };

  // Handle Add Transaction
  const handleSaveTransaction = (txData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const newTx = addTransaction(txData);
    setTransactions((prev) => [newTx, ...prev]);
  };

  // Handle Delete
  const handleDeleteTransaction = (id: string) => {
    const updated = deleteTransaction(id);
    setTransactions(updated);
    triggerHapticFeedback('medium');
  };

  // Handle Batch Delete
  const handleBatchDeleteTransactions = (ids: string[]) => {
    let current = transactions;
    ids.forEach((id) => {
      current = deleteTransaction(id);
    });
    setTransactions(current);
    triggerHapticFeedback('medium');
  };

  // Handle Settings Update
  const handleUpdateSettings = (updates: Partial<UserSettings>) => {
    setUserSettings((prev) => {
      const updated = { ...prev, ...updates };
      saveUserSettings(updated);
      return updated;
    });
  };

  // Handle Reset Data
  const handleResetToSeed = () => {
    const seed = getSeedTransactions();
    saveTransactions(seed);
    setTransactions(seed);
    triggerHapticFeedback('success');
  };

  // Open Quick Modal Helper
  const handleOpenQuickModal = (
    source: string = 'widget',
    initialAmount: string = '',
    initialQuadrant: QuadrantType | null = null,
    initialNote: string = ''
  ) => {
    setQuickModalSource(source);
    setQuickModalInitialAmount(initialAmount);
    setQuickModalInitialNote(initialNote);

    let detectedQ: QuadrantType | null = initialQuadrant;
    if (!detectedQ && source) {
      for (const qKey of QUADRANT_LIST) {
        if (source.includes(qKey)) {
          detectedQ = qKey as QuadrantType;
          break;
        }
      }
    }

    setQuickModalInitialQuadrant(detectedQ);
    setIsQuickModalOpen(true);
  };

  // Calculations
  const streakStats = calculateStreakStats(transactions);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter((t) => t.entry_date === todayStr);
  const todayTotal = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const NAV_ITEMS = [
    { id: 'quick', label: '快速記帳', icon: Zap },
    { id: 'matrix', label: '2x2 分析', icon: LayoutGrid },
    { id: 'streak', label: 'Streak', icon: Flame },
    { id: 'history', label: '明細', icon: List },
    { id: 'settings', label: '設定', icon: Settings },
  ] as const;

  return (
    <div
      className="min-h-screen bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans transition-colors duration-200"
      style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
    >
      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-4">
        {/* Tab Views Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'quick' && (
              <WidgetDock
                onDirectSave={handleSaveTransaction}
                onOpenQuickModal={(src, amt, q) => handleOpenQuickModal(src, amt, q)}
                todayTotal={todayTotal}
                currentStreak={streakStats.currentStreak}
              />
            )}

            {activeTab === 'matrix' && (
              <QuadrantMatrixView
                transactions={transactions}
                onOpenQuickModalWithQuadrant={(q) => handleOpenQuickModal(`matrix_${q}`)}
              />
            )}

            {activeTab === 'streak' && (
              <StreakView
                streakStats={streakStats}
                transactions={transactions}
                onOpenQuickModal={() => handleOpenQuickModal('streak_page')}
              />
            )}

            {activeTab === 'history' && (
              <TransactionList
                transactions={transactions}
                onDelete={handleDeleteTransaction}
                onBatchDelete={handleBatchDeleteTransactions}
                onOpenQuickModal={() => handleOpenQuickModal('history_page')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={userSettings}
                onUpdateSettings={handleUpdateSettings}
                transactions={transactions}
                onImportTransactions={(imported) => {
                  saveTransactions(imported);
                  setTransactions(imported);
                }}
                onResetToSeed={handleResetToSeed}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Quick Action Button — hidden on the quick-entry tab itself (redundant there) */}
      {activeTab !== 'quick' && (
        <div
          className="fixed right-4 z-40"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleOpenQuickModal('floating_btn')}
            className="w-14 h-14 bg-orange-600 hover:bg-orange-500 text-white rounded-full shadow-2xl shadow-orange-900/40 border-2 border-white/20 flex items-center justify-center transition-all group"
            title="快速記帳"
            id="floating-quick-action-btn"
          >
            <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform" />
          </motion.button>
        </div>
      )}

      {/* Bottom Quick Nav (primary navigation, always visible) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 px-2 pt-1.5 flex items-center justify-around shadow-lg"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        {NAV_ITEMS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                triggerHapticFeedback('light');
                playClickSound(700);
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-bold transition-colors ${
                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              id={`tab-${tab.id}`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Entry Modal */}
      <QuickEntryModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSave={handleSaveTransaction}
        initialSource={quickModalSource}
        initialAmount={quickModalInitialAmount}
        initialQuadrant={quickModalInitialQuadrant}
        initialNote={quickModalInitialNote}
      />
    </div>
  );
}
