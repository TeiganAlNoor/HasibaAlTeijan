/** Pure, in-memory marking model. It deliberately knows nothing about the Mushaf. */
const field = (id, label, weight) => Object.freeze({ id, label, weight });

export const BASE_FIELDS = Object.freeze([
  field('corrections', 'عدد تصحيح الحركات', 2),
  field('word-openings', 'عدد فتح الكلمات', 1),
  field('verse-openings', 'عدد فتح الآيات', 2),
  field('memorized-with-recitation', 'عدد التأتأة مع تنبيه', 0.5),
  field('memorized-no-recitation', 'عدد التأتأة بدون تنبيه', 0.1),
]);

export const QUIZ_FIELDS = Object.freeze([
  ...BASE_FIELDS,
  field('ahkamMemAndNon', 'أحكام الميم والنون', 0.5),
  field('Meaning', 'المعاني', 1),
]);

const config = (key, group, title, rowCount, fields = BASE_FIELDS, maxRows = rowCount) =>
  Object.freeze({ key, group, title, rowCount, defaultRows: rowCount, maxRows, fields });

export const EXAM_CONFIGS = Object.freeze({
  'review-save': config('review-save', 'review', 'حفظ للمراجعة', 3),
  'review-tathbeet': config('review-tathbeet', 'review', 'التثبيت', 4),
  'testing-monthly': config('testing-monthly', 'testing', 'الاختبار الشهري', 5),
  'testing-cumulative': config('testing-cumulative', 'testing', 'الاختبار التراكمي', 7),
  consolidation: config('consolidation', 'consolidation', 'التثبيت', 7),
  'quiz-positions': config('quiz-positions', 'quiz', 'المسابقات - المواضع', 3, QUIZ_FIELDS, 10),
  'quiz-narration': config('quiz-narration', 'quiz', 'المسابقات - السرد', 1, QUIZ_FIELDS),
});

const INTEGER_ERROR = 'يجب إدخال عدد صحيح غير سالب (0 أو أكبر).';

/** Empty counts mean zero, as in the original calculator; decimals are not truncated. */
export function parseCount(raw) {
  if (raw === null || raw === undefined) raw = '';
  const text = String(raw).trim().replace(/[٠-٩۰-۹]/gu, digit => {
    const code = digit.codePointAt(0);
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
  });
  if (text === '') return { valid: true, value: 0, error: '' };
  if (!/^\d+$/u.test(text)) return { valid: false, value: null, error: INTEGER_ERROR };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { valid: false, value: null, error: INTEGER_ERROR };
  return { valid: true, value, error: '' };
}

/** These grade boundaries and labels are unchanged from the original application. */
export function gradeFor(key, score) {
  const current = EXAM_CONFIGS[key];
  if (!current) throw new RangeError(`Unknown exam type: ${key}`);
  if (!Number.isFinite(score)) throw new RangeError('A finite score is required.');
  if (current.group === 'review') {
    const grade = score >= 99 ? 'امتياز' : score >= 97 ? 'ممتاز' : score >= 95 ? 'جيد جداً' : 'غير مكتمل';
    return { grade, status: grade, passed: score >= 95 };
  }
  if (current.group === 'consolidation') {
    const grade = score >= 99 ? 'ممتاز' : score >= 95 ? 'جيد جداً' : score >= 90 ? 'جيد' : 'يحتاج تحسين';
    return { grade, status: grade, passed: score >= 90 };
  }
  return { grade: '', status: score >= 90 ? 'ناجح' : '', passed: score >= 90 };
}

export class ExamValidationError extends Error {
  constructor(errors) {
    super('راجع خانات الأخطاء: يلزم إدخال أعداد صحيحة صفراً أو أكبر.');
    this.name = 'ExamValidationError';
    this.errors = errors;
  }
}

const emptyRow = current => Object.fromEntries(current.fields.map(item => [item.id, '']));
const cloneResult = result => result ? { ...result, rowDeductions: [...result.rowDeductions] } : null;

/**
 * All seven drafts live independently until this page is closed/reloaded.
 * Shrinking the positions row count hides rows; it never discards their marks.
 */
export function createExamStore() {
  const drafts = new Map(Object.values(EXAM_CONFIGS).map(current => [current.key, {
    key: current.key,
    rowCount: current.rowCount,
    rows: Array.from({ length: current.maxRows }, () => emptyRow(current)),
    bonuses: [false, false],
    result: null,
    revision: 0,
  }]));

  function draftFor(key) {
    const draft = drafts.get(key);
    if (!draft) throw new RangeError(`Unknown exam type: ${key}`);
    return draft;
  }

  function errorsFor(draft) {
    const errors = [];
    const current = EXAM_CONFIGS[draft.key];
    draft.rows.slice(0, draft.rowCount).forEach((row, rowIndex) => {
      current.fields.forEach(item => {
        const parsed = parseCount(row[item.id]);
        if (!parsed.valid) errors.push({ row: rowIndex, field: item.id, value: row[item.id], message: parsed.error });
      });
    });
    return errors;
  }

  function invalidate(draft) {
    draft.result = null;
    draft.revision += 1;
  }

  function hasActivity(draft) {
    return draft.bonuses.some(Boolean) || draft.rows.slice(0, draft.rowCount)
      .some(row => Object.values(row).some(value => value.trim() !== ''));
  }

  function hasDraftData(draft) {
    return draft.bonuses.some(Boolean) || draft.rows
      .some(row => Object.values(row).some(value => value !== ''));
  }

  function get(key) {
    const draft = draftFor(key);
    return {
      key: draft.key,
      rowCount: draft.rowCount,
      rows: draft.rows.map(row => ({ ...row })),
      bonuses: [...draft.bonuses],
      result: cloneResult(draft.result),
      calculated: draft.result !== null,
      hasActivity: hasActivity(draft),
      hasDraftData: hasDraftData(draft),
      errors: errorsFor(draft),
      revision: draft.revision,
    };
  }

  function setValue(key, rowIndex, fieldId, raw) {
    const draft = draftFor(key);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= draft.rows.length) {
      throw new RangeError('Row index is outside this exam draft.');
    }
    if (!EXAM_CONFIGS[key].fields.some(item => item.id === fieldId)) {
      throw new RangeError(`Unknown field for ${key}: ${fieldId}`);
    }
    // Keep invalid input visible, but make a stale score/copy impossible.
    draft.rows[rowIndex][fieldId] = raw === null || raw === undefined ? '' : String(raw);
    invalidate(draft);
    recompute(draft);
    return get(key);
  }

  function setRowCount(key, count) {
    const draft = draftFor(key);
    const current = EXAM_CONFIGS[key];
    if (key !== 'quiz-positions' || !Number.isInteger(count) || count < 1 || count > current.maxRows) {
      throw new RangeError('Only positions support a row count, between 1 and 10.');
    }
    draft.rowCount = count;
    invalidate(draft);
    recompute(draft);
    return get(key);
  }

  function setBonus(key, index, checked) {
    const draft = draftFor(key);
    if (key !== 'consolidation' || !Number.isInteger(index) || index < 0 || index > 1) {
      throw new RangeError('Only consolidation has bonus checkboxes 0 and 1.');
    }
    draft.bonuses[index] = Boolean(checked);
    invalidate(draft);
    recompute(draft);
    return get(key);
  }

  function recompute(draft, throwOnInvalid = false) {
    const errors = errorsFor(draft);
    draft.result = null;
    if (errors.length) {
      if (throwOnInvalid) throw new ExamValidationError(errors);
      return null;
    }
    // Blank fields count as zero, but untouched or inactive-only drafts have no score.
    if (!hasActivity(draft)) return null;
    const key = draft.key;
    const current = EXAM_CONFIGS[key];
    // Integer tenths implement the existing weights without floating-point threshold drift.
    const rowTenths = draft.rows.slice(0, draft.rowCount).map(row => current.fields.reduce(
      (sum, item) => sum + parseCount(row[item.id]).value * (item.weight * 10), 0));
    const deductionTenths = rowTenths.reduce((sum, value) => sum + value, 0);
    const bonusTenths = key === 'consolidation'
      ? draft.bonuses.reduce((sum, checked) => sum + (checked ? 5 : 0), 0) : 0;
    const baseScore = (1000 - deductionTenths) / 10;
    const score = (1000 - deductionTenths + bonusTenths) / 10;
    const grades = gradeFor(key, score);
    draft.result = {
      score,
      scoreText: score.toFixed(1),
      baseScore,
      deductions: deductionTenths / 10,
      bonus: bonusTenths / 10,
      rowDeductions: rowTenths.map(value => value / 10),
      ...grades,
      copyText: current.group === 'review' ? grades.grade : score.toFixed(1),
    };
    return cloneResult(draft.result);
  }

  // Kept for callers that explicitly need validation; ordinary mutations recalculate safely.
  function calculate(key) {
    return recompute(draftFor(key), true);
  }

  function resetCurrent(key) {
    const draft = draftFor(key);
    draft.rows = draft.rows.map(() => emptyRow(EXAM_CONFIGS[key]));
    draft.bonuses = [false, false];
    // The user's selected row count is a setting, not an error value to erase.
    invalidate(draft);
    return get(key);
  }

  return Object.freeze({
    get, setValue, setRowCount, setBonus, calculate, resetCurrent,
    getCopyText: key => draftFor(key).result?.copyText ?? null,
  });
}
