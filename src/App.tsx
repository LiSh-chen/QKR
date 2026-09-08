/**
 * QuickLedger - 極低摩擦力記帳 APP (Ultra-Low Friction Expense Tracker)
 * Specification v1.0 Compliant Implementation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapApp } from '@capacitor/app';
import { LayoutGrid, List, Settings, Plus, Zap } from 'lucide-react';

import { Transaction, UserSettings, QuadrantType } from './types';
import {
  loadTransactions,
  saveTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  loadUserSettings,
  saveUserSettings,
  hasPersistedSettings,
  triggerHapticFeedback,
  playClickSound,
} from './lib/storage';
import { getSeedTransactions } from './data/seed';
import { QUADRANT_LIST } from './constants/quadrants';

// Components
import { QuickEntryModal } from './components/QuickEntryModal';
import { VoiceEntryModal } from './components/VoiceEntryModal';
import { WidgetDock } from './components/WidgetDock';
import { QuadrantMatrixView } from './components/QuadrantMatrixView';
import { TransactionList } from './components/TransactionList';
import { SettingsView } from './components/SettingsView';
import { findRoutineCandidate } from './lib/routine';
import {
  requestNotificationPermissions,
  registerNotificationActionTypes,
  scheduleDailyReminder,
  scheduleRoutineReminder,
  scheduleClassificationReminder,
  cancelClassificationReminder,
  addNotificationActionListener,
  NotificationTapResult,
} from './lib/notifications';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>(loadUserSettings());
  const [activeTab, setActiveTab] = useState<'quick' | 'matrix' | 'history' | 'settings'>(
    'quick'
  );

  const isDarkMode = userSettings.dark_mode_enabled;

  // Quick Entry Modal state
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickModalSource, setQuickModalSource] = useState('widget');
  const [quickModalInitialAmount, setQuickModalInitialAmount] = useState('');
  const [quickModalInitialQuadrant, setQuickModalInitialQuadrant] = useState<QuadrantType | null>(null);
  const [quickModalInitialNote, setQuickModalInitialNote] = useState('');

  // Voice Entry Modal state ('classify' mode targets one pending unclassified transaction)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [pendingClassifyTx, setPendingClassifyTx] = useState<{ id: string; amount: number; note?: string } | null>(
    null
  );

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
        if (url.host === 'voice' || url.pathname.includes('voice')) {
          setPendingClassifyTx(null);
          setIsVoiceModalOpen(true);
          return;
        }
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
      case 'classify_open':
        if (result.txId) {
          setPendingClassifyTx({ id: result.txId, amount: result.amount || 0, note: result.note });
          setIsVoiceModalOpen(true);
        }
        break;
    }
  };

  // Handle Add Transaction
  const handleSaveTransaction = (txData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    const newTx = addTransaction(txData);
    setTransactions((prev) => [newTx, ...prev]);

    if (newTx.needs_classification) {
      scheduleClassificationReminder({ id: newTx.id, amount: newTx.amount, note: newTx.note });
    }
  };

  // Finalize a "稍後分類" transaction once the user picks its quadrant
  const handleClassifyExisting = (txId: string, quadrant: QuadrantType) => {
    const updated = updateTransaction(txId, { quadrant, needs_classification: false });
    setTransactions(updated);
    cancelClassificationReminder(txId);
    setPendingClassifyTx(null);
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

  // Duplicate a set of existing transactions onto a new date (明細頁「複製到某天」)
  const handleDuplicateTransactions = (ids: string[], targetDate: string) => {
    let latest: Transaction[] = transactions;
    ids.forEach((id) => {
      const source = transactions.find((t) => t.id === id);
      if (!source) return;
      const newTx = addTransaction({
        amount: source.amount,
        quadrant: source.quadrant,
        note: source.note,
        is_lump_sum: source.is_lump_sum,
        is_zero_spend: source.is_zero_spend,
        entry_method: 'manual',
        entry_date: targetDate,
      });
      latest = [newTx, ...latest];
    });
    setTransactions(latest);
    triggerHapticFeedback('success');
  };

  // Batch reclassify (明細頁「更改分類」)
  const handleBatchReclassify = (ids: string[], quadrant: QuadrantType) => {
    let latest = transactions;
    ids.forEach((id) => {
      latest = updateTransaction(id, { quadrant, is_lump_sum: false, needs_classification: false });
    });
    setTransactions(latest);
    triggerHapticFeedback('success');
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
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter((t) => t.entry_date === todayStr);
  const todayTotal = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const NAV_ITEMS = [
    { id: 'quick', label: '快速記帳', icon: Zap, tabBg: '#e2a56e', tabBgDark: '#6b3d10', activeText: '#c9683c', activeTextDark: '#f0a868' },
    { id: 'matrix', label: '2x2 分析', icon: LayoutGrid, tabBg: '#8fb8c9', tabBgDark: '#1c3d4a', activeText: '#1e6b8a', activeTextDark: '#7ec8e3' },
    { id: 'history', label: '明細', icon: List, tabBg: '#a9c98a', tabBgDark: '#33501c', activeText: '#2e5c26', activeTextDark: '#a8dba0' },
    { id: 'settings', label: '設定', icon: Settings, tabBg: '#b3a3c2', tabBgDark: '#3d2e52', activeText: '#5a3d78', activeTextDark: '#c9a8e8' },
  ] as const;

  return (
    <div
      className="nb-desk flex flex-col text-[#3a2e18] dark:text-[#e8dcc0] font-sans transition-colors duration-200 overflow-hidden"
      style={{ height: '100dvh', paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      {/* Main Container */}
      <main
        className={`flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 pt-3 ${
          activeTab === 'quick' || activeTab === 'matrix' || activeTab === 'history'
            ? 'overflow-hidden flex flex-col pb-3'
            : 'overflow-y-auto pb-4'
        }`}
      >
        {/* Tab Views Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={
              activeTab === 'quick' || activeTab === 'matrix' || activeTab === 'history'
                ? 'flex-1 min-h-0 flex flex-col'
                : ''
            }
          >
            {activeTab === 'quick' && (
              <WidgetDock
                transactions={transactions}
                onDirectSave={handleSaveTransaction}
                onOpenQuickModal={(src, amt, q) => handleOpenQuickModal(src, amt, q)}
                onOpenVoiceModal={() => {
                  setPendingClassifyTx(null);
                  setIsVoiceModalOpen(true);
                }}
                onOpenClassify={(tx) => {
                  setPendingClassifyTx(tx);
                  setIsVoiceModalOpen(true);
                }}
                todayTotal={todayTotal}
              />
            )}

            {activeTab === 'matrix' && (
              <QuadrantMatrixView
                transactions={transactions}
                onOpenQuickModalWithQuadrant={(q) => handleOpenQuickModal(`matrix_${q}`)}
              />
            )}

            {activeTab === 'history' && (
              <TransactionList
                transactions={transactions}
                onDelete={handleDeleteTransaction}
                onBatchDelete={handleBatchDeleteTransactions}
                onBatchDuplicate={handleDuplicateTransactions}
                onBatchReclassify={handleBatchReclassify}
                onUpdateTransaction={(id, updates) => setTransactions(updateTransaction(id, updates))}
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
            className="w-14 h-14 bg-[#e8dcc0] dark:bg-[#4a3f26] border-[2.5px] border-[#4a3a20] dark:border-[#c9b98a] text-[#4a3a20] dark:text-[#e8dcc0] rounded-full shadow-2xl flex items-center justify-center transition-all group"
            style={{ boxShadow: '3px 3px 0 rgba(60,40,10,0.3)' }}
            title="快速記帳"
            id="floating-quick-action-btn"
          >
            <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform" />
          </motion.button>
        </div>
      )}

      {/* Bottom Nav — notebook index/divider tabs, each page with its own color identity;
          the active tab shares the page's paper color and sits raised/fused above the rest. */}
      <nav
        className="shrink-0 z-30 px-2 pt-1 flex items-end justify-around gap-1"
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
              className="font-hand flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold rounded-t-xl transition-all"
              style={
                isActive
                  ? {
                      backgroundColor: isDarkMode ? '#2a2418' : '#f1e9d2',
                      color: isDarkMode ? tab.activeTextDark : tab.activeText,
                      transform: 'translateY(-6px)',
                      boxShadow: '0 -3px 8px rgba(0,0,0,0.25), 0 6px 10px rgba(0,0,0,0.35)',
                      zIndex: 3,
                      paddingTop: '10px',
                      paddingBottom: '11px',
                    }
                  : {
                      backgroundColor: isDarkMode ? tab.tabBgDark : tab.tabBg,
                      color: isDarkMode ? '#d8cba8' : '#4a3420',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.35)',
                    }
              }
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

      {/* Voice Entry Modal (also reused for the "稍後分類" reminder follow-up) */}
      <VoiceEntryModal
        isOpen={isVoiceModalOpen}
        onClose={() => {
          setIsVoiceModalOpen(false);
          setPendingClassifyTx(null);
        }}
        onSaveNew={handleSaveTransaction}
        onClassifyExisting={handleClassifyExisting}
        pendingClassifyTx={pendingClassifyTx}
      />
    </div>
  );
}
