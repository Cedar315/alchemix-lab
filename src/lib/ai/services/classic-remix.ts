import { callAIMock } from './ai-client';

export async function remixClassicMock(_input: any) {
  await callAIMock('modify-classic');
  return {
    name: '便利店野格罗尼',
    description: '经典内格罗尼的便利店改良版，草本与橙味并存，酒感较低。',
    ingredients: [
      { name: 'Jägermeister', amount: '20ml' },
      { name: 'Fanta Orange', amount: '100ml' },
      { name: 'Soda Water', amount: '50ml' },
      { name: 'Ice', amount: 'Full glass' },
    ],
    steps: ['加冰', '倒入野格', '加入芬达', '补充苏打', '轻搅即可'],
    flavor_profile: {
      sweetness_level: 4,
      sourness_level: 2,
      bitterness_level: 2,
      freshness_level: 4,
      alcohol_strength_level: 2,
    },
    estimated_abv: '4-6%',
    beginner_friendly_score: 5,
    caution_notes: ['适量饮用'],
  };
}

export default { remixClassicMock };
