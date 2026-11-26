import { useState, useEffect } from 'react';
import { Dices, Users, Maximize2, Minimize2, List } from 'lucide-react';
import {
  type Student,
  SAMPLE_STUDENT_NAMES,
  createStudentsFromNames,
} from './utils/rosterParser';
import { RosterSidebar } from './components/RosterSidebar';
import { RandomPickerStage, type DrawRecord } from './components/RandomPickerStage';
import { GroupGeneratorStage } from './components/GroupGeneratorStage';
import { soundEngine } from './utils/sound';

type ActiveFeature = 'picker' | 'groups' | 'roster';

const STORAGE_KEYS = {
  STUDENTS: 'classroom_helper_students_v1',
  DRAWN_IDS: 'classroom_helper_drawn_ids_v1',
  HISTORY: 'classroom_helper_history_v1',
  ALLOW_REPEATS: 'classroom_helper_allow_repeats_v1',
  SOUND_ENABLED: 'classroom_helper_sound_v1',
  INITIALIZED: 'classroom_helper_initialized_v1',
};

function loadInitialStudents(): Student[] {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
    if (!initialized) {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, '1');
      return createStudentsFromNames(SAMPLE_STUDENT_NAMES);
    }
  } catch {
    // Fallback if storage is unavailable
  }
  return createStudentsFromNames(SAMPLE_STUDENT_NAMES);
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(loadInitialStudents);
  const [activeTab, setActiveTab] = useState<ActiveFeature>('picker');
  const [projectorMode, setProjectorMode] = useState<boolean>(false);

  const [allowRepeats, setAllowRepeats] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ALLOW_REPEATS) === 'true';
    } catch {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [drawnIds, setDrawnIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DRAWN_IDS);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // Ignore parse error
    }
    return new Set();
  });

  const [history, setHistory] = useState<DrawRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch {
      // Ignore parse error
    }
    return [];
  });

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch {
      // Ignore quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DRAWN_IDS, JSON.stringify(Array.from(drawnIds)));
    } catch {
      // Ignore
    }
  }, [drawnIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALLOW_REPEATS, String(allowRepeats));
    } catch {
      // Ignore
    }
  }, [allowRepeats]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(soundEnabled));
    } catch {
      // Ignore
    }
  }, [soundEnabled]);

  const handleReplaceStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    setDrawnIds(new Set());
    setHistory([]);
  };

  const handleAppendStudents = (addedStudents: Student[]) => {
    setStudents((prev) => [...prev, ...addedStudents]);
  };

  const handleRemoveStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setDrawnIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeduplicateStudents = (): number => {
    const seen = new Set<string>();
    const kept: Student[] = [];
    const removedIds = new Set<string>();

    for (const student of students) {
      const key = student.name.trim();
      if (seen.has(key)) {
        removedIds.add(student.id);
      } else {
        seen.add(key);
        kept.push(student);
      }
    }

    if (removedIds.size > 0) {
      setStudents(kept);
      setDrawnIds((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) {
          next.delete(id);
        }
        return next;
      });
    }

    return removedIds.size;
  };

  const handleClearAll = () => {
    setStudents([]);
    setDrawnIds(new Set());
    setHistory([]);
  };

  const handleLoadSampleRoster = () => {
    handleReplaceStudents(createStudentsFromNames(SAMPLE_STUDENT_NAMES));
  };

  const handleStudentPicked = (student: Student) => {
    if (!allowRepeats) {
      setDrawnIds((prev) => {
        const next = new Set(prev);
        next.add(student.id);
        return next;
      });
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    setHistory((prev) => [
      {
        recordId: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        student,
        order: prev.length + 1,
        timestamp: timeStr,
      },
      ...prev,
    ]);
  };

  const handleResetPool = () => {
    setDrawnIds(new Set());
  };

  const handleClearHistory = () => {
    setHistory([]);
    setDrawnIds(new Set());
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        soundEngine.unlock();
        soundEngine.playClick();
      }
      return next;
    });
  };

  const handleNavSwitch = (target: ActiveFeature) => {
    if (target === 'roster') {
      if (projectorMode) {
        setProjectorMode(false);
      }
      setActiveTab('roster');
      return;
    }
    setActiveTab(target);
  };

  const stageTab: 'picker' | 'groups' = activeTab === 'groups' ? 'groups' : 'picker';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('picker');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            課堂點名與分組助手
          </a>

          {/* Zone 2: Clean Single-line Navigation Links */}
          <nav aria-label="主要功能" className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleNavSwitch('picker')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stageTab === 'picker' && activeTab !== 'roster'
                  ? 'border-sky-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              隨機抽籤
            </button>
            <button
              type="button"
              onClick={() => handleNavSwitch('groups')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stageTab === 'groups' && activeTab !== 'roster'
                  ? 'border-sky-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              自動分組
            </button>
            <button
              type="button"
              onClick={() => handleNavSwitch('roster')}
              className={`lg:hidden py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'roster'
                  ? 'border-sky-600 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              名單管理 ({students.length})
            </button>
          </nav>

          {/* Zone 3: Single Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setProjectorMode((p) => !p);
                if (activeTab === 'roster') setActiveTab('picker');
              }}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {projectorMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>顯示側邊名單</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>投影專注模式</span>
                </>
              )}
            </button>

            {/* Mobile single primary action: quick toggle roster */}
            <button
              type="button"
              onClick={() =>
                setActiveTab((prev) => (prev === 'roster' ? 'picker' : 'roster'))
              }
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <List className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{activeTab === 'roster' ? '返回互動舞台' : `名單 (${students.length})`}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {/* Mobile Feature Switcher (visible below md) */}
        <div className="md:hidden mb-4 grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('picker')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'picker'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Dices className="w-3.5 h-3.5" aria-hidden="true" />
            <span>隨機抽籤</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>自動分組</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <List className="w-3.5 h-3.5" aria-hidden="true" />
            <span>名單 ({students.length})</span>
          </button>
        </div>

        {/* Two-Zone Split Workspace */}
        <div
          className={`grid gap-6 items-start ${
            projectorMode ? 'grid-cols-1 max-w-5xl mx-auto' : 'grid-cols-1 lg:grid-cols-[360px_1fr]'
          }`}
        >
          {/* Left Zone: Roster Management Sidebar */}
          {!projectorMode && (
            <div className={activeTab === 'roster' ? 'block' : 'hidden lg:block'}>
              <RosterSidebar
                students={students}
                drawnIds={drawnIds}
                onReplaceStudents={handleReplaceStudents}
                onAppendStudents={handleAppendStudents}
                onRemoveStudent={handleRemoveStudent}
                onDeduplicateStudents={handleDeduplicateStudents}
                onClearAll={handleClearAll}
              />
            </div>
          )}

          {/* Right Zone: Interactive Stage */}
          <div className={activeTab === 'roster' ? 'hidden lg:block space-y-5' : 'space-y-5'}>
            {/* Workspace Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                role="tablist"
                aria-label="課堂互動模式切換"
                className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={stageTab === 'picker'}
                  onClick={() => setActiveTab('picker')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    stageTab === 'picker'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Dices className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  <span>隨機抽籤點名</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={stageTab === 'groups'}
                  onClick={() => setActiveTab('groups')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    stageTab === 'groups'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  <span>自動視覺分組</span>
                </button>
              </div>

              {projectorMode && (
                <p className="text-xs text-slate-500 tabular-nums">
                  班級名單共 {students.length} 人
                </p>
              )}
            </div>

            {/* Active Feature Stage */}
            {stageTab === 'picker' ? (
              <RandomPickerStage
                students={students}
                allowRepeats={allowRepeats}
                onChangeAllowRepeats={setAllowRepeats}
                drawnIds={drawnIds}
                history={history}
                soundEnabled={soundEnabled}
                onToggleSound={handleToggleSound}
                onStudentPicked={handleStudentPicked}
                onResetPool={handleResetPool}
                onClearHistory={handleClearHistory}
                onLoadSampleRoster={handleLoadSampleRoster}
              />
            ) : (
              <GroupGeneratorStage
                students={students}
                soundEnabled={soundEnabled}
                onLoadSampleRoster={handleLoadSampleRoster}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
