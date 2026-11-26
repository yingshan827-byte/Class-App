import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Minus,
  Plus,
  Copy,
  Check,
  Download,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import type { Student } from '../utils/rosterParser';
import { soundEngine } from '../utils/sound';

interface GroupItem {
  groupIndex: number;
  members: Student[];
}

type RemainderMode = 'distribute' | 'strict';

interface GroupGeneratorStageProps {
  students: Student[];
  soundEnabled: boolean;
  onLoadSampleRoster: () => void;
}

const GROUP_ACCENT_STYLES = [
  { topBar: 'bg-sky-600', indexText: 'text-sky-700', indexBg: 'bg-sky-50 border-sky-200' },
  { topBar: 'bg-emerald-600', indexText: 'text-emerald-700', indexBg: 'bg-emerald-50 border-emerald-200' },
  { topBar: 'bg-amber-500', indexText: 'text-amber-700', indexBg: 'bg-amber-50 border-amber-200' },
  { topBar: 'bg-indigo-600', indexText: 'text-indigo-700', indexBg: 'bg-indigo-50 border-indigo-200' },
  { topBar: 'bg-rose-600', indexText: 'text-rose-700', indexBg: 'bg-rose-50 border-rose-200' },
  { topBar: 'bg-teal-600', indexText: 'text-teal-700', indexBg: 'bg-teal-50 border-teal-200' },
  { topBar: 'bg-violet-600', indexText: 'text-violet-700', indexBg: 'bg-violet-50 border-violet-200' },
  { topBar: 'bg-orange-600', indexText: 'text-orange-700', indexBg: 'bg-orange-50 border-orange-200' },
];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGroups(
  students: Student[],
  groupSize: number,
  remainderMode: RemainderMode
): GroupItem[] {
  if (students.length === 0) return [];
  const safeSize = Math.max(1, Math.min(groupSize, students.length));
  const shuffled = shuffleArray(students);

  if (remainderMode === 'strict') {
    const groups: GroupItem[] = [];
    for (let i = 0; i < shuffled.length; i += safeSize) {
      groups.push({
        groupIndex: groups.length + 1,
        members: shuffled.slice(i, i + safeSize),
      });
    }
    return groups;
  }

  // Distribute remainder evenly across groups (so no group ends up isolated with 1 person if avoidable)
  const groupCount = Math.max(1, Math.floor(shuffled.length / safeSize));
  const buckets: Student[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((student, idx) => {
    buckets[idx % groupCount].push(student);
  });

  return buckets.map((members, idx) => ({
    groupIndex: idx + 1,
    members,
  }));
}

export function GroupGeneratorStage({
  students,
  soundEnabled,
  onLoadSampleRoster,
}: GroupGeneratorStageProps) {
  const [groupSize, setGroupSize] = useState<number>(4);
  const [remainderMode, setRemainderMode] = useState<RemainderMode>('distribute');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [generationKey, setGenerationKey] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [swapSelection, setSwapSelection] = useState<{
    groupIndex: number;
    studentId: string;
    studentName: string;
  } | null>(null);

  // Synchronize groups if roster changes significantly or clears
  useEffect(() => {
    if (students.length === 0) {
      setGroups([]);
      setSwapSelection(null);
      return;
    }
    // Remove students that are no longer in the roster from existing groups
    const studentMap = new Map(students.map((s) => [s.id, s]));
    setGroups((prev) => {
      if (prev.length === 0) return prev;
      const cleaned = prev
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => studentMap.has(m.id)),
        }))
        .filter((g) => g.members.length > 0)
        .map((g, idx) => ({ ...g, groupIndex: idx + 1 }));
      return cleaned;
    });
    setSwapSelection(null);
  }, [students]);

  const effectiveSize = Math.max(2, Math.min(groupSize, Math.max(2, students.length)));
  const estimatedGroupCount =
    students.length === 0
      ? 0
      : remainderMode === 'distribute'
        ? Math.max(1, Math.floor(students.length / Math.min(groupSize, students.length)))
        : Math.ceil(students.length / groupSize);

  const handleGenerateGroups = () => {
    if (students.length === 0) return;
    if (soundEnabled) {
      soundEngine.unlock();
      soundEngine.playShuffleChime();
    }
    const result = buildGroups(students, groupSize, remainderMode);
    setGroups(result);
    setGenerationKey((k) => k + 1);
    setSwapSelection(null);
    setCopied(false);
  };

  const handleStepSize = (delta: number) => {
    setGroupSize((prev) => {
      const maxLimit = Math.max(20, students.length);
      return Math.max(2, Math.min(maxLimit, prev + delta));
    });
    if (soundEnabled) soundEngine.playClick();
  };

  const handleSelectForSwap = (groupIndex: number, student: Student) => {
    if (!swapSelection) {
      if (soundEnabled) soundEngine.playClick();
      setSwapSelection({
        groupIndex,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (swapSelection.studentId === student.id) {
      setSwapSelection(null);
      return;
    }

    // Perform swap across groups
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, members: [...g.members] }));
      const groupA = next.find((g) => g.groupIndex === swapSelection.groupIndex);
      const groupB = next.find((g) => g.groupIndex === groupIndex);
      if (!groupA || !groupB) return prev;

      const idxA = groupA.members.findIndex((m) => m.id === swapSelection.studentId);
      const idxB = groupB.members.findIndex((m) => m.id === student.id);
      if (idxA === -1 || idxB === -1) return prev;

      const temp = groupA.members[idxA];
      groupA.members[idxA] = groupB.members[idxB];
      groupB.members[idxB] = temp;
      return next;
    });

    if (soundEnabled) soundEngine.playClick();
    setSwapSelection(null);
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map(
        (g) =>
          `第 ${g.groupIndex} 組（${g.members.length} 人）：${g.members
            .map((m) => m.name)
            .join('、')}`
      )
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const rows = ['組別,組內序號,學生姓名'];
    groups.forEach((g) => {
      g.members.forEach((member, idx) => {
        rows.push(`第 ${g.groupIndex} 組,${idx + 1},"${member.name.replace(/"/g, '""')}"`);
      });
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `班級分組結果_${groups.length}組.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Group Size Stepper & Quick Presets */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
              設定每組人數
            </span>

            <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
              <button
                type="button"
                onClick={() => handleStepSize(-1)}
                disabled={groupSize <= 2}
                aria-label="減少每組人數"
                className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono text-sm font-semibold text-slate-900 tabular-nums min-w-[3.75rem] text-center bg-white border-x border-slate-200">
                {groupSize} 人
              </span>
              <button
                type="button"
                onClick={() => handleStepSize(1)}
                disabled={students.length > 0 && groupSize >= students.length}
                aria-label="增加每組人數"
                className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick size buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {[2, 3, 4, 5, 6].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setGroupSize(preset);
                    if (soundEnabled) soundEngine.playClick();
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    groupSize === preset
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {preset} 人
                </button>
              ))}
            </div>
          </div>

          {/* Primary Shuffle Action */}
          <button
            type="button"
            disabled={students.length === 0}
            onClick={handleGenerateGroups}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
            <span>{groups.length > 0 ? '重新隨機分組' : '開始自動分組'}</span>
          </button>
        </div>

        {/* Second Row: Remainder Rule + Live Summary + Export Actions */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="餘數處理方式"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => {
                  setRemainderMode('distribute');
                  if (soundEnabled) soundEngine.playClick();
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  remainderMode === 'distribute'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                平均分配餘數
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemainderMode('strict');
                  if (soundEnabled) soundEngine.playClick();
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  remainderMode === 'strict'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                固定每組上限
              </button>
            </div>

            <p className="text-xs text-slate-500 tabular-nums">
              {students.length > 0 ? (
                <>
                  共 {students.length} 位學生
                  <span aria-hidden="true"> · </span>
                  目標每組 {effectiveSize} 人
                  <span aria-hidden="true"> · </span>
                  預計分為 <strong className="font-semibold text-slate-800">{estimatedGroupCount}</strong> 組
                </>
              ) : (
                '請先匯入名單後即可進行分組'
              )}
            </p>
          </div>

          {groups.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700">已複製名單</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>複製文字</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>下載分組 CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Swap Hint Banner */}
      {groups.length > 0 && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs transition-colors ${
            swapSelection
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-slate-100/80 border-slate-200/80 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {swapSelection ? (
              <span>
                已選取第 {swapSelection.groupIndex} 組的{' '}
                <strong className="font-semibold">{swapSelection.studentName}</strong>
                ，請點選另一位學生即可互換組別
              </span>
            ) : (
              <span>小提示：直接點選任意兩位學生，即可手動微調互換組別</span>
            )}
          </div>
          {swapSelection && (
            <button
              type="button"
              onClick={() => setSwapSelection(null)}
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              取消選取
            </button>
          )}
        </div>
      )}

      {/* Visualized Groups Grid */}
      {students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-16 text-center space-y-4">
          <Users className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">尚無學生名單可供分組</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            請在左側上傳 CSV 或貼上學生名單，設定每組人數後一鍵產生視覺化分組卡片。
          </p>
          <button
            type="button"
            onClick={onLoadSampleRoster}
            className="px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            載入模擬名單（24 人）
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-16 text-center space-y-4">
          <Shuffle className="w-8 h-8 text-sky-600 mx-auto" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">
            準備為 {students.length} 位學生自動分組
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            目前設定每組 {groupSize} 人（預計分為 {estimatedGroupCount} 組），點擊上方「開始自動分組」立即產生視覺化組別圖卡。
          </p>
          <button
            type="button"
            onClick={handleGenerateGroups}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
            <span>立即自動分組</span>
          </button>
        </div>
      ) : (
        <div
          key={generationKey}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {groups.map((group, idx) => {
            const palette = GROUP_ACCENT_STYLES[idx % GROUP_ACCENT_STYLES.length];
            return (
              <motion.article
                key={`group-${group.groupIndex}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(idx * 0.045, 0.4),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                {/* Clean Top Color Bar */}
                <div className={`h-1.5 w-full ${palette.topBar}`} aria-hidden="true" />

                <div className="p-4 flex-1 flex flex-col">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border font-mono text-xs font-bold tabular-nums ${palette.indexBg} ${palette.indexText}`}
                      >
                        {String(group.groupIndex).padStart(2, '0')}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        第 {group.groupIndex} 組
                      </h3>
                    </div>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">
                      {group.members.length} 人
                    </span>
                  </div>

                  {/* Group Member Visual Cards */}
                  <ul className="mt-3 space-y-1.5">
                    {group.members.map((member, mIdx) => {
                      const isSelected = swapSelection?.studentId === member.id;
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectForSwap(group.groupIndex, member)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-sky-50 border border-sky-500 ring-2 ring-sky-500/20 text-sky-950'
                                : 'bg-slate-50/80 border border-slate-200/70 hover:bg-slate-100/80 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs text-slate-400 tabular-nums w-4 shrink-0">
                                {mIdx + 1}
                              </span>
                              <span className="text-sm font-medium truncate">
                                {member.name}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-medium text-sky-700 whitespace-nowrap shrink-0">
                                待機交換
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
