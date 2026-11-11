import { EXAM_CONFIGS, ExamValidationError, createExamStore } from './exam-model.mjs';
import { normalizeQuran } from './quran-search.mjs';
import { loadQuran, searchQuran } from './quran-client.mjs';
import { SurahCombobox } from './surah-combobox.mjs';
import { fitPopup, revealFocusedAnchor } from './popup-position.mjs';
import { createNavigation, getNavigationPage, stepNavigation, returnToSelection } from './quran-navigation.mjs';
import { createModalController } from './modal-controller.mjs';

const $ = id => document.getElementById(id);
const store = createExamStore();
// A result is shown only for the draft revision the user calculated; editing,
// resetting or changing the row count bumps the revision and hides it again.
const shown = new Map();
const groups = {
  review: { title: 'اتصال المراجعة التراكميّ', keys: ['review-save', 'review-tathbeet'] },
  testing: { title: 'الاختبارات', keys: ['testing-monthly', 'testing-cumulative'] },
  consolidation: { title: 'دورة التثبيت', keys: ['consolidation'] },
  quiz: { title: 'المسابقات', keys: ['quiz-positions', 'quiz-narration'] },
};
const lastType = Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, group.keys[0]]));
let activeKey = 'review-save';
let resetTarget = null;
let resetTrigger = null;
let resetConfirmed = false;
let toastTimer;
let quranIndex;
let quranPromise;
let searchGeneration = 0;
let searchTimer;
let searchMatches = [];
let searchLimit = 20;
const BROWSE_GROUP_SIZE = 20;
let renderGeneration = 0;
let renderedView = null;
document.documentElement.dataset.inputModality = 'keyboard';
document.addEventListener('pointerdown', () => { document.documentElement.dataset.inputModality = 'pointer'; }, { capture: true });
document.addEventListener('keydown', () => { document.documentElement.dataset.inputModality = 'keyboard'; }, { capture: true });
// This object and this Mushaf DOM are never replaced by exam navigation.
const mushaf = { surah: null, endSurah: null, cross: false, range: null, navigation: null, highlight: null };
const quranPlaceholder = $('quran-page').firstElementChild;
const copyButton = $('copy-result');
const resetModal = createModalController($('reset-dialog'));
const copyModal = createModalController($('copy-dialog'));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addActionIcon(button, name) {
  const paths = {
    copy: ['M9 9h11v11H9z', 'M5 15H3V3h12v2'],
    trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
    cancel: ['m6 6 12 12M18 6 6 18'],
    eraser: ['m4 14 9-10 8 7-9 10H8zM9 9l8 7M12 21h9'],
    refresh: ['M20 7v5h-5M4 17v-5h5', 'M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1'],
    more: ['m6 9 6 6 6-6'],
    return: ['M9 5 3 11l6 6M3 11h12a6 6 0 0 1 6 6v3'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('action-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths[name]) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  button.classList.add('action-button');
  button.prepend(svg);
}
for (const [id, icon] of Object.entries({ 'copy-result': 'copy', 'reset-marks': 'trash', 'cancel-incomplete': 'eraser', 'cancel-reset': 'cancel', 'confirm-reset': 'trash', 'close-copy': 'cancel', 'retry-quran': 'refresh', 'return-selected': 'return' })) addActionIcon($(id), icon);

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}

function renderExam() {
  const config = EXAM_CONFIGS[activeKey];
  const draft = store.get(activeKey);
  const section = $(`${config.group}-section`);
  const heading = section.querySelector('.section-title');
  $('exam-heading')?.removeAttribute('id');
  heading.id = 'exam-heading';
  heading.tabIndex = -1;
  document.querySelectorAll('.content-section').forEach(node => node.classList.toggle('active', node === section));
  // Move the very same nodes into the original section-specific slots. No fetch,
  // combobox setup, range rendering or search initialization happens on navigation.
  for (const [anchor, shared] of [[`${config.group}-mushaf-anchor`, 'shared-mushaf'], [`${config.group}-calculator-anchor`, 'shared-calculator']]) {
    // A no-op reinsertion would still blur a focused descendant in Chromium.
    if ($(anchor).nextElementSibling !== $(shared)) $(anchor).after($(shared));
  }
  $('calculator-title').textContent = config.group === 'review' ? `حاسبة ${config.title}`
    : config.group === 'consolidation' ? 'حاسبة التثبيت'
      : config.group === 'quiz' ? `حاسبة ${config.title}` : config.title;
  $('marks-caption').textContent = `${groups[config.group].title} — ${config.title}`;
  $('exam-note').textContent = config.group === 'review' ? 'درجة النجاح: 95' : 'درجة النجاح: 90';
  document.querySelectorAll('[data-exam]').forEach(button => {
    const selected = button.dataset.exam === lastType[EXAM_CONFIGS[button.dataset.exam].group];
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-section]').forEach(button => {
    const selected = button.dataset.section === config.group;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('row-count-field').hidden = activeKey !== 'quiz-positions';
  $('entry-count').value = draft.rowCount;
  const header = element('tr');
  const originalLabels = ['عدد تصحيح الحركات', 'عدد فتح الكلمات', 'عدد فتح الآيات', 'عدد التأتأة مع تنبيه', 'عدد التأتأة بدون تنبيه', 'أحكام الميم والنون', 'المعاني'];
  for (const text of ['#', ...config.fields.map((field, i) => originalLabels[i]), 'النتيجة']) {
    const th = element('th', '', text);
    th.scope = 'col';
    header.append(th);
  }
  $('marks-head').replaceChildren(header);
  document.querySelector('.marks-table').dataset.quiz = String(config.group === 'quiz');
  const rows = document.createDocumentFragment();
  draft.rows.slice(0, draft.rowCount).forEach((row, rowIndex) => {
    const tr = element('tr');
    const number = element('td', '', rowIndex + 1);
    tr.append(number);
    for (const field of config.fields) {
      const td = element('td');
      const input = element('input', field.id);
      Object.assign(input, { type: 'number', min: '0', step: '1', inputMode: 'numeric', value: row[field.id] });
      input.dataset.row = rowIndex;
      input.dataset.field = field.id;
      input.setAttribute('aria-label', `الموضع ${rowIndex + 1}: ${field.label}`);
      const error = element('p', 'field-error');
      error.id = `mark-error-${rowIndex}-${field.id}`;
      error.dataset.row = rowIndex;
      error.dataset.field = field.id;
      error.hidden = true;
      input.setAttribute('aria-describedby', `${error.id} exam-error`);
      input.setAttribute('aria-errormessage', error.id);
      input.autocomplete = 'off';
      // Marks are typed, never nudged: the wheel and arrow keys must not change them.
      input.addEventListener('wheel', () => input.blur(), { passive: true });
      input.addEventListener('keydown', event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault(); });
      input.addEventListener('input', () => {
        store.setValue(activeKey, rowIndex, field.id, input.validity.badInput ? 'invalid' : input.value);
        renderResult();
      });
      td.append(input, error);
      tr.append(td);
    }
    const deduction = element('td');
    const deductionText = element('span', 'result row-result', '0');
    deductionText.dataset.row = rowIndex;
    deduction.dataset.row = rowIndex;
    deduction.append(deductionText);
    tr.append(deduction);
    rows.append(tr);
  });
  $('marks-body').replaceChildren(rows);
  $('bonus-controls').hidden = activeKey !== 'consolidation';
  $('bonus-q1').checked = draft.bonuses[0];
  $('bonus-q2').checked = draft.bonuses[1];
  draft.bonuses.forEach((checked, i) => { $(`bonus-q${i + 1}-points`).textContent = checked ? '+0.5' : '0'; });
  $('quiz-note')?.remove();
  if (config.group === 'quiz') {
    const note = element('div', 'quiz-note');
    note.id = 'quiz-note';
    const explanation = element('p');
    explanation.append(element('strong', '', 'ملاحظة:'), document.createTextNode(' خانة المعاني تعني عدد أخطاء المفردات (يخصم نقطة لكل خطأ)'));
    note.append(explanation);
    note.append(element('p', '', 'خانة أحكام الميم والنون تعني عدد أخطاء أحكام الميم والنون الساكنة (يخصم 0.5 لكل خطأ)'));
    $('row-count-field').after(note);
  }
  renderResult();
}

function selectExam(key) {
  if (!EXAM_CONFIGS[key] || key === activeKey) return;
  activeKey = key;
  lastType[EXAM_CONFIGS[key].group] = key;
  renderExam();
  fitOpenPopups();
}

function renderValidation(draft) {
  const errors = new Map(draft.errors.map(error => [`${error.row}:${error.field}`, error.message]));
  $('marks-body').querySelectorAll('input').forEach(input => {
    const message = errors.get(`${input.dataset.row}:${input.dataset.field}`) || '';
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = $(`mark-error-${input.dataset.row}-${input.dataset.field}`);
    if (error.textContent !== message) error.textContent = message;
    error.hidden = !message;
  });
  $('exam-error').textContent = draft.errors.length ? 'راجع خانات الأخطاء المبيّنة أدناه.' : '';
}

function renderResult() {
  const draft = store.get(activeKey);
  const result = shown.get(activeKey) === draft.revision ? draft.result : null;
  const container = $('result-content');
  const config = EXAM_CONFIGS[activeKey];
  renderValidation(draft);
  copyButton.hidden = !result;
  copyButton.disabled = !result;
  $('reset-marks').hidden = !result;
  $('cancel-incomplete').hidden = Boolean(result) || !draft.hasDraftData;
  document.querySelector('.draft-actions').hidden = !result && !draft.hasDraftData;
  $('failure-alert').hidden = !result || result.passed;
  if (!result) {
    // Keep the button and its listener alive, but never expose a stale copy.
    $('result-controls-parking').append(copyButton);
    if (container.firstChild) container.replaceChildren();
    document.querySelectorAll('.row-result').forEach(node => { node.textContent = '0'; });
    return;
  }
  const review = config.group === 'review';
  const consolidation = config.group === 'consolidation';
  // Reuse the result table while typing. In particular, never rebuild marking
  // inputs or take focus away from the field currently being edited.
  if (container.dataset.exam !== activeKey || !container.querySelector('.result-table')) {
    $('result-controls-parking').append(copyButton);
    container.replaceChildren();
    container.dataset.exam = activeKey;
    const table = element('table', 'result-table');
    const body = element('tbody');
    table.append(body);
    const addRow = (label, value, className = '') => {
      const row = element('tr');
      row.append(element('td', '', label));
      const cell = element('td', className);
      cell.append(value instanceof Node ? value : document.createTextNode(value));
      row.append(cell);
      body.append(row);
    };
    addRow(config.group === 'testing' ? 'نوع الاختبار' : 'نوع التقييم', review
      ? `اتصال المراجعة التراكميّ - ${config.title}` : consolidation ? 'التثبيت' : config.title);
    if (consolidation) {
      addRow('النتيجة الأساسية', '', 'base-score');
      addRow('البونص', '', 'bonus-score');
    }
    const score = element('span');
    score.id = 'total-result';
    score.append(element('bdi', 'numeric-score'), element('span', 'score-description'));
    const scoreAndCopy = element('div', 'score-with-copy');
    scoreAndCopy.append(score, copyButton);
    addRow(consolidation ? 'النتيجة النهائية' : 'النتيجة', scoreAndCopy, 'score-cell');
    if (review) addRow('التقدير', '', 'verbal-grade');
    if (!consolidation) addRow('التاريخ', new Date().toLocaleDateString('ar-EG'));
    container.append(table);
  }
  if (consolidation) {
    container.querySelector('.base-score').textContent = result.baseScore.toFixed(1);
    container.querySelector('.bonus-score').textContent = result.bonus > 0 ? `+${result.bonus.toFixed(1)}` : '0';
  }
  const emoji = review ? result.score >= 99 ? '🥳' : result.score >= 97 ? '😎' : result.score >= 95 ? '😁' : '❌'
    : result.score >= 99 ? '🥳' : result.score >= 95 ? '😎' : result.score >= 90 ? '😁' : '🤕';
  $('total-result').className = review ? (result.passed ? 'result-pass' : 'result-incomplete') : '';
  container.querySelector('.numeric-score').textContent = result.scoreText;
  container.querySelector('.score-description').textContent = ` ${emoji} ${result.grade || result.status}`;
  if (review) container.querySelector('.verbal-grade').textContent = result.grade;
  if (!result.passed) {
    $('failure-alert').querySelector('.failure-heading').textContent = review ? 'غير مكتمل' : consolidation ? 'يحتاج تحسين' : 'راسب';
    $('failure-alert').querySelector('.failure-description').textContent = `النتيجة أقل من درجة النجاح (${review ? 95 : 90}). راجع الأخطاء قبل اعتماد النتيجة.`;
  }
  document.querySelectorAll('.row-result').forEach((node, i) => { node.textContent = result.rowDeductions[i] ? `−${result.rowDeductions[i].toFixed(1)}` : '0'; });
}

// Original behaviour: every press of the calculate button celebrates when the
// score reaches the exam's threshold. Skipped for reduced motion.
function celebrate(key, result) {
  const group = EXAM_CONFIGS[key].group;
  if (result.score < ORIGINAL_CELEBRATION_THRESHOLDS[group]) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  showConfetti();
  // The original pulsed the score for every group except review.
  if (group !== 'review') {
    const score = $('total-result');
    score.style.animation = 'none';
    void score.offsetWidth; // restart the pulse on repeated presses
    score.style.animation = 'resultPulse 0.6s ease-in-out';
  }
}

$('calculate-marks').addEventListener('click', () => {
  const key = activeKey;
  try { store.calculate(key, { force: true }); }
  catch (error) { if (!(error instanceof ExamValidationError)) throw error; /* shown inline */ }
  const draft = store.get(key);
  if (draft.result) shown.set(key, draft.revision); else shown.delete(key);
  renderResult();
  if (!draft.result) { $('marks-body').querySelector('[aria-invalid="true"]')?.focus(); return; }
  celebrate(key, draft.result);
  $('result-content').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});

// Original celebration thresholds (review 95, testing 99, consolidation 99, quiz 90).
const ORIGINAL_CELEBRATION_THRESHOLDS = Object.freeze({ review: 95, testing: 99, consolidation: 99, quiz: 90 });
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => selectExam(lastType[button.dataset.section])));
document.querySelectorAll('[data-exam]').forEach(button => button.addEventListener('click', () => selectExam(button.dataset.exam)));
$('instructions-button').addEventListener('click', () => window.open('instructions.html', '_blank', 'noopener'));
for (let n = 1; n <= 10; n++) $('entry-count').append(new Option(n, n));
$('entry-count').addEventListener('change', () => { store.setRowCount(activeKey, Number($('entry-count').value)); renderExam(); });
['bonus-q1', 'bonus-q2'].forEach((id, i) => $(id).addEventListener('change', () => {
  store.setBonus(activeKey, i, $(id).checked);
  $(`${id}-points`).textContent = $(id).checked ? '+0.5' : '0';
  renderResult();
}));

function openReset(trigger) {
  if ($('reset-dialog').open || resetModal.closing) return;
  resetTarget = activeKey;
  resetTrigger = trigger;
  resetConfirmed = false;
  const incomplete = trigger.id === 'cancel-incomplete';
  $('reset-title').textContent = incomplete ? 'تأكيد إلغاء الإدخالات' : 'تأكيد مسح العلامات';
  $('reset-description').textContent = incomplete ? 'سيتم مسح إدخالات الاختبار الحالي فقط. هل أنت متأكد؟' : 'سيتم مسح علامات الاختبار الحالي فقط. هل أنت متأكد؟';
  $('confirm-reset').disabled = false;
  $('confirm-reset').removeAttribute('aria-disabled');
  resetModal.open();
  $('cancel-reset').focus();
}
$('reset-marks').addEventListener('click', () => openReset($('reset-marks')));
$('cancel-incomplete').addEventListener('click', () => openReset($('cancel-incomplete')));
$('cancel-reset').addEventListener('click', () => resetModal.close());
$('confirm-reset').addEventListener('click', async () => {
  if (resetModal.closing || resetConfirmed) return;
  // Keep the focused button in the native modal during its exit. The guard
  // above prevents duplicate actions without disabling/blurring that control.
  $('confirm-reset').setAttribute('aria-disabled', 'true');
  if (resetTarget) store.resetCurrent(resetTarget);
  resetConfirmed = true;
  renderExam();
  await resetModal.close();
  notify('مُسحت علامات هذا النوع فقط. لم تتغيّر علامات الامتحانات الأخرى أو المصحف.');
});
$('reset-dialog').addEventListener('close', () => {
  const target = !resetConfirmed && resetTrigger && !resetTrigger.hidden ? resetTrigger : $('marks-body').querySelector('input');
  resetTarget = null;
  resetTrigger = null;
  target?.focus({ preventScroll: true });
});

async function copyResult() {
  const key = activeKey;
  const value = store.getCopyText(key);
  if (value === null) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(value);
    notify('تم نسخ النتيجة فقط.');
    return;
  } catch { /* Older browsers and denied permissions get a selection fallback. */ }
  // Do not expose a stale result if marks changed while permission was pending.
  if (activeKey !== key || store.getCopyText(key) !== value) return;
  const input = $('manual-copy');
  input.value = value;
  input.dir = EXAM_CONFIGS[key].group === 'review' ? 'rtl' : 'ltr';
  copyModal.open();
  input.focus();
  input.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* Manual selection stays usable. */ }
  if (copied) { await copyModal.close({ animate: false }); notify('تم نسخ النتيجة فقط.'); }
}
$('copy-result').addEventListener('click', copyResult);
$('close-copy').addEventListener('click', () => copyModal.close());
$('copy-dialog').addEventListener('close', () => (copyButton.hidden ? $('marks-body').querySelector('input') : copyButton)?.focus({ preventScroll: true }));

const startCombo = new SurahCombobox($('start-surah-combobox'), surah => {
  mushaf.surah = surah.number;
  $('start-ayah').value = '1';
  $('end-ayah').value = String(Math.min(10, surah.numberOfAyahs));
  $('start-ayah').max = $('end-ayah').max = surah.numberOfAyahs;
  $('range-error').textContent = '';
  if (mushaf.endSurah === null) {
    endCombo.setSelected(surah.number);
    mushaf.endSurah = surah.number;
    $('cross-end-ayah').value = $('end-ayah').value;
    $('cross-end-ayah').max = surah.numberOfAyahs;
  }
});
const endCombo = new SurahCombobox($('end-surah-combobox'), surah => {
  mushaf.endSurah = surah.number;
  $('cross-end-ayah').max = surah.numberOfAyahs;
  $('range-error').textContent = '';
});
$('cross-surah').addEventListener('change', () => {
  mushaf.cross = $('cross-surah').checked;
  $('cross-range-fields').hidden = !mushaf.cross;
  $('single-end-field').hidden = mushaf.cross;
});

async function ensureQuran() {
  if (quranIndex) return quranIndex;
  if (quranPromise) return quranPromise;
  $('retry-quran').hidden = true;
  const loading = element('div', 'quran-loading');
  loading.append(element('div', 'loading-spinner spinner'), element('span', '', 'جاري تحميل الآيات...'));
  $('quran-page').setAttribute('aria-busy', 'true');
  $('quran-page').replaceChildren(loading);
  quranPromise = (async () => {
    // Alignment/indexing stays in a module worker, leaving marking inputs responsive.
    quranIndex = await loadQuran();
    $('quran-page').replaceChildren(quranPlaceholder);
    $('quran-page').setAttribute('aria-busy', 'false');
    startCombo.setSurahs(quranIndex.surahs);
    endCombo.setSurahs(quranIndex.surahs);
    $('load-verses').disabled = false;
    $('search-status').textContent = 'البحث جاهز في 114 سورة و6236 آية. اكتب حرفين على الأقل.';
    return quranIndex;
  })().catch(error => {
    quranPromise = null;
    $('quran-page').replaceChildren(quranPlaceholder);
    $('quran-page').setAttribute('aria-busy', 'false');
    $('range-error').textContent = 'تعذّر تحميل نسخة المصحف المحلية. اضغط «إعادة تحميل المصحف»؛ يمكنك متابعة حساب العلامات.';
    $('search-status').textContent = 'البحث غير جاهز. أعد تحميل المصحف.';
    $('retry-quran').hidden = false;
    console.error(error);
    throw error;
  });
  return quranPromise;
}
$('retry-quran').addEventListener('click', () => { $('range-error').textContent = ''; ensureQuran().catch(() => {}); });

function readAyah(id, surah) {
  const value = $(id).value;
  const max = quranIndex.surahs[surah - 1]?.numberOfAyahs;
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) {
    $(id).setAttribute('aria-invalid', 'true');
    throw new Error(`رقم الآية يجب أن يكون عددًا صحيحًا من 1 إلى ${max} في السورة المختارة.`);
  }
  $(id).removeAttribute('aria-invalid');
  return Number(value);
}
function position(surah, ayah) { return quranIndex.verses.indexOf(quranIndex.byKey.get(`${surah}:${ayah}`)); }
$('range-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await ensureQuran();
    if (!mushaf.surah) throw new Error('اختر سورة البداية من القائمة أولاً. الكتابة وحدها لا تختار سورة.');
    if (mushaf.cross && !mushaf.endSurah) throw new Error('اختر سورة النهاية من القائمة.');
    const from = readAyah('start-ayah', mushaf.surah);
    const endSurah = mushaf.cross ? mushaf.endSurah : mushaf.surah;
    const to = readAyah(mushaf.cross ? 'cross-end-ayah' : 'end-ayah', endSurah);
    const start = position(mushaf.surah, from);
    const end = position(endSurah, to);
    if (end < start) throw new Error('نهاية الموضع تسبق بدايته. اختر سورة أو آية نهاية تأتي بعد البداية في ترتيب المصحف.');
    mushaf.range = { start, end };
    mushaf.navigation = createNavigation(start, end, quranIndex.verses.length, BROWSE_GROUP_SIZE);
    mushaf.highlight = null;
    $('range-error').textContent = '';
    await renderQuran();
  } catch (error) { $('range-error').textContent = error.message; }
});

function appendHighlighted(parent, text, ranges = []) {
  let offset = 0;
  for (const range of ranges) {
    parent.append(document.createTextNode(text.slice(offset, range.start)));
    parent.append(element('mark', 'search-highlight', text.slice(range.start, range.end)));
    offset = range.end;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}
async function renderQuran() {
  if (!mushaf.navigation) return;
  const navigation = mushaf.navigation;
  const highlight = mushaf.highlight;
  const generation = ++renderGeneration;
  const bounds = getNavigationPage(navigation);
  const pageStart = bounds.start;
  const pageEnd = bounds.end + 1;
  if (renderedView?.start === pageStart && renderedView.end === bounds.end && renderedView.highlight === highlight) {
    $('quran-page').setAttribute('aria-busy', 'false');
    $('reader-progress').hidden = true;
    updateReaderLocation(navigation, bounds);
    return true;
  }
  const fragment = document.createDocumentFragment();
  let previousSurah = null;
  let verses;
  let count = 0;
  const selectedVerses = quranIndex.verses.slice(pageStart, pageEnd);
  const surahEnds = new Map();
  for (const verse of selectedVerses) surahEnds.set(verse.surah, verse.ayah);
  $('quran-page').setAttribute('aria-busy', 'true');
  $('reader-progress').hidden = selectedVerses.length <= 200;
  $('reader-progress').textContent = 'جارٍ تجهيز جميع آيات الموضع…';
  for (const verse of selectedVerses) {
    if (verse.surah !== previousSurah) {
      const surah = quranIndex.surahs[verse.surah - 1];
      const heading = element('div', 'quran-surah-header');
      heading.append(element('h3', 'quran-surah-name surah-heading', surah.name));
      heading.append(element('p', 'quran-ayah-range', `الآيات ${verse.ayah} - ${surahEnds.get(verse.surah)}`));
      fragment.append(heading);
      verses = element('p', 'quran-verses-content quran-verses');
      fragment.append(verses);
      previousSurah = verse.surah;
    }
    const span = element('span', 'quran-verse');
    span.dataset.verseKey = `${verse.surah}:${verse.ayah}`;
    const text = element('span', 'quran-text');
    const match = highlight?.surah === verse.surah && highlight.ayah === verse.ayah ? highlight : null;
    appendHighlighted(text, verse.text, match?.ranges);
    span.append(text);
    const number = element('span', 'ayah-number', new Intl.NumberFormat('ar-EG').format(verse.ayah));
    number.setAttribute('aria-label', `الآية ${verse.ayah}`);
    span.append(number);
    verses.append(span, document.createTextNode(' '));
    // Build large selections off-DOM in bounded batches; never paginate them.
    // Yielding also lets a newer selection cancel this unfinished render.
    if (selectedVerses.length > 200 && ++count % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (generation !== renderGeneration) return false;
    }
  }
  if (generation !== renderGeneration) return false;
  // The source already contains its Bismillah. Never prepend or edit its text.
  fragment.append($('mushaf-pagination'));
  $('quran-page').replaceChildren(fragment);
  $('quran-page').setAttribute('aria-busy', 'false');
  $('reader-progress').hidden = true;
  renderedView = { ...bounds, highlight };
  updateReaderLocation(navigation, bounds);
  return true;
}

function updateReaderLocation(navigation, bounds) {
  $('mushaf-pagination').hidden = false;
  $('previous-page').disabled = !navigation.canPrevious;
  $('next-page').disabled = !navigation.canNext;
  $('previous-page').classList.toggle('disabled', $('previous-page').disabled);
  $('next-page').classList.toggle('disabled', $('next-page').disabled);
  const first = quranIndex.verses[bounds.start];
  const last = quranIndex.verses[bounds.end];
  const displayed = first.surah === last.surah
    ? `${quranIndex.surahs[first.surah - 1].name} — الآيات ${first.ayah}–${last.ayah}`
    : `${quranIndex.surahs[first.surah - 1].name} (${first.ayah}) — ${quranIndex.surahs[last.surah - 1].name} (${last.ayah})`;
  const anchorFirst = quranIndex.verses[navigation.start];
  const anchorLast = quranIndex.verses[navigation.end];
  $('reader-location').hidden = false;
  $('selected-range-summary').textContent = `الموضع المختار: ${quranIndex.surahs[anchorFirst.surah - 1].name} (${anchorFirst.ayah}) — ${quranIndex.surahs[anchorLast.surah - 1].name} (${anchorLast.ayah})؛ ${navigation.end - navigation.start + 1} آية`;
  $('return-selected').hidden = navigation.pageIndex === 0;
  $('page-status').textContent = `${navigation.pageIndex === 0 ? 'الموضع المختار كاملًا' : navigation.pageIndex < 0 ? 'موضع مجاور قبل الاختيار' : 'موضع مجاور بعد الاختيار'} — ${displayed}`;
}

async function changePage(delta) {
  if (!mushaf.navigation) return;
  const focusedControl = document.activeElement?.matches('#previous-page, #next-page') ? document.activeElement.id : null;
  mushaf.navigation = stepNavigation(mushaf.navigation, delta);
  const rendered = await renderQuran();
  if (!rendered) return;
  if (focusedControl) {
    const preferred = $(focusedControl);
    const available = preferred.disabled ? $(focusedControl === 'next-page' ? 'previous-page' : 'next-page') : preferred;
    if (!available.disabled) available.focus({ preventScroll: true });
  }
}
$('previous-page').addEventListener('click', () => changePage(-1));
$('next-page').addEventListener('click', () => changePage(1));
$('return-selected').addEventListener('click', async () => {
  if (!mushaf.navigation) return;
  mushaf.navigation = returnToSelection(mushaf.navigation);
  if (await renderQuran()) {
    $('quran-page').tabIndex = -1;
    $('quran-page').focus({ preventScroll: true });
    $('reader-location').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
});

function dismissSearch() {
  searchGeneration++;
  clearTimeout(searchTimer);
  $('verse-search-results').hidden = true;
  $('verse-search').setAttribute('aria-expanded', 'false');
}
function renderSearchResults() {
  const results = $('verse-search-results');
  const previousMore = document.activeElement?.id === 'more-search-results';
  results.replaceChildren();
  for (const match of searchMatches.slice(0, searchLimit)) {
    const button = element('button', 'search-result-item search-result');
    button.type = 'button';
    button.dataset.verseKey = `${match.surah}:${match.ayah}`;
    const text = element('span', 'search-result-text');
    // Show the FULL verse: even a match near the end of the longest verse is visible.
    appendHighlighted(text, match.text, match.ranges);
    button.append(text);
    button.append(element('span', 'search-result-info search-result-meta', `${match.surahName} - آية ${match.ayah}`));
    button.addEventListener('click', () => jumpToMatch(match));
    results.append(button);
  }
  if (searchMatches.length > searchLimit) {
    const more = element('button', 'secondary', `عرض المزيد (${searchMatches.length - searchLimit} آية متبقية)`);
    more.type = 'button';
    more.id = 'more-search-results';
    addActionIcon(more, 'more');
    more.addEventListener('click', () => { searchLimit += 20; renderSearchResults(); });
    results.append(more);
  }
  if (!searchMatches.length) results.append(element('p', 'search-empty', 'لا توجد آيات مطابقة. جرّب عبارة أقصر أو تحقق من الإملاء.'));
  else results.append(element('div', 'search-result-count', `عُثر على ${searchMatches.length} ${searchMatches.length === 1 ? 'نتيجة' : 'نتائج'}`));
  results.hidden = false;
  $('verse-search').setAttribute('aria-expanded', 'true');
  fitPopup($('quran-search-container'), results, 420);
  if (previousMore) results.querySelectorAll('.search-result')[searchLimit - 20]?.focus();
}
async function runSearch(query, generation) {
  try {
    await ensureQuran();
    if (generation !== searchGeneration || $('verse-search').value !== query) return;
    const matches = await searchQuran(query);
    if (generation !== searchGeneration || $('verse-search').value !== query) return;
    searchMatches = matches;
    searchLimit = 20;
    $('search-status').textContent = `${searchMatches.length} آية مطابقة في المصحف كاملاً.`;
    renderSearchResults();
  } catch {
    if (generation === searchGeneration) $('search-status').textContent = 'تعذّر البحث. أعد تحميل المصحف وحاول مجددًا.';
  }
}
function queueSearch() {
  clearTimeout(searchTimer);
  const generation = ++searchGeneration;
  const query = $('verse-search').value;
  if (normalizeQuran(query).length < 2) {
    $('verse-search-results').hidden = true;
    $('verse-search').setAttribute('aria-expanded', 'false');
    $('search-status').textContent = 'اكتب حرفين على الأقل للبحث في المصحف كاملاً.';
    return;
  }
  $('search-status').textContent = 'جارٍ البحث في المصحف كاملاً…';
  searchTimer = setTimeout(() => runSearch(query, generation), 150);
}
$('verse-search').addEventListener('input', queueSearch);
$('verse-search').addEventListener('focus', () => { if ($('verse-search').value.trim()) queueSearch(); });
$('verse-search').addEventListener('keydown', event => {
  if (event.key === 'Escape') dismissSearch();
  if (event.key === 'ArrowDown' && !$('verse-search-results').hidden) {
    event.preventDefault(); $('verse-search-results').querySelector('button')?.focus();
  }
});
$('verse-search-results').addEventListener('keydown', event => {
  if (event.key === 'Escape') { $('verse-search').focus(); dismissSearch(); return; }
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const buttons = [...$('verse-search-results').querySelectorAll('button')];
  const current = buttons.indexOf(document.activeElement);
  event.preventDefault();
  if (event.key === 'ArrowUp' && current === 0) $('verse-search').focus();
  else buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
});
document.addEventListener('pointerdown', event => { if (!$('quran-search-container').contains(event.target)) dismissSearch(); });
document.addEventListener('focusin', event => { if (!$('quran-search-container').contains(event.target)) dismissSearch(); });

async function jumpToMatch(match) {
  mushaf.surah = match.surah;
  startCombo.setSelected(match.surah);
  const max = quranIndex.surahs[match.surah - 1].numberOfAyahs;
  const first = Math.max(1, match.ayah - 5);
  const last = Math.min(max, match.ayah + 5);
  $('start-ayah').value = first;
  $('end-ayah').value = last;
  $('start-ayah').max = $('end-ayah').max = max;
  mushaf.cross = false;
  $('cross-surah').checked = false;
  $('cross-range-fields').hidden = true;
  $('single-end-field').hidden = false;
  // The inactive cross-Surah endpoint is intentionally retained.
  mushaf.range = { start: position(match.surah, first), end: position(match.surah, last) };
  mushaf.navigation = createNavigation(mushaf.range.start, mushaf.range.end, quranIndex.verses.length, BROWSE_GROUP_SIZE);
  mushaf.highlight = match;
  $('range-error').textContent = '';
  dismissSearch();
  if (!await renderQuran()) return;
  $('quran-page').querySelector(`[data-verse-key="${match.surah}:${match.ayah}"]`)?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function fitOpenPopups() {
  document.documentElement.style.setProperty('--navigation-offset', `${document.querySelector('.main-navigation').getBoundingClientRect().height + 16}px`);
  fitPopup($('start-surah-combobox'), $('surah-options'));
  fitPopup($('end-surah-combobox'), $('end-surah-options'));
  fitPopup($('quran-search-container'), $('verse-search-results'), 420);
}
window.addEventListener('resize', fitOpenPopups, { passive: true });
window.addEventListener('scroll', fitOpenPopups, { passive: true, capture: true });
function fitFocusedPopup() {
  const input = document.activeElement;
  if (input?.matches('#surah-input, #end-surah-input, #verse-search, #cross-surah, #cross-end-ayah, #copy-result, #reset-marks, #cancel-incomplete, #entry-count')) revealFocusedAnchor(input);
  fitOpenPopups();
}
document.addEventListener('focusin', () => requestAnimationFrame(fitFocusedPopup));
window.visualViewport?.addEventListener('resize', fitFocusedPopup, { passive: true });
window.visualViewport?.addEventListener('scroll', fitOpenPopups, { passive: true });

// Original celebration implementation: appearance, timing and randomization are unchanged.
// ===== CONFETTI ANIMATION =====
function showConfetti() {
  var colors = [
    '#039f9e', '#c79c66', '#d4b38a',
    '#027a79', '#e0c9a8', '#048988',
    '#b88f5a', '#05b1b0', '#c9a876'
  ];

  var confettiCount = 100;

  for (var i = 0; i < confettiCount; i++) {
    (function (index) {
      setTimeout(function () {
        createConfettiPiece(colors[Math.floor(Math.random() * colors.length)]);
      }, Math.random() * 800);
    })(i);
  }
}

function createConfettiPiece(color) {
  var confetti = document.createElement('div');
  var size = Math.random() * 8 + 4;
  var startX = Math.random() * window.innerWidth;
  var velocityX = (Math.random() - 0.5) * 150;
  var rotationSpeed = Math.random() * 180 + 90;

  confetti.style.cssText =
    'position: fixed;' +
    'width: ' + size + 'px;' +
    'height: ' + size + 'px;' +
    'background: linear-gradient(45deg, ' + color + ', ' + adjustBrightness(color, 20) + ');' +
    'border-radius: 3px;' +
    'pointer-events: none;' +
    'z-index: 1000;' +
    'left: ' + startX + 'px;' +
    'top: -50px;' +
    'opacity: 1;' +
    'box-shadow: 0 0 6px rgba(0,0,0,0.1);' +
    'animation: confettiFall3D ' + (3 + Math.random() * 1.5) + 's linear forwards;';

  confetti.style.setProperty('--velocity-x', velocityX + 'px');
  confetti.style.setProperty('--rotation', rotationSpeed + 'deg');

  document.body.appendChild(confetti);

  setTimeout(function () {
    if (confetti.parentNode) {
      confetti.parentNode.removeChild(confetti);
    }
  }, 5000);
}

function adjustBrightness(hex, percent) {
  var num = parseInt(hex.replace('#', ''), 16);
  var amt = Math.round(2.55 * percent);
  var R = (num >> 16) + amt;
  var G = (num >> 8 & 0x00FF) + amt;
  var B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

renderExam();
ensureQuran().catch(() => {});
