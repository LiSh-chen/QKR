import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  RotateCcw,
  Zap,
  Bell,
  Clock,
  Send,
} from 'lucide-react';
import { UserSettings, Transaction } from '../types';
import { getSlaLogs, SlaLog } from '../lib/storage';
import { sendTestNotification } from '../lib/notifications';
import { RoughBox, RoughCheckbox } from './RoughBox';

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
    <div className="space-y-6 nb-ruled rounded-3xl p-3.5 relative min-h-full">
      <div className="nb-binder" />
      <div className="nb-holes">
        <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
      </div>
      <div className="ml-4 space-y-4">
        <RoughBox shape="rectangle" stroke="#3a2e18" strokeWidth={1.4} roughness={1.4} className="p-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-stone-700" />
            <h2 className="font-hand pencil-text text-xl font-bold text-[#3a2e18]">系統設定與資料管理</h2>
          </div>
          <p className="font-hand pencil-text text-xs text-stone-500 mt-1">
            Local-First 本地優先架構，所有資料安全儲存於您的裝置。
          </p>
        </RoughBox>

        <RoughBox shape="rectangle" stroke="#8a7454" strokeWidth={1.3} roughness={1.5} className="p-5 space-y-4">
          <h3 className="font-hand pencil-text text-sm font-bold text-stone-800 border-b border-[#a08a5c]/50 pb-2">
            互動偏好設定
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl">
              <div>
                <div className="font-hand pencil-text font-bold text-[#3a2e18]">觸覺回饋 (Haptic Feedback)</div>
                <div className="font-hand pencil-text text-[#8a7a5a]">點擊按鈕或完成記帳時觸發輕微震動</div>
              </div>
              <RoughCheckbox
                checked={settings.haptic_feedback_enabled}
                onChange={() => onUpdateSettings({ haptic_feedback_enabled: !settings.haptic_feedback_enabled })}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl">
              <div>
                <div className="font-hand pencil-text font-bold text-[#3a2e18]">音效反饋 (Sound Effects)</div>
                <div className="font-hand pencil-text text-[#8a7a5a]">按鍵音與成功音效提示</div>
              </div>
              <RoughCheckbox
                checked={settings.sound_effects_enabled}
                onChange={() => onUpdateSettings({ sound_effects_enabled: !settings.sound_effects_enabled })}
                className="w-5 h-5"
              />
            </label>
          </div>
        </RoughBox>

        <RoughBox shape="rectangle" stroke="#5a5a9e" strokeWidth={1.3} roughness={1.5} className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#a08a5c]/50 pb-2">
            <Bell className="w-4 h-4 text-indigo-500" />
            <h3 className="font-hand pencil-text text-sm font-bold text-stone-800">系統通知設定</h3>
            <span className="font-hand pencil-text px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
              真實系統通知
            </span>
          </div>
          <p className="font-hand pencil-text text-xs text-stone-500 -mt-2">
            採用手機原生通知，會直接顯示在下拉通知列，不需開啟 App。時段習慣偵測（過時未記帳提醒）也會透過同一組通知管道推播。
          </p>

          <div className="flex items-center gap-3">
            <div className="font-hand pencil-text flex items-center gap-2 text-xs font-bold text-[#5a4a2a] shrink-0">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>每日結算時間</span>
            </div>
            <input
              type="time"
              value={settings.daily_reminder_time}
              onChange={(e) => onUpdateSettings({ daily_reminder_time: e.target.value })}
              className="font-hand bg-white/40 border-[1.5px] border-dashed border-[#a08a5c]/60 rounded-xl px-4 py-2 text-sm font-mono font-bold text-[#3a2e18] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              id="settings-reminder-time-input"
            />
            <label className="font-hand pencil-text flex items-center gap-2 text-xs font-medium text-[#5a4a2a] cursor-pointer ml-auto">
              <RoughCheckbox
                checked={settings.reminder_enabled}
                onChange={() => onUpdateSettings({ reminder_enabled: !settings.reminder_enabled })}
                className="w-5 h-5"
              />
              <span>啟用</span>
            </label>
          </div>

          <RoughBox
            shape="rectangle"
            stroke="#3730a3"
            strokeWidth={1.8}
            roughness={1.7}
            fill="#4338ca"
            fillStyle="solid"
            onClick={handleSendTest}
            className="w-full py-3 font-hand pencil-text text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            id="settings-send-test-notification-btn"
          >
            <Send className="w-4 h-4" /> 送出測試通知
          </RoughBox>
          {testSentMsg && (
            <div className="font-hand pencil-text p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold text-center">
              {testSentMsg}
            </div>
          )}
        </RoughBox>

        <RoughBox shape="rectangle" stroke="#2e5c26" strokeWidth={1.3} roughness={1.5} className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              <h3 className="font-hand pencil-text text-sm font-bold text-stone-800">
                SLA 極速效能監控日誌 (SLA &le; 1.0s)
              </h3>
            </div>
            <span className="font-hand pencil-text text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              實測 Target SLA Passed
            </span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
            {slaLogs.length === 0 ? (
              <p className="font-hand pencil-text text-xs text-[#8a7a5a]">尚無測試紀錄。請試點擊快速記帳發起次數測試。</p>
            ) : (
              slaLogs.map((log, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-white/8 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">[{log.timestamp}] 來源: {log.source}</span>
                  <span className={`font-bold ${log.passed ? 'text-emerald-600' : 'text-amber-500'}`}>
                    耗時 {log.durationMs}ms ({log.passed ? '通關 ✓' : '超時'})
                  </span>
                </div>
              ))
            )}
          </div>
        </RoughBox>

        <RoughBox shape="rectangle" stroke="#8a7454" strokeWidth={1.3} roughness={1.5} className="p-5 space-y-4">
          <h3 className="font-hand pencil-text text-sm font-bold text-stone-800 border-b border-[#a08a5c]/50 pb-2">
            資料匯出與備份 (Local-First)
          </h3>

          {importStatusMsg && (
            <div className="font-hand pencil-text p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold">
              {importStatusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <RoughBox
              shape="rectangle"
              stroke="#3a2e18"
              strokeWidth={1.4}
              roughness={1.6}
              onClick={handleExportJson}
              className="py-3 px-4 font-hand pencil-text text-stone-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> 匯出 JSON 備份
            </RoughBox>

            <label className="relative">
              <RoughBox
                shape="rectangle"
                stroke="#3a2e18"
                strokeWidth={1.4}
                roughness={1.6}
                className="py-3 px-4 font-hand pencil-text text-stone-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> 匯入 JSON 資料
              </RoughBox>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <RoughBox
              shape="rectangle"
              stroke="#7a2020"
              strokeWidth={1.4}
              roughness={1.6}
              onClick={onResetToSeed}
              className="py-3 px-4 font-hand pencil-text text-rose-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> 重設預設示範資料
            </RoughBox>
          </div>
        </RoughBox>
      </div>
    </div>
  );
};
