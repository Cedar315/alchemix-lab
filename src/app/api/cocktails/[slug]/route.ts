import prisma from '@/lib/db/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const cocktail = await prisma.cocktail.findUnique({
      where: { slug },
      include: {
        ingredients: {
          include: { ingredient: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!cocktail) {
      return Response.json({ success: false, error: 'cocktail not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      cocktail: {
        id: cocktail.id.toString(),
        nameZh: cocktail.nameZh,
        nameEn: cocktail.nameEn,
        slug: cocktail.slug,
        description: cocktail.description,
        originalFlavorDescription: cocktail.originalFlavorDescription,
        beginnerWarning: cocktail.beginnerWarning,
        bitterness: cocktail.bitterness,
        sweetness: cocktail.sweetness,
        acidity: cocktail.acidity,
        alcoholIntensity: cocktail.alcoholIntensity,
        freshness: cocktail.freshness,
        difficulty: cocktail.difficulty,
        isClassic: cocktail.isClassic,
        ingredients: cocktail.ingredients.map((item) => ({
          id: item.id.toString(),
          ingredientId: item.ingredientId.toString(),
          nameZh: item.ingredient.nameZh,
          nameEn: item.ingredient.nameEn,
          amountMl: item.amountMl,
          unit: item.unit,
          role: item.role,
          note: item.note,
          order: item.order,
        })),
      },
    });
  } catch (error: any) {
    console.error('GET /api/cocktails/[slug] error', error);
    return Response.json({ success: false, error: 'Cocktail lookup failed' }, { status: 500 });
  }
}
