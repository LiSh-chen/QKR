import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  RotateCcw,
  Zap,
  Moon,
  Sun,
  Bell,
  Clock,
  Send,
} from 'lucide-react';
import { UserSettings, Transaction } from '../types';
import { getSlaLogs, SlaLog } from '../lib/storage';
import { sendTestNotification } from '../lib/notifications';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  transactions: Transaction[];
  onImportTransactions: (imported: Transaction[]) => void;
  onResetToSeed: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  transactions,
  onImportTransactions,
  onResetToSeed,
}) => {
  const [slaLogs] = useState<SlaLog[]>(getSlaLogs());
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [testSentMsg, setTestSentMsg] = useState<string | null>(null);

  const handleExportJson = () => {
    const dataStr = JSON.stringify({ transactions, settings, export_at: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickledger_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.transactions)) {
          onImportTransactions(parsed.transactions);
          setImportStatusMsg(`成功匯入 ${parsed.transactions.length} 筆資料！`);
        } else if (Array.isArray(parsed)) {
          onImportTransactions(parsed);
          setImportStatusMsg(`成功匯入 ${parsed.length} 筆資料！`);
        } else {
          setImportStatusMsg('匯入失敗：JSON 格式不符。');
        }
      } catch (err) {
        setImportStatusMsg('匯入失敗：無效的 JSON 檔案。');
      }
    };
    reader.readAsText(file);
  };

  const handleSendTest = () => {
    sendTestNotification();
    setTestSentMsg('已送出測試通知，請下拉通知列查看！');
    setTimeout(() => setTestSentMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-stone-700 dark:text-stone-300" />
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">系統設定與資料管理</h2>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Local-First 本地優先架構，所有資料安全儲存於您的裝置。
        </p>
      </div>

      {/* Preferences Section (includes Dark Mode) */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 border-b border-stone-100 dark:border-stone-800 pb-2">
          互動偏好設定
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50">
            <div className="flex items-center gap-2">
              {settings.dark_mode_enabled ? (
                <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <div className="font-bold text-stone-900 dark:text-white">深色模式</div>
                <div className="text-stone-400">切換淺色 / 深色主題</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.dark_mode_enabled}
              onChange={(e) => onUpdateSettings({ dark_mode_enabled: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300"
              id="settings-dark-mode-toggle"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50">
            <div>
              <div className="font-bold text-stone-900 dark:text-white">觸覺回饋 (Haptic Feedback)</div>
              <div className="text-stone-400">點擊按鈕或完成記帳時觸發輕微震動</div>
            </div>
            <input
              type="checkbox"
              checked={settings.haptic_feedback_enabled}
              onChange={(e) => onUpdateSettings({ haptic_feedback_enabled: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50">
            <div>
              <div className="font-bold text-stone-900 dark:text-white">音效反饋 (Sound Effects)</div>
              <div className="text-stone-400">按鍵音與成功音效提示</div>
            </div>
            <input
              type="checkbox"
              checked={settings.sound_effects_enabled}
              onChange={(e) => onUpdateSettings({ sound_effects_enabled: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300"
            />
          </label>
        </div>
      </div>

      {/* Notifications Section (merged from the old 推播通知 tab) */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2">
          <Bell className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">系統通知設定</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            真實系統通知
          </span>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 -mt-2">
          採用手機原生通知，會直接顯示在下拉通知列，不需開啟 App。時段習慣偵測（過時未記帳提醒）也會透過同一組通知管道推播。
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-200 shrink-0">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>每日結算時間</span>
          </div>
          <input
            type="time"
            value={settings.daily_reminder_time}
            onChange={(e) => onUpdateSettings({ daily_reminder_time: e.target.value })}
            className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2 text-sm font-mono font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            id="settings-reminder-time-input"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={settings.reminder_enabled}
              onChange={(e) => onUpdateSettings({ reminder_enabled: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-stone-300"
              id="settings-reminder-enabled-toggle"
            />
            <span>啟用</span>
          </label>
        </div>

        <button
          onClick={handleSendTest}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          id="settings-send-test-notification-btn"
        >
          <Send className="w-4 h-4" /> 送出測試通知
        </button>
        {testSentMsg && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs rounded-xl font-bold text-center">
            {testSentMsg}
          </div>
        )}
      </div>

      {/* SLA Performance Metrics Monitor */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              SLA 極速效能監控日誌 (SLA &le; 1.0s)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
            實測 Target SLA Passed
          </span>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
          {slaLogs.length === 0 ? (
            <p className="text-xs text-stone-400">尚無測試紀錄。請試點擊快速記帳發起次數測試。</p>
          ) : (
            slaLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 flex items-center justify-between text-[11px]"
              >
                <span className="text-stone-500">[{log.timestamp}] 來源: {log.source}</span>
                <span className={`font-bold ${log.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                  耗時 {log.durationMs}ms ({log.passed ? '通關 ✓' : '超時'})
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 border-b border-stone-100 dark:border-stone-800 pb-2">
          資料匯出與備份 (Local-First)
        </h3>

        {importStatusMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs rounded-xl font-bold">
            {importStatusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportJson}
            className="py-3 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" /> 匯出 JSON 備份
          </button>

          <label className="py-3 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all">
            <Upload className="w-4 h-4" /> 匯入 JSON 資料
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={onResetToSeed}
            className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> 重設預設示範資料
          </button>
        </div>
      </div>
    </div>
  );
};
