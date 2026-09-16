// Deliberately independent of the generated classic seed catalogue.
// House mixes are application recipes, not attributed to IBA.
export type AgentRecipe = {
  id: string; name: string; ingredients: { name: string; amount: number; unit: 'ml' }[];
  steps: string[]; tools: string[]; ice: boolean; tags: string[]; source: string;
};
const highball = (id: string, name: string, spirit: string, mixer: string, tags: string[]): AgentRecipe => ({
  id, name, ingredients: [{ name: spirit, amount: 30, unit: 'ml' }, { name: mixer, amount: 120, unit: 'ml' }],
  steps: ['杯中加满冰块。', `量取 30 ml ${spirit}倒入杯中。`, `加入 120 ml ${mixer}，用搅拌勺轻轻搅匀。`],
  tools: ['杯子', '量杯', '搅拌勺'], ice: true, tags, source: 'AlcheMix 家庭调饮配方（非经典标准配方）',
});
export const agentRecipes: AgentRecipe[] = [
  highball('house-vodka-soda', '伏特加苏打', '伏特加', '苏打水', ['清爽', '不甜']),
  highball('house-vodka-orange', '伏特加橙汁', '伏特加', '橙汁', ['果香', '甜']),
  highball('house-gin-tonic', '金酒汤力', '金酒', '汤力水', ['清爽', '苦']),
  highball('house-whisky-soda', '威士忌苏打', '威士忌', '苏打水', ['清爽', '不甜']),
  highball('house-rum-cola', '朗姆可乐', '白朗姆', '可乐', ['甜']),
  { id: 'negroni', name: '内格罗尼', ingredients: [
    { name: '金酒', amount: 30, unit: 'ml' }, { name: '金巴利', amount: 30, unit: 'ml' }, { name: '甜红味美思', amount: 30, unit: 'ml' },
  ], steps: ['冷杯中加入冰块。', '量取金酒、金巴利和甜红味美思各 30 ml，倒入杯中轻搅。'], tools: ['杯子', '量杯', '搅拌勺'], ice: true,
  tags: ['苦', '酒感强'], source: '知识库 classic-negroni：IBA 版本；橙片装饰可另备。' },
];
const aliases: Record<string, string> = { gin: '金酒', '金酒gin': '金酒', vodka: '伏特加', '伏特加vodka': '伏特加', whisky: '威士忌', whiskey: '威士忌', '苏打': '苏打水', 'sodawater': '苏打水', 'tonicwater': '汤力水', 'campari': '金巴利', '白朗姆酒': '白朗姆', '甜味美思': '甜红味美思', '甜味美思sweetvermouth': '甜红味美思', '金巴利campari': '金巴利' };
export function normalizeIngredient(value: string) { const key = value.trim().toLowerCase().replace(/\s+/g, ''); return aliases[key] ?? key; }
