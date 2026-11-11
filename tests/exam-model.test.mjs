import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_FIELDS, QUIZ_FIELDS, EXAM_CONFIGS, createExamStore, parseCount, gradeFor, ExamValidationError } from '../js/exam-model.mjs';

const keys = Object.keys(EXAM_CONFIGS);

test('seven configurations retain exact original fields, weights and default rows', () => {
  assert.deepEqual(keys, ['review-save', 'review-tathbeet', 'testing-monthly', 'testing-cumulative', 'consolidation', 'quiz-positions', 'quiz-narration']);
  assert.deepEqual(Object.values(EXAM_CONFIGS).map(item => item.rowCount), [3, 4, 5, 7, 7, 3, 1]);
  assert.deepEqual(BASE_FIELDS.map(item => item.weight), [2, 1, 2, 0.5, 0.1]);
  assert.deepEqual(QUIZ_FIELDS.map(item => item.weight), [2, 1, 2, 0.5, 0.1, 0.5, 1]);
  assert.equal(EXAM_CONFIGS['quiz-positions'].maxRows, 10);
  assert.ok(Object.isFrozen(EXAM_CONFIGS));
});

for (const key of keys) {
  test(`${key}: untouched stays uncalculated, explicit zero calculates live, copy contract is exact`, () => {
    const store = createExamStore();
    assert.equal(store.get(key).result, null);
    assert.equal(store.get(key).calculated, false);
    assert.equal(store.get(key).hasActivity, false);
    assert.equal(store.get(key).hasDraftData, false);
    assert.equal(store.getCopyText(key), null);
    assert.equal(store.calculate(key), null);
    const draft = store.setValue(key, 0, 'corrections', '0');
    const result = draft.result;
    assert.equal(result.score, 100);
    assert.equal(result.scoreText, '100.0');
    assert.equal(result.copyText, key.startsWith('review-') ? 'امتياز' : '100.0');
    assert.equal(draft.calculated, true);
    assert.equal(draft.hasActivity, true);
    assert.equal(draft.hasDraftData, true);
    assert.equal(store.getCopyText(key), result.copyText);
    assert.equal(result.rowDeductions.length, EXAM_CONFIGS[key].rowCount);
    assert.deepEqual(store.calculate(key), result);
    const cleared = store.setValue(key, 0, 'corrections', '');
    assert.equal(cleared.result, null);
    assert.equal(cleared.hasActivity, false);
    assert.equal(cleared.hasDraftData, false);
    assert.equal(store.calculate(key), null);
    assert.equal(store.getCopyText(key), null);
  });

  test(`${key}: all field weights and all active rows contribute exactly`, () => {
    const store = createExamStore();
    const current = EXAM_CONFIGS[key];
    current.fields.forEach(item => store.setValue(key, 0, item.id, 1));
    assert.equal(store.calculate(key).score, current.group === 'quiz' ? 92.9 : 94.4);
    for (let row = 1; row < current.rowCount; row += 1) store.setValue(key, row, 'word-openings', 1);
    const expected = (current.group === 'quiz' ? 929 : 944) - ((current.rowCount - 1) * 10);
    assert.equal(store.calculate(key).score, expected / 10);
  });

  test(`${key}: every field recalculates result and copy live without stale values`, () => {
    const store = createExamStore();
    let deductionTenths = 0;
    for (const item of EXAM_CONFIGS[key].fields) {
      const valid = store.setValue(key, 0, item.id, '1');
      deductionTenths += item.weight * 10;
      assert.equal(valid.result.score, (1000 - deductionTenths) / 10);
      assert.equal(valid.calculated, true);
      assert.equal(valid.errors.length, 0);
      assert.equal(store.getCopyText(key), valid.result.copyText);
      const invalid = store.setValue(key, 0, item.id, '-1');
      assert.equal(invalid.result, null);
      assert.equal(invalid.calculated, false);
      assert.equal(invalid.hasActivity, true);
      assert.equal(invalid.hasDraftData, true);
      assert.equal(invalid.errors.length, 1);
      assert.equal(invalid.errors[0].message, 'يجب إدخال عدد صحيح غير سالب (0 أو أكبر).');
      assert.equal(store.getCopyText(key), null);
      const repaired = store.setValue(key, 0, item.id, '1');
      assert.equal(repaired.result.score, (1000 - deductionTenths) / 10);
      assert.equal(repaired.errors.length, 0);
      assert.equal(store.getCopyText(key), repaired.result.copyText);
    }
  });

  test(`${key}: no unapproved floor or cap on the final score`, () => {
    const store = createExamStore();
    store.setValue(key, 0, 'corrections', 51);
    assert.equal(store.calculate(key).score, -2);
    assert.equal(store.getCopyText(key), key.startsWith('review-') ? 'غير مكتمل' : '-2.0');
  });
}

test('review thresholds, including immediately below every boundary', () => {
  for (const key of ['review-save', 'review-tathbeet']) {
    for (const [deductions, score, expected] of [[0, 100, 'امتياز'], [10, 99, 'امتياز'], [11, 98.9, 'ممتاز'], [30, 97, 'ممتاز'], [31, 96.9, 'جيد جداً'], [50, 95, 'جيد جداً'], [51, 94.9, 'غير مكتمل']]) {
      const store = createExamStore();
      store.setValue(key, 0, 'memorized-no-recitation', deductions);
      const result = store.calculate(key);
      assert.equal(result.score, score);
      assert.equal(result.grade, expected);
      assert.equal(result.copyText, expected);
      assert.equal(result.passed, score >= 95);
    }
  }
});

test('testing and quiz keep the exact 90 pass boundary', () => {
  for (const key of ['testing-monthly', 'testing-cumulative', 'quiz-positions', 'quiz-narration']) {
    for (const [count, score, status] of [[99, 90.1, 'ناجح'], [100, 90, 'ناجح'], [101, 89.9, '']]) {
      const store = createExamStore();
      store.setValue(key, 0, 'memorized-no-recitation', count);
      const result = store.calculate(key);
      assert.equal(result.score, score);
      assert.equal(result.status, status);
      assert.equal(result.copyText, score.toFixed(1));
    }
  }
});

test('consolidation retains every threshold and each independent half-point bonus', () => {
  const store = createExamStore();
  for (const [count, score, status] of [[10, 99, 'ممتاز'], [11, 98.9, 'جيد جداً'], [50, 95, 'جيد جداً'], [51, 94.9, 'جيد'], [100, 90, 'جيد'], [101, 89.9, 'يحتاج تحسين']]) {
    store.setValue('consolidation', 0, 'memorized-no-recitation', count);
    const result = store.calculate('consolidation');
    assert.equal(result.score, score);
    assert.equal(result.status, status);
  }
  store.resetCurrent('consolidation');
  store.setBonus('consolidation', 0, true);
  assert.equal(store.get('consolidation').result.score, 100.5);
  store.setBonus('consolidation', 1, true);
  assert.equal(store.getCopyText('consolidation'), '101.0');
  const result = store.calculate('consolidation');
  assert.equal(result.baseScore, 100);
  assert.equal(result.bonus, 1);
  assert.equal(result.score, 101);
  assert.equal(result.copyText, '101.0');
  store.setBonus('consolidation', 0, false);
  assert.equal(store.get('consolidation').result.score, 100.5);
  assert.equal(store.getCopyText('consolidation'), '100.5');
  const noBonuses = store.setBonus('consolidation', 1, false);
  assert.equal(noBonuses.hasActivity, false);
  assert.equal(noBonuses.hasDraftData, false);
  assert.equal(noBonuses.result, null);
});

test('all seven drafts and previously calculated results are independent', () => {
  const store = createExamStore();
  keys.forEach((key, index) => {
    store.setValue(key, 0, 'corrections', index + 1);
    store.calculate(key);
  });
  keys.forEach((key, index) => {
    assert.equal(store.get(key).rows[0].corrections, String(index + 1));
    assert.equal(store.get(key).result.score, 100 - (index + 1) * 2);
  });
  const before = keys.slice(1).map(key => store.get(key));
  store.setValue(keys[0], 1, 'word-openings', 7);
  assert.deepEqual(keys.slice(1).map(key => store.get(key)), before);
  assert.equal('mushaf' in store.get(keys[0]), false);
});

test('positions row count hides, restores and scores only active rows without losing values', () => {
  const store = createExamStore();
  store.setRowCount('quiz-positions', 10);
  store.setValue('quiz-positions', 9, 'Meaning', 9);
  store.setValue('quiz-positions', 4, 'corrections', 2);
  assert.equal(store.calculate('quiz-positions').score, 87);
  store.setRowCount('quiz-positions', 3);
  assert.equal(store.getCopyText('quiz-positions'), null);
  assert.equal(store.get('quiz-positions').hasActivity, false);
  assert.equal(store.get('quiz-positions').hasDraftData, true);
  assert.equal(store.calculate('quiz-positions'), null);
  store.setRowCount('quiz-positions', 5);
  assert.equal(store.get('quiz-positions').result.score, 96);
  assert.equal(store.getCopyText('quiz-positions'), '96.0');
  store.setRowCount('quiz-positions', 10);
  assert.equal(store.get('quiz-positions').rows[9].Meaning, '9');
  assert.equal(store.calculate('quiz-positions').score, 87);
});

test('row-count settings alone never produce activity, a result or copy text', () => {
  const store = createExamStore();
  for (const count of [10, 1, 5, 3]) {
    const draft = store.setRowCount('quiz-positions', count);
    assert.equal(draft.rowCount, count);
    assert.equal(draft.hasActivity, false);
    assert.equal(draft.hasDraftData, false);
    assert.equal(draft.result, null);
    assert.equal(store.calculate('quiz-positions'), null);
    assert.equal(store.getCopyText('quiz-positions'), null);
  }
});

test('whitespace is not marking activity; raw and inactive drafts remain discoverable for cancellation', () => {
  const store = createExamStore();
  const whitespace = store.setValue('review-save', 0, 'corrections', ' \t ');
  assert.equal(whitespace.hasActivity, false);
  assert.equal(whitespace.hasDraftData, true);
  assert.equal(whitespace.result, null);
  assert.deepEqual(whitespace.errors, []);
  const explicitZero = store.setValue('review-save', 0, 'word-openings', ' ٠ ');
  assert.equal(explicitZero.hasActivity, true);
  assert.equal(explicitZero.result.score, 100);
  assert.equal(store.setValue('review-save', 0, 'word-openings', '').result, null);
  store.setValue('quiz-positions', 9, 'Meaning', '0');
  const inactiveOnly = store.get('quiz-positions');
  assert.equal(inactiveOnly.hasActivity, false);
  assert.equal(inactiveOnly.hasDraftData, true);
  assert.equal(inactiveOnly.result, null);
  assert.equal(store.setRowCount('quiz-positions', 10).result.score, 100);
  const reset = store.resetCurrent('quiz-positions');
  assert.equal(reset.rowCount, 10);
  assert.equal(reset.hasDraftData, false);
  assert.equal(reset.result, null);
});

test('reset clears only the selected draft, including inactive rows and bonuses, not row-count settings', () => {
  const store = createExamStore();
  keys.forEach(key => {
    store.setValue(key, 0, 'corrections', 2);
    store.calculate(key);
  });
  store.setBonus('consolidation', 0, true);
  store.setBonus('consolidation', 1, true);
  store.calculate('consolidation');
  store.setRowCount('quiz-positions', 10);
  store.setValue('quiz-positions', 9, 'Meaning', 7);
  store.setRowCount('quiz-positions', 2);
  const otherKeys = keys.filter(key => key !== 'quiz-positions');
  const others = otherKeys.map(key => store.get(key));
  store.resetCurrent('quiz-positions');
  assert.deepEqual(otherKeys.map(key => store.get(key)), others);
  const reset = store.get('quiz-positions');
  assert.equal(reset.rowCount, 2);
  assert.equal(reset.result, null);
  assert.equal(reset.calculated, false);
  assert.equal(reset.hasActivity, false);
  assert.equal(reset.hasDraftData, false);
  assert.deepEqual(reset.errors, []);
  assert.ok(reset.rows.every(row => Object.values(row).every(value => value === '')));
  assert.equal(store.getCopyText('quiz-positions'), null);
  store.setRowCount('quiz-positions', 10);
  assert.equal(store.get('quiz-positions').rows[9].Meaning, '');
  store.resetCurrent('consolidation');
  assert.deepEqual(store.get('consolidation').bonuses, [false, false]);
  assert.equal(store.get('consolidation').result, null);
});

test('canceled reset is a controller decision: simply reading a draft cannot mutate it', () => {
  const store = createExamStore();
  store.setValue('review-save', 0, 'corrections', 4);
  store.calculate('review-save');
  const before = store.get('review-save');
  const snapshot = store.get('review-save');
  snapshot.rows[0].corrections = '999';
  snapshot.result.score = -1;
  snapshot.result.rowDeductions[0] = 999;
  snapshot.bonuses[0] = true;
  assert.deepEqual(store.get('review-save'), before);
});

test('integer policy accepts blank, zero, ASCII and Arabic digits but never truncates invalid input', () => {
  for (const raw of ['', ' ', null, undefined, 0, '00']) assert.deepEqual(parseCount(raw), { valid: true, value: 0, error: '' });
  assert.equal(parseCount('١٢').value, 12);
  assert.equal(parseCount('۱۲').value, 12);
  assert.equal(parseCount(' 3 ').value, 3);
  for (const raw of ['-1', '1.9', '1e2', '+2', 'NaN', 'Infinity', 'two', '9007199254740992', Infinity, {}, true]) assert.equal(parseCount(raw).valid, false, String(raw));
  const store = createExamStore();
  store.calculate('review-save');
  store.setValue('review-save', 0, 'corrections', '1.9');
  assert.equal(store.getCopyText('review-save'), null);
  assert.equal(store.get('review-save').rows[0].corrections, '1.9');
  assert.throws(() => store.calculate('review-save'), error => {
    assert.ok(error instanceof ExamValidationError);
    assert.equal(error.errors[0].row, 0);
    assert.equal(error.errors[0].field, 'corrections');
    return true;
  });
  assert.equal(store.get('review-save').result, null);
});

test('invalid live mutations preserve their raw value, never throw validation, and recover without calculation', () => {
  const store = createExamStore();
  for (const raw of ['-1', '1.5', '1e2', '+2', 'abc', '9007199254740992']) {
    const valid = store.setValue('testing-monthly', 0, 'corrections', '1');
    assert.equal(valid.result.score, 98);
    let draft;
    assert.doesNotThrow(() => { draft = store.setValue('testing-monthly', 0, 'corrections', raw); });
    assert.equal(draft.rows[0].corrections, raw);
    assert.equal(draft.result, null);
    assert.equal(draft.hasActivity, true);
    assert.equal(draft.hasDraftData, true);
    assert.equal(draft.errors[0].message, 'يجب إدخال عدد صحيح غير سالب (0 أو أكبر).');
    assert.equal(store.getCopyText('testing-monthly'), null);
    assert.throws(() => store.calculate('testing-monthly'), ExamValidationError);
    assert.equal(store.setValue('testing-monthly', 0, 'corrections', '0').result.score, 100);
  }
  const invalidBonus = store.setValue('consolidation', 0, 'corrections', '-1');
  assert.equal(invalidBonus.result, null);
  const bonusWhileInvalid = store.setBonus('consolidation', 0, true);
  assert.equal(bonusWhileInvalid.result, null);
  assert.equal(bonusWhileInvalid.errors.length, 1);
  assert.equal(store.setValue('consolidation', 0, 'corrections', '').result.score, 100.5);
  assert.equal(store.setBonus('consolidation', 0, false).result, null);
});

test('canceling an invalid draft clears only that draft and all of its errors', () => {
  const store = createExamStore();
  keys.forEach(key => store.setValue(key, 0, 'corrections', '0'));
  store.setValue('quiz-positions', 9, 'Meaning', '-1');
  store.setValue('quiz-positions', 0, 'corrections', 'invalid');
  const otherKeys = keys.filter(key => key !== 'quiz-positions');
  const before = otherKeys.map(key => store.get(key));
  const reset = store.resetCurrent('quiz-positions');
  assert.deepEqual(otherKeys.map(key => store.get(key)), before);
  assert.equal(reset.hasActivity, false);
  assert.equal(reset.hasDraftData, false);
  assert.equal(reset.result, null);
  assert.deepEqual(reset.errors, []);
  store.setRowCount('quiz-positions', 10);
  assert.equal(store.get('quiz-positions').result, null);
  assert.deepEqual(store.get('quiz-positions').errors, []);
});

test('invalid inactive rows do not affect an active calculation but are validated when restored', () => {
  const store = createExamStore();
  store.setRowCount('quiz-positions', 10);
  store.setValue('quiz-positions', 9, 'corrections', '-1');
  store.setRowCount('quiz-positions', 3);
  assert.equal(store.get('quiz-positions').hasActivity, false);
  assert.equal(store.get('quiz-positions').hasDraftData, true);
  assert.deepEqual(store.get('quiz-positions').errors, []);
  assert.equal(store.calculate('quiz-positions'), null);
  store.setValue('quiz-positions', 0, 'word-openings', '0');
  assert.equal(store.get('quiz-positions').result.score, 100);
  store.setRowCount('quiz-positions', 10);
  assert.equal(store.getCopyText('quiz-positions'), null);
  assert.equal(store.get('quiz-positions').result, null);
  assert.equal(store.get('quiz-positions').errors[0].row, 9);
  assert.throws(() => store.calculate('quiz-positions'), ExamValidationError);
  store.resetCurrent('quiz-positions');
  assert.equal(store.get('quiz-positions').errors.length, 0);
});

test('invalid API mutations fail without changing an existing draft', () => {
  const store = createExamStore();
  const before = store.get('review-save');
  assert.throws(() => store.get('missing'), RangeError);
  assert.throws(() => store.setValue('review-save', -1, 'corrections', 1), RangeError);
  assert.throws(() => store.setValue('review-save', 3, 'corrections', 1), RangeError);
  assert.throws(() => store.setValue('review-save', 0, 'Meaning', 1), RangeError);
  for (const count of [0, 11, 1.5, '3']) assert.throws(() => store.setRowCount('quiz-positions', count), RangeError);
  assert.throws(() => store.setRowCount('review-save', 3), RangeError);
  assert.throws(() => store.setBonus('review-save', 0, true), RangeError);
  assert.throws(() => store.setBonus('consolidation', 2, true), RangeError);
  assert.deepEqual(store.get('review-save'), before);
  assert.throws(() => gradeFor('missing', 100), RangeError);
  assert.throws(() => gradeFor('review-save', NaN), RangeError);
});

test('deterministic broad arithmetic regression agrees with the original seven formulas', () => {
  let seed = 137;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed; };
  for (let iteration = 0; iteration < 140; iteration += 1) {
    const key = keys[iteration % keys.length];
    const current = EXAM_CONFIGS[key];
    const store = createExamStore();
    let originalDeductions = 0;
    for (let row = 0; row < current.rowCount; row += 1) {
      for (const item of current.fields) {
        const value = random() % 12;
        originalDeductions += value * item.weight;
        store.setValue(key, row, item.id, value);
      }
    }
    let bonus = 0;
    if (key === 'consolidation') {
      for (let index = 0; index < 2; index += 1) {
        const checked = Boolean(random() % 2);
        bonus += checked ? 0.5 : 0;
        store.setBonus(key, index, checked);
      }
    }
    const result = store.calculate(key);
    assert.ok(Math.abs(result.score - (100 - originalDeductions + bonus)) < 1e-9);
    assert.equal(result.scoreText, result.score.toFixed(1));
  }
});
