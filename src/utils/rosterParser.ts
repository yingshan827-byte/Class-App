export interface Student {
  id: string;
  name: string;
}

export interface ParseResult {
  names: string[];
  duplicateCount: number;
}

const NAME_HEADER_KEYWORDS = new Set([
  '姓名',
  '學生姓名',
  '學生',
  '名字',
  'name',
  'student',
  'student name',
  'student_name',
  'full name',
  'fullname',
]);

const SKIP_HEADER_KEYWORDS = new Set([
  '姓名',
  '學生姓名',
  '名字',
  '座號',
  '學號',
  '編號',
  '序號',
  '班級',
  '備註',
  'name',
  'student',
  'student name',
  'student_name',
  'id',
  'no',
  'no.',
  'number',
  'seat',
  'class',
]);

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function countDuplicateEntries(names: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) {
      duplicates++;
    } else {
      seen.add(trimmed);
    }
  }
  return duplicates;
}

/**
 * Parses uploaded CSV text intelligently while preserving duplicate entries
 * so the preview list can flag them for review.
 */
export function parseCsvText(rawText: string): ParseResult {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { names: [], duplicateCount: 0 };
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { names: [], duplicateCount: 0 };
  }

  const rows = lines.map(splitCsvRow);
  const firstRow = rows[0];
  const isMultiColumn = rows.some((r) => r.length > 1);

  let extracted: string[] = [];

  if (isMultiColumn) {
    let targetCol = firstRow.findIndex((cell) =>
      NAME_HEADER_KEYWORDS.has(cell.toLowerCase())
    );
    const hasHeader =
      targetCol !== -1 ||
      firstRow.some((cell) => SKIP_HEADER_KEYWORDS.has(cell.toLowerCase()));

    if (targetCol === -1) {
      const sampleRow = hasHeader && rows.length > 1 ? rows[1] : rows[0];
      targetCol = sampleRow.findIndex(
        (cell) => cell.length > 0 && !/^\d+$/.test(cell)
      );
      if (targetCol === -1) targetCol = 0;
    }

    const startRow = hasHeader ? 1 : 0;
    for (let i = startRow; i < rows.length; i++) {
      const val = (rows[i][targetCol] ?? '').trim();
      if (val && !SKIP_HEADER_KEYWORDS.has(val.toLowerCase())) {
        extracted.push(val);
      }
    }
  } else {
    extracted = rows
      .flat()
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0 && !SKIP_HEADER_KEYWORDS.has(cell.toLowerCase()));
  }

  return {
    names: extracted,
    duplicateCount: countDuplicateEntries(extracted),
  };
}

/**
 * Parses pasted text separated by newlines, commas, Chinese commas, semicolons, or tabs
 * while preserving duplicate entries for preview flagging.
 */
export function parsePastedNames(rawText: string): ParseResult {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { names: [], duplicateCount: 0 };
  }

  const tokens = cleaned
    .split(/[\r\n,，、;\t]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !SKIP_HEADER_KEYWORDS.has(t.toLowerCase()));

  return {
    names: tokens,
    duplicateCount: countDuplicateEntries(tokens),
  };
}

export function deduplicateNames(rawNames: string[]): { names: string[]; removedCount: number } {
  const seen = new Set<string>();
  const names: string[] = [];
  let removedCount = 0;

  for (const name of rawNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) {
      removedCount++;
    } else {
      seen.add(trimmed);
      names.push(trimmed);
    }
  }

  return { names, removedCount };
}

export function createStudentsFromNames(names: string[]): Student[] {
  return names.map((name, idx) => ({
    id: `stu_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    name,
  }));
}

export const SAMPLE_STUDENT_NAMES: string[] = [
  '陳柏翰',
  '林佳穎',
  '黃冠宇',
  '張語彤',
  '李承恩',
  '王思涵',
  '吳子軒',
  '劉欣怡',
  '蔡宗翰',
  '楊詠晴',
  '許家豪',
  '鄭雅筑',
  '謝宇翔',
  '郭沛芸',
  '洪廷威',
  '曾品妍',
  '邱柏諺',
  '周宥辰',
  '葉芷妤',
  '徐楷翔',
  '莊心瑜',
  '賴建霖',
  '潘品希',
  '羅子晴',
];

export function downloadSampleCsv(): void {
  const csvRows = [
    '座號,姓名',
    ...SAMPLE_STUDENT_NAMES.map((name, index) => `${index + 1},${name}`),
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '班級學生名單範例.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
