import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Clock3, PiggyBank } from 'lucide-react';
import { QuadrantType, Transaction } from '../types';
import { QUADRANT_CONFIGS, QUADRANT_LIST } from '../constants/quadrants';
import { playClickSound, triggerHapticFeedback } from '../lib/storage';
import { startListening, stopListening, parseVoiceText } from '../lib/voiceEntry';

interface VoiceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** New voice-captured transaction to save. */
  onSaveNew: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  /** Finalize an existing "稍後分類" transaction's quadrant. */
  onClassifyExisting?: (txId: string, quadrant: QuadrantType) => void;
  /** When present, the modal opens directly in "classify" mode for this pending transaction. */
  pendingClassifyTx?: { id: string; amount: number; note?: string } | null;
}

const QUADRANT_STICKY_STYLE: Record<
  QuadrantType,
  { bg: string; border: string; text: string; rotate: string; radius: string }
> = {
  NECESSARY_DAILY: { bg: '#c8e6c0', border: '#2e5c26', text: '#2e5c26', rotate: '-1.5deg', radius: 'nb-blob-sticky-a' },
  NECESSARY_URGENT: { bg: '#bcd8f0', border: '#1e4a78', text: '#1e4a78', rotate: '1deg', radius: 'nb-blob-sticky-b' },
  UNNECESSARY_DAILY: { bg: '#f5dca0', border: '#7a5314', text: '#7a5314', rotate: '1.5deg', radius: 'nb-blob-sticky-a' },
  UNNECESSARY_URGENT: { bg: '#f0b8b8', border: '#7a2020', text: '#7a2020', rotate: '-1deg', radius: 'nb-blob-sticky-b' },
};

type Stage = 'idle' | 'listening' | 'error' | 'review';

export const VoiceEntryModal: React.FC<VoiceEntryModalProps> = ({
  isOpen,
  onClose,
  onSaveNew,
  onClassifyExisting,
  pendingClassifyTx,
}) => {
  const isClassifyMode = !!pendingClassifyTx;

  const [stage, setStage] = useState<Stage>(isClassifyMode ? 'review' : 'idle');
  const [liveText, setLiveText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [amount, setAmount] = useState<string>(pendingClassifyTx ? String(pendingClassifyTx.amount) : '');
  const [note, setNote] = useState<string>(pendingClassifyTx?.note || '');

  const startedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setLiveText('');
    setErrorMsg('');

    if (pendingClassifyTx) {
      setStage('review');
      setAmount(String(pendingClassifyTx.amount));
      setNote(pendingClassifyTx.note || '');
      return;
    }

    setStage('idle');
    setAmount('');
    setNote('');
    startedRef.current = false;
  }, [isOpen, pendingClassifyTx]);

  const beginListening = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStage('listening');
    setLiveText('');
    triggerHapticFeedback('light');

    await startListening({
      onPartialResult: (text) => setLiveText(text),
      onFinalResult: (text) => {
        setLiveText(text);
        triggerHapticFeedback('success');
        playClickSound(1200);
        startedRef.current = false;

        const parsed = parseVoiceText(text);
        setAmount(parsed.amount !== null ? String(parsed.amount) : '');
        setNote(parsed.note);
        setStage('review');
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setStage('error');
        triggerHapticFeedback('medium');
        startedRef.current = false;
      },
    });
  };

  const handleStopListening = () => {
    triggerHapticFeedback('medium');
    // Recognition keeps running in the background; this just tells it "that's
    // everything I said" so the final transcript comes back right away instead
    // of waiting for the OS's own (sometimes slow, sometimes premature) silence
    // detection to decide when speech has ended.
    stopListening();
  };

  // If the modal is closed mid-recording, stop the recognizer so it doesn't
  // keep listening in the background after the sheet is gone.
  const handleClose = () => {
    if (stage === 'listening') {
      stopListening();
      startedRef.current = false;
    }
    onClose();
  };

  if (!isOpen) return null;

  const amountNum = parseFloat(amount);
  const isAmountValid = !isNaN(amountNum) && amountNum > 0;

  const handleQuadrantClick = (qKey: QuadrantType) => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }

    triggerHapticFeedback('success');
    playClickSound(1200);

    if (isClassifyMode && pendingClassifyTx && onClassifyExisting) {
      onClassifyExisting(pendingClassifyTx.id, qKey);
    } else {
      onSaveNew({
        amount: amountNum,
        quadrant: qKey,
        note: note.trim(),
        is_lump_sum: false,
        is_zero_spend: false,
        entry_method: 'voice',
        entry_date: new Date().toISOString().split('T')[0],
        voice_raw_text: liveText || undefined,
      });
    }
    onClose();
  };

  const handleLumpSum = () => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    triggerHapticFeedback('success');
    onSaveNew({
      amount: amountNum,
      quadrant: null,
      note: note.trim() || '模糊概算記帳',
      is_lump_sum: true,
      is_zero_spend: false,
      entry_method: 'voice',
      entry_date: new Date().toISOString().split('T')[0],
      voice_raw_text: liveText || undefined,
    });
    onClose();
  };

  const handleClassifyLater = () => {
    if (!isAmountValid) {
      triggerHapticFeedback('medium');
      playClickSound(500);
      return;
    }
    triggerHapticFeedback('light');
    onSaveNew({
      amount: amountNum,
      quadrant: null,
      note: note.trim(),
      is_lump_sum: false,
      is_zero_spend: false,
      needs_classification: true,
      entry_method: 'voice',
      entry_date: new Date().toISOString().split('T')[0],
      voice_raw_text: liveText || undefined,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm nb-ruled rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          style={{
            maxHeight: 'calc(100dvh - max(24px, env(safe-area-inset-top)) - 24px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          id="voice-entry-modal"
        >
          <div className="nb-binder" />
          <div className="nb-holes">
            <div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" /><div className="nb-hole" />
          </div>

          <div className="p-3 pl-6 space-y-2 ml-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mic className="w-4 h-4 text-orange-700 dark:text-orange-300 shrink-0" />
                <h3 className="font-hand text-base font-bold text-[#3a2e18] dark:text-white truncate">
                  {isClassifyMode ? '這筆還沒選分類喔' : '語音記帳'}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-full text-[#8a7a5a] hover:text-[#3a2e18] dark:hover:text-white transition-colors shrink-0"
                id="close-voice-modal-btn"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {stage === 'idle' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="font-hand text-xs text-[#7a6a4a] dark:text-[#b8a878] text-center">
                  按下麥克風開始錄音，說出品項跟金額
                  <br />
                  例如「買牛奶90塊」或「花90塊買牛奶」
                  <br />
                  說完後再按一次麥克風結束
                </p>
                <p className="font-hand text-[10px] text-rose-700 dark:text-rose-300 font-bold text-center">
                  ⚠️ 一次錄音請只說一筆品項，多筆請分開錄
                </p>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={beginListening}
                  className="w-16 h-16 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 border-[2px] border-orange-800 flex items-center justify-center shadow-lg"
                  id="start-voice-listening-btn"
                >
                  <Mic className="w-7 h-7 text-white" />
                </motion.button>
              </div>
            )}

            {stage === 'listening' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleStopListening}
                  className="relative w-16 h-16 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 border-[2px] border-rose-800 flex items-center justify-center shadow-lg"
                  id="stop-voice-listening-btn"
                >
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-rose-400"
                    animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                  />
                  <Mic className="w-7 h-7 text-white" />
                </motion.button>

                {/* Listening indicator (not a literal mic-level meter — just shows "I'm actively listening") */}
                <div className="flex items-end gap-1 h-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 rounded-full bg-rose-500"
                      animate={{ height: ['30%', '100%', '30%'] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12, ease: 'easeInOut' }}
                    />
                  ))}
                </div>

                <p className="font-hand text-sm text-[#3a2e18] dark:text-white text-center min-h-[20px] px-2">
                  {liveText || '聆聽中...請說話'}
                </p>
                <p className="font-hand text-[10px] text-[#8a7a5a] dark:text-[#b8a878]">說完了嗎？點一下麥克風結束錄音</p>
              </div>
            )}

            {stage === 'error' && (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="font-hand text-xs text-rose-700 dark:text-rose-300 text-center">{errorMsg}</p>
                <button
                  onClick={() => {
                    setStage('idle');
                    setErrorMsg('');
                  }}
                  className="font-hand text-xs font-bold text-orange-700 dark:text-orange-300 underline"
                >
                  重新再試一次
                </button>
              </div>
            )}

            {stage === 'review' && (
              <>
                {!isClassifyMode && liveText && (
                  <div className="font-hand text-[10px] text-[#8a7a5a] dark:text-[#b8a878] italic">
                    聽到：「{liveText}」
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 bg-[#fdf8ec] dark:bg-[#221d12] border-2 border-[#3a2e18] dark:border-[#c9b98a] px-3 py-1.5 flex items-center gap-1"
                    style={{ borderRadius: '180px 8px 180px 8px / 8px 180px 8px 180px' }}
                  >
                    <span className="text-[#b08d57] dark:text-[#d4b878] font-bold text-sm font-hand shrink-0">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={isClassifyMode}
                      className="font-hand w-full bg-transparent text-lg font-bold text-[#3a2e18] dark:text-white text-right focus:outline-none disabled:opacity-70"
                      id="voice-modal-amount-input"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isClassifyMode}
                  placeholder="品項備註"
                  className="font-hand w-full px-2 py-0.5 bg-transparent text-[#5a4a2a] dark:text-[#d4c49a] text-xs border-b-[1.5px] border-dashed border-[#a08a5c] dark:border-[#8a7a5a] focus:border-amber-600 focus:outline-none placeholder:text-[#a08a5c]/70 disabled:opacity-70"
                  id="voice-modal-note-input"
                />

                <div className="font-hand text-xs font-bold text-[#7a6a4a] dark:text-[#b8a878] pt-1">請選擇分類：</div>

                {/* 2x2 quadrant sticky notes */}
                <div className="grid grid-cols-2 gap-1.5">
                  {QUADRANT_LIST.map((qKey) => {
                    const q = QUADRANT_CONFIGS[qKey];
                    const s = QUADRANT_STICKY_STYLE[qKey];
                    return (
                      <button
                        key={qKey}
                        onClick={() => handleQuadrantClick(qKey)}
                        className={`font-hand relative h-8 ${s.radius} text-center transition-all flex items-center justify-center`}
                        style={{ backgroundColor: s.bg, border: `1.6px solid ${s.border}`, transform: `rotate(${s.rotate})`, boxShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}
                        id={`voice-modal-quadrant-${qKey}`}
                      >
                        <div className="nb-tape" style={{ transform: `translateX(-50%) rotate(${s.rotate})` }} />
                        <span className="text-[11px] font-bold" style={{ color: s.text }}>
                          {q.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!isClassifyMode && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleLumpSum}
                      className="font-hand flex-1 h-8 flex items-center justify-center gap-1 bg-[#d4c49a] dark:bg-[#4a3f26] border-[1.6px] border-dashed border-[#5a4a2a] dark:border-[#c9b98a] text-[#5a4a2a] dark:text-[#e8dcc0] text-[10px] font-bold"
                      style={{ borderRadius: '180px 20px 180px 20px / 20px 180px 20px 180px' }}
                      id="voice-modal-lump-sum-btn"
                    >
                      <PiggyBank className="w-3 h-3" /> 模糊概算
                    </button>
                    <button
                      onClick={handleClassifyLater}
                      className="font-hand flex-1 h-8 flex items-center justify-center gap-1 bg-[#e8dcc0] dark:bg-[#4a3f26] border-[1.6px] border-dashed border-[#8a6a2a] text-[#5a4014] dark:text-[#f0dca8] text-[10px] font-bold"
                      style={{ borderRadius: '20px 180px 20px 180px / 180px 20px 180px 20px' }}
                      id="voice-modal-classify-later-btn"
                    >
                      <Clock3 className="w-3 h-3" /> 稍後分類
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
