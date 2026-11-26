import { useState, useRef, useMemo, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  Upload,
  ClipboardPaste,
  UserPlus,
  Trash2,
  Download,
  Search,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  type Student,
  parseCsvText,
  parsePastedNames,
  deduplicateNames,
  createStudentsFromNames,
  SAMPLE_STUDENT_NAMES,
  downloadSampleCsv,
} from '../utils/rosterParser';

interface RosterSidebarProps {
  students: Student[];
  drawnIds: Set<string>;
  onReplaceStudents: (newStudents: Student[]) => void;
  onAppendStudents: (addedStudents: Student[]) => void;
  onRemoveStudent: (id: string) => void;
  onDeduplicateStudents: () => number;
  onClearAll: () => void;
}

type InputTab = 'csv' | 'paste';

export function RosterSidebar({
  students,
  drawnIds,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onDeduplicateStudents,
  onClearAll,
}: RosterSidebarProps) {
  const [inputTab, setInputTab] = useState<InputTab>('csv');
  const [pasteValue, setPasteValue] = useState('');
  const [singleName, setSingleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const duplicateAnalysis = useMemo(() => {
    const nameCounts = new Map<string, number>();
    for (const s of students) {
      const key = s.name.trim();
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    const seen = new Set<string>();
    const extraDuplicateIds = new Set<string>();
    const collidingIds = new Set<string>();

    for (const s of students) {
      const key = s.name.trim();
      if ((nameCounts.get(key) ?? 0) > 1) {
        collidingIds.add(s.id);
        if (seen.has(key)) {
          extraDuplicateIds.add(s.id);
        } else {
          seen.add(key);
        }
      }
    }

    return {
      collidingIds,
      extraDuplicateIds,
      duplicateEntryCount: extraDuplicateIds.size,
      nameCounts,
    };
  }, [students]);

  const showFeedback = (type: 'success' | 'warning' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const decodeCsvBuffer = (buffer: ArrayBuffer): string => {
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      return utf8Decoder.decode(buffer);
    } catch {
      try {
        const big5Decoder = new TextDecoder('big5');
        return big5Decoder.decode(buffer);
      } catch {
        return new TextDecoder('utf-8').decode(buffer);
      }
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    const isValidExt =
      file.name.toLowerCase().endsWith('.csv') ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.type === 'text/csv' ||
      file.type === 'text/plain';

    if (!isValidExt) {
      showFeedback('error', '請上傳 .csv 或 .txt 純文字名單檔案。');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeCsvBuffer(buffer);
      const { names, duplicateCount } = parseCsvText(text);

      if (names.length === 0) {
        showFeedback('error', '檔案中找不到有效的學生姓名，請確認內容格式。');
        return;
      }

      onReplaceStudents(createStudentsFromNames(names));
      setConfirmClear(false);

      if (duplicateCount > 0) {
        showFeedback(
          'warning',
          `已匯入 ${names.length} 筆資料（偵測到 ${duplicateCount} 筆重複姓名，已於預覽名單標記）`
        );
      } else {
        showFeedback('success', `已從「${file.name}」匯入 ${names.length} 位學生`);
      }
    } catch {
      showFeedback('error', '讀取檔案失敗，請確認檔案未損壞或改用複製貼上。');
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handlePasteImport = (mode: 'replace' | 'append') => {
    const { names, duplicateCount } = parsePastedNames(pasteValue);
    if (names.length === 0) {
      showFeedback('error', '請先在輸入框貼上至少一位學生姓名。');
      return;
    }

    if (mode === 'replace') {
      onReplaceStudents(createStudentsFromNames(names));
      setPasteValue('');
      setConfirmClear(false);
      if (duplicateCount > 0) {
        showFeedback(
          'warning',
          `已匯入 ${names.length} 筆資料（偵測到 ${duplicateCount} 筆重複姓名，已於預覽名單標記）`
        );
      } else {
        showFeedback('success', `已更新名單，共 ${names.length} 位學生`);
      }
    } else {
      const existingNames = new Set(students.map((s) => s.name.trim()));
      const seenCombined = new Set(existingNames);
      let newDuplicates = 0;
      for (const n of names) {
        const key = n.trim();
        if (seenCombined.has(key)) {
          newDuplicates++;
        } else {
          seenCombined.add(key);
        }
      }

      onAppendStudents(createStudentsFromNames(names));
      setPasteValue('');
      setConfirmClear(false);

      if (newDuplicates > 0) {
        showFeedback(
          'warning',
          `已加入 ${names.length} 筆資料（含 ${newDuplicates} 筆重複姓名，已於預覽名單標記）`
        );
      } else {
        showFeedback('success', `已追加 ${names.length} 位學生`);
      }
    }
  };

  const handleAddSingle = (e: FormEvent) => {
    e.preventDefault();
    const { names } = deduplicateNames([singleName]);
    if (names.length === 0) return;

    const target = names[0];
    onAppendStudents(createStudentsFromNames([target]));
    setSingleName('');
    setConfirmClear(false);
  };

  const handleLoadSample = () => {
    onReplaceStudents(createStudentsFromNames(SAMPLE_STUDENT_NAMES));
    setConfirmClear(false);
    showFeedback('success', `已載入 ${SAMPLE_STUDENT_NAMES.length} 位模擬班級名單`);
  };

  const handleRemoveAllDuplicates = () => {
    const removed = onDeduplicateStudents();
    if (removed > 0) {
      showFeedback('success', `已一次性移除 ${removed} 筆重複學生姓名`);
    }
  };

  const filteredStudents = searchQuery.trim()
    ? students.filter((s) => s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : students;

  return (
    <aside className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden lg:h-[calc(100vh-7.5rem)] lg:sticky lg:top-20">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">班級名單管理</h2>
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>載入模擬名單</span>
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 tabular-nums">
          名單預覽 {students.length} 人
          {duplicateAnalysis.duplicateEntryCount > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="text-amber-700 font-medium">
                {duplicateAnalysis.duplicateEntryCount} 筆重複
              </span>
            </>
          )}
          {drawnIds.size > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              <span>已抽中 {drawnIds.size} 人</span>
            </>
          )}
        </p>

        {/* Segmented Tab for CSV vs Paste */}
        <div
          role="tablist"
          aria-label="名單匯入方式"
          className="mt-3.5 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={inputTab === 'csv'}
            onClick={() => setInputTab('csv')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputTab === 'csv'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>上傳 CSV</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputTab === 'paste'}
            onClick={() => setInputTab('paste')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputTab === 'paste'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
            <span>貼上姓名</span>
          </button>
        </div>

        {/* Tab Panels */}
        {inputTab === 'csv' ? (
          <div className="mt-3 space-y-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="點擊或拖曳 CSV 檔案到此處上傳學生名單"
              className={`flex flex-col items-center justify-center text-center px-4 py-4 rounded-lg border border-dashed transition-colors cursor-pointer ${
                isDragging
                  ? 'border-sky-600 bg-sky-50/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-sky-500 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-slate-500 mb-1.5" aria-hidden="true" />
              <p className="text-xs font-medium text-slate-700">
                點擊選擇或拖曳 CSV 檔案至此
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                支援 UTF-8 / Excel Big5 · 自動辨識「姓名」欄位
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleFileInputChange}
                className="sr-only"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
              <span>支援單欄姓名或「座號,姓名」格式</span>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-sky-700 font-medium cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>下載範例 CSV</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <label htmlFor="paste-roster-input" className="sr-only">
              批次貼上學生姓名
            </label>
            <textarea
              id="paste-roster-input"
              rows={4}
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={'每行一位學生，或以逗號、頓號分隔：\n王小明\n陳美玲\n林志豪'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/15 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePasteImport('replace')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                匯入並覆蓋名單
              </button>
              <button
                type="button"
                onClick={() => handlePasteImport('append')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                加入現有名單
              </button>
            </div>
          </div>
        )}

        {/* Inline Feedback Message */}
        {feedbackMsg && (
          <div
            role="status"
            className={`mt-2.5 px-3 py-2 rounded-lg text-xs border ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedbackMsg.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}
      </div>

      {/* Quick Add + Search */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 space-y-2">
        <form onSubmit={handleAddSingle} className="flex items-center gap-1.5">
          <label htmlFor="single-student-input" className="sr-only">
            新增單一學生姓名
          </label>
          <input
            id="single-student-input"
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="快速新增單一學生姓名..."
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/15"
          />
          <button
            type="submit"
            disabled={!singleName.trim()}
            aria-label="新增學生"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>新增</span>
          </button>
        </form>

        {students.length > 6 && (
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋學生姓名..."
              aria-label="搜尋學生姓名"
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="清除搜尋"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Duplicate Warning Banner + One-Click Removal */}
      {duplicateAnalysis.duplicateEntryCount > 0 && (
        <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-amber-900 truncate tabular-nums">
              發現 {duplicateAnalysis.duplicateEntryCount} 筆重複姓名
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemoveAllDuplicates}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            一鍵移除重複
          </button>
        </div>
      )}

      {/* Student Preview List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[220px]">
        {students.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
            <p className="text-sm font-medium text-slate-700">尚未建立學生名單</p>
            <p className="mt-1 text-xs text-slate-500">
              請上傳 CSV、貼上名單，或點擊上方「載入模擬名單」開始體驗
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            找不到符合「{searchQuery}」的學生
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const originalIndex = students.findIndex((s) => s.id === student.id) + 1;
              const isDrawn = drawnIds.has(student.id);
              const isColliding = duplicateAnalysis.collidingIds.has(student.id);
              const isExtraDuplicate = duplicateAnalysis.extraDuplicateIds.has(student.id);
              const repeatTotal = duplicateAnalysis.nameCounts.get(student.name.trim()) ?? 1;

              return (
                <li
                  key={student.id}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isColliding
                      ? 'bg-amber-50/85 hover:bg-amber-100/75'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs text-slate-400 tabular-nums w-6 shrink-0">
                      {String(originalIndex).padStart(2, '0')}
                    </span>
                    <span
                      className={`text-sm truncate ${
                        isDrawn
                          ? 'text-slate-400 line-through'
                          : isColliding
                            ? 'text-amber-950 font-semibold'
                            : 'text-slate-800 font-medium'
                      }`}
                    >
                      {student.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isColliding && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap ${
                          isExtraDuplicate ? 'text-amber-800' : 'text-amber-700'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        <span>{isExtraDuplicate ? '重複項目' : `重複 ×${repeatTotal}`}</span>
                      </span>
                    )}
                    {isDrawn && (
                      <span className="text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                        已抽中
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveStudent(student.id)}
                      aria-label={`移除 ${student.name}`}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer Clear Action */}
      {students.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2">
          {confirmClear ? (
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-xs text-rose-700 font-medium">確定清空全部名單？</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer whitespace-nowrap"
                >
                  確定清空
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-xs text-slate-500">資料自動儲存於本機</span>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>清空名單</span>
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
