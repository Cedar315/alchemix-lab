import { deepseekSearch } from '../knowledge/review/deepseek-search';
import { sourceSchema } from '../knowledge/review/contract';
import { lookupRequest, lookupResponse } from './lookup-contract';

export async function findIngredientSources(query: string, signal: AbortSignal, search = deepseekSearch) {
  const input = lookupRequest.parse({ query });
  const results = await search(input.query, [], signal, 'ingredient');
  const normalize = (text: string) => text.toLowerCase().replace(/[\s\p{P}]/gu, '');
  const term = normalize(input.query);
  const seen = new Set<string>();
  const sources = results.flatMap(result => {
    const source = sourceSchema.safeParse({ title: result.title.slice(0, 300), url: result.url });
    if (!source.success || !term || !normalize(result.title + result.content).includes(term) || result.content.trim().length < 20 || seen.has(result.url)) return [];
    seen.add(result.url);
    return [{ ...source.data, excerpt: result.content.slice(0, 1800) }];
  }).slice(0, 5);
  return lookupResponse.parse({ success: true, status: sources.length ? 'found' : 'no_results', query: input.query, sources });
}
