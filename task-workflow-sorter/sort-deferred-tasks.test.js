const test = require('node:test');
const assert = require('node:assert/strict');
const { moveDeferredTasks } = require('./sort-deferred-tasks');

test('moves deferred tasks to the bottom of their own list and keeps children attached', () => {
  const source = [
    '- [>] Later',
    '  - [ ] Child remains with Later',
    '- [ ] First',
    '- [>] Also later',
    '- [ ] Last active',
  ].join('\n');
  const expected = [
    '- [ ] First',
    '- [ ] Last active',
    '- [>] Later',
    '  - [ ] Child remains with Later',
    '- [>] Also later',
  ].join('\n');
  assert.equal(moveDeferredTasks(source), expected);
});

test('does not move deferred tasks across separate lists or code fences', () => {
  const source = [
    '- [>] Defer',
    '- [ ] Active',
    '',
    'Paragraph',
    '',
    '- [>] Other list',
    '- [ ] Active there',
    '',
    '```md',
    '- [>] Example only',
    '- [ ] Example active',
    '```',
  ].join('\n');
  const expected = [
    '- [ ] Active',
    '- [>] Defer',
    '',
    'Paragraph',
    '',
    '- [ ] Active there',
    '- [>] Other list',
    '',
    '```md',
    '- [>] Example only',
    '- [ ] Example active',
    '```',
  ].join('\n');
  assert.equal(moveDeferredTasks(source), expected);
});
