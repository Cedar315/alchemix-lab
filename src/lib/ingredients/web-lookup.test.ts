import test from 'node:test';
import assert from 'node:assert/strict';
import { findIngredientSources } from './web-lookup';

const hit = (title = '优酸乳产品资料', url = 'https://example.com/product') => ({
  type: 'web_search_result' as const, title, url,
  content: '这是用于测试的产品网页摘要，请根据实际包装核对品牌、口味及配料信息。',
});

test('product lookup preserves Chinese query and requests product search', async () => {
  const signal = new AbortController().signal;
  const result = await findIngredientSources(' 优酸乳 ', signal, async (query, domains, receivedSignal, purpose) => {
    assert.equal(query, '优酸乳');
    assert.deepEqual(domains, []);
    assert.equal(receivedSignal, signal);
    assert.equal(purpose, 'ingredient');
    return [hit()];
  });
  assert.equal(result.status, 'found');
  assert.equal(result.sources.length, 1);
  assert.equal('ingredient' in result, false);
});

test('unrelated brands, unsafe links and duplicates are excluded', async () => {
  const result = await findIngredientSources('优酸乳', new AbortController().signal, async () => [
    hit('养乐多'), hit('优酸乳', 'http://example.com/product'),
    hit('优酸乳', 'https://127.0.0.1/product'), hit(), hit(),
  ]);
  assert.deepEqual(result.sources.map(source => source.url), ['https://example.com/product']);
});

test('empty or unrelated search returns no_results, not a guessed product', async () => {
  for (const results of [[], [hit('养乐多')], [{ ...hit(), content: '' }]]) {
    const result = await findIngredientSources('优酸乳', new AbortController().signal, async () => results);
    assert.equal(result.status, 'no_results');
    assert.deepEqual(result.sources, []);
  }
});

test('invalid query never starts search; provider failures remain failures', async () => {
  let calls = 0;
  const search = async () => { calls++; throw Error('SEARCH_UNAVAILABLE'); };
  for (const query of ['', ' ', '名'.repeat(101)]) {
    await assert.rejects(findIngredientSources(query, new AbortController().signal, search));
  }
  assert.equal(calls, 0);
  await assert.rejects(findIngredientSources('优酸乳', new AbortController().signal, search), /SEARCH_UNAVAILABLE/);
});
