import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

function serialize(log: any) {
  return {
    ...log,
    id: log.id?.toString?.() ?? log.id,
    drinkDate: log.drinkDate?.toISOString?.().split('T')[0] ?? log.drinkDate,
    createdAt: log.createdAt?.toISOString?.() ?? log.createdAt,
    updatedAt: log.updatedAt?.toISOString?.() ?? log.updatedAt,
  };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const log = await prisma.drinkLog.update({
      where: { id: BigInt(params.id) },
      data: {
        recipeName: body.recipe_name ?? body.recipeName,
        recipeSnapshot: body.recipe_snapshot ?? body.recipeSnapshot,
        drinkDate: body.drink_date ? new Date(body.drink_date) : undefined,
        drinkTime: body.drink_time ?? body.drinkTime,
        rating: body.rating !== undefined ? Number(body.rating) : undefined,
        tasteScores: body.taste_scores ?? body.tasteScores,
        note: body.note,
        comment: body.note ?? body.comment,
        isFinished: body.is_finished ?? body.isFinished,
        isFavorite: body.is_favorite ?? body.isFavorite,
        isStarred: body.is_starred ?? body.isStarred,
        moodTags: body.mood_tags ?? body.moodTags,
        imageUrl: body.image_url ?? body.imageUrl,
        sourcePage: body.source_page ?? body.sourcePage,
      },
    });

    return NextResponse.json({ success: true, drink_log: serialize(log) });
  } catch (error) {
    console.error('PATCH /api/drink-logs/[id] error', error);
    return NextResponse.json({ success: false, error: 'Failed to update drink log' }, { status: 500 });
  }
}
