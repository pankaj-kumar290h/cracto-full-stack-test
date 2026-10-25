import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, releaseStatus } from '../shared/release.js';
import { validateName, validateDate, validateInfo } from '../server/domain.js';

test('status follows checklist completion, including unchecking a completed release', () => {
  const all = STEPS.map((step) => step.id);
  assert.equal(releaseStatus([]), 'planned');
  assert.equal(releaseStatus([all[0]]), 'ongoing');
  assert.equal(releaseStatus(all), 'done');
  assert.equal(releaseStatus(all.slice(1)), 'ongoing');
});

test('release input requires a name and valid date; additional information is optional', () => {
  assert.equal(validateName('  Release 1  '), 'Release 1');
  assert.throws(() => validateName('   '));
  assert.equal(validateDate('2026-11-01T12:00:00Z'), '2026-11-01T12:00:00.000Z');
  assert.throws(() => validateDate('not-a-date'));
  assert.throws(() => validateDate('2026-02-30T12:00:00Z'));
  assert.equal(validateInfo(undefined), null);
  assert.equal(validateInfo('  '), null);
});
