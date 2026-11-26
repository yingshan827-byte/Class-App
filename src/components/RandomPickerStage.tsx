import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Volume2, VolumeX, Repeat, Ban, Trash2 } from 'lucide-react';
import type { Student } from '../utils/rosterParser';
import { soundEngine } from '../utils/sound';
import { ConfettiBurst } from './ConfettiBurst';

export interface DrawRecord {
  recordId: string;
  student: Student;
  order: number;
  timestamp: string;
}

interface RandomPickerStageProps {
  students: Student[];
  allowRepeats: boolean;
  onChangeAllowRepeats: (allow: boolean) => void;
  drawnIds: Set<string>;
  history: DrawRecord[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStudentPicked: (student: Student) => void;
  onResetPool: () => void;
  onClearHistory: () => void;
  onLoadSampleRoster: () => void;
}

export function RandomPickerStage({
  students,
  allowRepeats,
  onChangeAllowRepeats,
  drawnIds,
  history,
  soundEnabled,
  onToggleSound,
  onStudentPicked,
  onResetPool,
  onClearHistory,
  onLoadSampleRoster,
}: RandomPickerStageProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingName, setRollingName] = useState<string | null>(null);
  const [winner, setWinner] = useState<Student | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Clear winner banner if roster becomes empty
  useEffect(() => {
    if (students.length === 0) {
      setWinner(null);
      setRollingName(null);
    }
  }, [students.length]);

  const availablePool = allowRepeats
    ? students
    : students.filter((s) => !drawnIds.has(s.id));

  const isPoolExhausted = students.length > 0 && !allowRepeats && availablePool.length === 0;

  const startPick = () => {
    if (isSpinning || students.length === 0 || isPoolExhausted) return;

    if (soundEnabled) {
      soundEngine.unlock();
    }

    // Pick actual winner immediately using uniform random selection from availablePool
    const chosenIndex = Math.floor(Math.random() * availablePool.length);
    const chosenStudent = availablePool[chosenIndex];

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setWinner(chosenStudent);
      setRollingName(chosenStudent.name);
      onStudentPicked(chosenStudent);
      if (soundEnabled) {
        soundEngine.playWinnerFanfare();
      }
      return;
    }

    setIsSpinning(true);
    setWinner(null);

    // Build visual rolling pool (use entire roster for visual suspense even if 1 student left)
    const visualPool = availablePool.length >= 3 ? availablePool : students;
    const totalSteps = 22;
    let currentStep = 0;
    let lastShownName = rollingName ?? '';

    const runStep = () => {
      if (!isMountedRef.current) return;

      currentStep++;
      const progress = currentStep / totalSteps;

      if (currentStep < totalSteps) {
        // Pick a random name different from the immediately preceding frame when possible
        let candidate = visualPool[Math.floor(Math.random() * visualPool.length)];
        if (visualPool.length > 1 && candidate.name === lastShownName) {
          candidate =
            visualPool[(visualPool.indexOf(candidate) + 1) % visualPool.length];
        }
        lastShownName = candidate.name;
        setRollingName(candidate.name);

        if (soundEnabled) {
          soundEngine.playTick(progress);
        }

        // Cubic ease-out deceleration: starts at ~45ms, slows down to ~290ms
        const delay = Math.round(45 + Math.pow(progress, 2.4) * 260);
        timerRef.current = window.setTimeout(runStep, delay);
      } else {
        // Final reveal
        setRollingName(chosenStudent.name);
        setWinner(chosenStudent);
        setIsSpinning(false);
        setConfettiKey((k) => k + 1);
        onStudentPicked(chosenStudent);

        if (soundEnabled) {
          soundEngine.playWinnerFanfare();
        }
      }
    };

    runStep();
  };

  const displayName = rollingName ?? winner?.name ?? null;

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Repeat vs Non-repeat Segmented Control */}
          <div
            role="group"
            aria-label="抽取重複設定"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => {
                if (soundEnabled) soundEngine.playClick();
                onChangeAllowRepeats(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                !allowRepeats
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
              <span>不重複抽取</span>
            </button>
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => {
                if (soundEnabled) soundEngine.playClick();
                onChangeAllowRepeats(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                allowRepeats
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>可重複抽取</span>
            </button>
          </div>

          {/* Unboxed Metadata Summary */}
          <div className="text-xs text-slate-500 tabular-nums px-1">
            {allowRepeats ? (
              <span>可抽名單共 {students.length} 人</span>
            ) : (
              <span>
                剩餘未抽 <strong className="font-semibold text-slate-800">{availablePool.length}</strong> /{' '}
                {students.length} 人
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!allowRepeats && drawnIds.size > 0 && (
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => {
                if (soundEnabled) soundEngine.playClick();
                onResetPool();
                setWinner(null);
                setRollingName(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>重置抽籤池</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              soundEnabled
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                <span>音效開啟</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                <span>已靜音</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Focal Picker Stage */}
      <section
        aria-label="隨機抽籤舞台"
        className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:py-16 flex flex-col items-center justify-center text-center min-h-[380px]"
      >
        <ConfettiBurst triggerKey={confettiKey} />

        {/* Subtle geometric stage grid lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-20 w-full max-w-xl mx-auto flex flex-col items-center">
          {students.length === 0 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-900">請先匯入班級學生名單</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                在左側上傳 CSV 檔案或貼上學生姓名，即可立刻開始隨機點名抽籤。
              </p>
              <button
                type="button"
                onClick={onLoadSampleRoster}
                className="px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                載入模擬名單（24 人）
              </button>
            </div>
          ) : isPoolExhausted ? (
            <div className="space-y-4">
              <p className="text-xs font-medium text-emerald-700 tracking-wide">
                本輪抽籤完成
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
                全班 {students.length} 位同學皆已抽中
              </h3>
              <p className="text-sm text-slate-500">
                目前已設定為「不重複抽取」，您可以重置抽籤池進行下一輪，或切換為「可重複抽取」。
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) soundEngine.playClick();
                    onResetPool();
                    setWinner(null);
                    setRollingName(null);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>重置抽籤池，開始新一輪</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Stage Kicker Text */}
              <p className="text-xs font-medium text-slate-500 mb-4 h-4">
                {isSpinning
                  ? '正在隨機抽取中...'
                  : winner
                    ? `第 ${history[0]?.order ?? history.length} 位抽中學生`
                    : '準備就緒 · 點擊下方按鈕抽出一位學生'}
              </p>

              {/* Big Name Display Box */}
              <div
                className={`w-full rounded-2xl border px-6 py-10 sm:py-12 transition-colors duration-200 ${
                  isSpinning
                    ? 'bg-sky-50/70 border-sky-200'
                    : winner
                      ? 'bg-slate-50 border-sky-300 shadow-sm'
                      : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <AnimatePresence mode="wait">
                  {displayName ? (
                    <motion.div
                      key={isSpinning ? `roll-${displayName}` : `win-${winner?.id}-${history.length}`}
                      initial={isSpinning ? { opacity: 0.7, y: 8 } : { opacity: 0, scale: 0.88 }}
                      animate={isSpinning ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
                      transition={
                        isSpinning
                          ? { duration: 0.06 }
                          : { type: 'spring', stiffness: 360, damping: 22 }
                      }
                      className="select-none"
                    >
                      <span
                        className={`block font-bold tracking-tight text-slate-900 leading-tight break-words ${
                          isSpinning ? 'text-slate-700' : 'text-slate-950'
                        }`}
                        style={{ fontSize: 'clamp(2.5rem, 5vw, 4.25rem)' }}
                      >
                        {displayName}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="py-2">
                      <span
                        className="block font-semibold text-slate-300 select-none"
                        style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
                      >
                        等待抽籤
                      </span>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary Draw CTA */}
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={startPick}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.99] disabled:bg-sky-400 disabled:cursor-wait rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>{isSpinning ? '抽取中...' : winner ? '再抽一位學生' : '開始隨機抽籤'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Drawn History Section */}
      <section className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">抽籤紀錄</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              共 {history.length} 次
            </span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => {
                onClearHistory();
                setWinner(null);
                setRollingName(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>清除紀錄</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            尚無抽籤紀錄，抽出的學生名單將依順序顯示於此處
          </p>
        ) : (
          <ol className="pt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {history.map((item) => (
              <li
                key={item.recordId}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                    #{String(item.order).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {item.student.name}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {item.timestamp}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
