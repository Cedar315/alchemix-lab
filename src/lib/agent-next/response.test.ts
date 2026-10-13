import test from 'node:test';
import assert from 'node:assert/strict';
import { agentResponseSchema, validateLabAction, labPreview } from './response';

test('only user-mentioned materials enter the experiment; suggested extras cannot cite the whole question', () => {
  const { lab } = agentResponseSchema.parse({ message: '试配参考量', lab: { kind: 'prefill', materials: [
    { name: '金酒', amount: 30, source: '金酒' }, { name: '可乐', amount: 90, source: '可乐' },
    { name: '青柠汁', amount: 10, source: '金酒配可乐是什么味道' },
    { name: '西柚汽水', amount: 90, source: '西柚汽水' },
  ], assumptions: [] } });
  const result = validateLabAction(lab, ['金酒配可乐是什么味道']);
  assert.equal(result.kind, 'prefill');
  if (result.kind !== 'prefill') throw Error();
  assert.deepEqual(labPreview(result).materials, [{ name: '金酒', amount: 30 }, { name: '可乐', amount: 90 }]);
});
test('catalogue amounts remain absent, and recipe provenance must exist in this turn', () => {
  const lab = agentResponseSchema.parse({ message: '试配', lab: { kind: 'prefill', materials: [{ name: '金酒', amount: null, source: 'gin-tonic' }], assumptions: [] } }).lab;
  assert.deepEqual(validateLabAction(lab, []), { kind: 'none' });
  const verified = validateLabAction(lab, [], [{ recipeId: 'gin-tonic', ingredients: [{ name: '金酒' }] }]);
  if (verified.kind !== 'prefill') throw Error();
  assert.deepEqual(labPreview(verified).materials, [{ name: '金酒' }]);
});
test('a missing action or invalid quantity is a protocol error, not an empty lab link', () => {
  assert.equal(agentResponseSchema.safeParse({ message: '普通回复' }).success, false);
  assert.equal(agentResponseSchema.safeParse({ message: '取消', lab: { kind: 'none' } }).success, true);
  assert.equal(agentResponseSchema.safeParse({ message: '试配', lab: { kind: 'prefill', materials: [{ name: '金酒', amount: -1, source: '金酒' }], assumptions: [] } }).success, false);
});
