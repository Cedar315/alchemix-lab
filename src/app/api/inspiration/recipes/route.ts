import { INSPIRATION_RECIPES } from '@/lib/data/inspiration-catalog';
import prisma from '@/lib/db/prisma';

const normalize = (value: string | null) => (value ?? '').trim().toLowerCase();
const json = (data: unknown) => new Response(JSON.stringify(data, (_, value) => (typeof value === 'bigint' ? value.toString() : value)), {
  headers: { 'Content-Type': 'application/json' },
});

const localRecipeMatches = (recipe: (typeof INSPIRATION_RECIPES)[number], query: string) => {
  if (!query) return true;
  const haystack = [
    recipe.nameCn,
    recipe.nameEn,
    recipe.description,
    recipe.baseSpirit,
    ...recipe.tags,
    ...recipe.ingredients.flatMap((item) => [item.nameCn, item.nameEn]),
  ].join(' ').toLowerCase();
  return haystack.includes(query);
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = normalize(searchParams.get('type'));
  const q = normalize(searchParams.get('q'));
  const tag = normalize(searchParams.get('tag'));
  const baseSpirit = normalize(searchParams.get('baseSpirit'));
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 80);

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        isPublished: true,
        ...(type ? { type } : {}),
        ...(baseSpirit ? { baseSpirit } : {}),
        ...(q
          ? {
              OR: [
                { nameCn: { contains: q, mode: 'insensitive' } },
                { nameEn: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { ingredients: { some: { ingredientNameCn: { contains: q, mode: 'insensitive' } } } },
                { ingredients: { some: { ingredientNameEn: { contains: q, mode: 'insensitive' } } } },
                { tags: { some: { tag: { nameCn: { contains: q, mode: 'insensitive' } } } } },
                { tags: { some: { tag: { nameEn: { contains: q, mode: 'insensitive' } } } } },
              ],
            }
          : {}),
        ...(tag
          ? {
              tags: {
                some: {
                  tag: {
                    OR: [
                      { nameCn: { contains: tag, mode: 'insensitive' } },
                      { nameEn: { contains: tag, mode: 'insensitive' } },
                      { slug: { contains: tag, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            }
          : {}),
      },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
      },
      orderBy: [
        { beginnerScore: 'desc' },
        { convenienceScore: 'desc' },
        { isPublished: 'desc' },
      ],
      take: limit,
    });

    if (recipes.length > 0) {
      return json({ source: 'database', recipes });
    }
  } catch (error) {
    console.error('GET /api/inspiration/recipes database fallback', error);
  }

  const local = INSPIRATION_RECIPES
    .filter((recipe) => !type || recipe.type === type)
    .filter((recipe) => !baseSpirit || recipe.baseSpirit === baseSpirit)
    .filter((recipe) => !tag || recipe.tags.some((item) => item.toLowerCase().includes(tag)))
    .filter((recipe) => localRecipeMatches(recipe, q))
    .sort((a, b) => b.beginnerScore - a.beginnerScore || b.convenienceScore - a.convenienceScore)
    .slice(0, limit);

  return json({ source: 'local_seed_fallback', recipes: local });
}
