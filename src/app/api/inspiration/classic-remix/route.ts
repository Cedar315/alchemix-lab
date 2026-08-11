import { INSPIRATION_RECIPES } from '@/lib/data/inspiration-catalog';
import prisma from '@/lib/db/prisma';

const normalize = (value: string | null) => (value ?? '').trim().toLowerCase();
const json = (data: unknown) => new Response(JSON.stringify(data, (_, value) => (typeof value === 'bigint' ? value.toString() : value)), {
  headers: { 'Content-Type': 'application/json' },
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classicSlug = normalize(searchParams.get('classic') ?? 'negroni');
  const selectedTags = (searchParams.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  try {
    const cocktail = await prisma.classicCocktail.findUnique({
      where: { slug: classicSlug },
    });

    if (cocktail) {
      const variants = await prisma.classicCocktailVariant.findMany({
        where: {
          cocktailId: cocktail.id,
          isPublished: true,
        },
        include: {
          ingredients: { orderBy: { sortOrder: 'asc' } },
          tags: { include: { tag: true } },
        },
      });

      const ranked = variants
        .map((variant) => {
          const names = variant.tags.map((item) => item.tag.nameCn);
          const matchCount = selectedTags.filter((tag) => names.includes(tag)).length;
          return { ...variant, matchCount };
        })
        .filter((variant) => selectedTags.length === 0 || variant.matchCount > 0)
        .sort((a, b) =>
          b.matchCount - a.matchCount ||
          Number(b.isPublished) - Number(a.isPublished) ||
          b.convenienceScore - a.convenienceScore ||
          b.beginnerScore - a.beginnerScore,
        )
        .slice(0, 3);

      if (ranked.length > 0) {
        return json({ source: 'database', classic: cocktail, variants: ranked });
      }
    }
  } catch (error) {
    console.error('GET /api/inspiration/classic-remix database fallback', error);
  }

  const tagSet = new Set(selectedTags);
  const local = INSPIRATION_RECIPES
    .filter((recipe) => recipe.type === 'classic_variant')
    .filter((recipe) => recipe.slug.startsWith(`variant-${classicSlug}-`))
    .map((recipe) => ({
      ...recipe,
      matchCount: recipe.tags.filter((tag) => tagSet.has(tag)).length,
    }))
    .filter((recipe) => selectedTags.length === 0 || recipe.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || b.convenienceScore - a.convenienceScore || b.beginnerScore - a.beginnerScore)
    .slice(0, 3);

  return json({ source: 'local_seed_fallback', classic: classicSlug, variants: local });
}
