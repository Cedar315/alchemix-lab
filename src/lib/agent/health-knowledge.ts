import seed from '../knowledge/dietary-knowledge.json';
import { documentSchema } from '../knowledge/rag/core';

const knowledgeById = new Map(seed.entries.map(entry => {
  const document = documentSchema.parse(entry);
  return [document.id, document] as const;
}));

export function healthKnowledgeFor(question: string) {
  if (!/能喝|可以喝|能不能喝|适合喝|有乳糖|安全吗|能饮用/.test(question)) return null;
  const id = /牛奶过敏|奶类过敏|乳制品过敏|奶蛋白过敏/.test(question)
    ? 'milk-allergy-cocktail'
    : /乳糖不耐受|不能喝乳糖/.test(question)
      ? 'lactose-intolerance-cocktail'
      : /怀孕|孕妇|孕期|备孕/.test(question)
        ? 'pregnancy-alcohol-cocktail'
        : null;
  return id ? knowledgeById.get(id) ?? null : null;
}
