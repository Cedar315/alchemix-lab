import test from 'node:test';
import assert from 'node:assert/strict';
import { clearTaste, defaultTaste, parseTaste, rankByTaste, resetRecommendations } from './taste';
import { emptyAnswers, matchDrinks, type GuideDrink } from '../recommendations/beginner';
import type { DrinkLog } from '../../types';
const now = Date.parse('2026-10-15T00:00:00Z');
const drink = (id: string, extra: Partial<GuideDrink> = {}): GuideDrink => ({ id, nameZh: id, nameEn: id, description: '', imageUrl: '', ingredients: ['苏打水'], tags: [], href: '/' + id, tastes: ['fresh'], strength: 'light', avoid: [], shaker: false, kind: 'easy', ...extra });
const plain = drink('plain'), sweet = drink('sweet', { avoid: ['sweet'], tastes: ['fruit'], strength: 'strong' });
const logs = [{ recipeId: 'sweet', recipeName: 'sweet', rating: 5, createdAt: new Date(now - 86400000).toISOString() }] as DrinkLog[];
test('manual taste changes ranking without modifying recipe or eligibility', () => {
  const pool = [plain, sweet];
  assert.equal(rankByTaste(pool, { ...defaultTaste, sweetness: 'high' }, [], emptyAnswers)[0].id, 'sweet');
  assert.deepEqual(pool, [plain, sweet]);
  const answers = { ...emptyAnswers, strength: 'light', avoid: ['sweet'] };
  assert.deepEqual(rankByTaste(matchDrinks(pool, answers), { ...defaultTaste, sweetness: 'high', strength: 'high' }, logs, answers), [plain]);
});
test('history opt out, reset cutoff, and age prevent old records affecting recommendations', () => {
  const pool = [plain, sweet], enabled = { ...defaultTaste, useHistory: true };
  assert.equal(rankByTaste(pool, enabled, logs, emptyAnswers, now)[0].id, 'sweet');
  assert.equal(rankByTaste(pool, defaultTaste, logs, emptyAnswers, now)[0].id, 'plain');
  assert.equal(rankByTaste(pool, resetRecommendations(enabled, now), logs, emptyAnswers, now)[0].id, 'plain');
  assert.equal(rankByTaste(pool, enabled, logs, emptyAnswers, now + 91 * 86400000)[0].id, 'plain');
  assert.equal(logs.length, 1);
});
test('clear taste keeps history setting; full reset clears taste and ignores earlier history', () => {
  const saved = { ...defaultTaste, sweetness: 'high' as const, flavors: ['果香'], useHistory: true };
  assert.deepEqual(clearTaste(saved), { ...defaultTaste, useHistory: true });
  const reset = resetRecommendations(clearTaste(saved), now);
  assert.equal(reset.historySince, now);
  assert.equal(reset.sweetness, 'any');
  assert.equal(reset.revision, now);
});
test('invalid stored settings fall back safely', () => {
  assert.deepEqual(parseTaste({ sweetness: 'bad', flavors: ['果香', '果香', 'unknown'], useHistory: 'true', historySince: -2 }), { ...defaultTaste, flavors: ['果香'] });
});
