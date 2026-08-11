import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

async function ensureLocalUser() {
  return prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: {
      id: LOCAL_USER_ID,
      email: 'local-user@alchemix.lab',
      nickname: 'Local Mixologist',
    },
  });
}

function serialize(log: any) {
  return {
    ...log,
    id: log.id?.toString?.() ?? log.id,
    drinkDate: log.drinkDate?.toISOString?.().split('T')[0] ?? log.drinkDate,
    createdAt: log.createdAt?.toISOString?.() ?? log.createdAt,
    updatedAt: log.updatedAt?.toISOString?.() ?? log.updatedAt,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureLocalUser();

    const log = await prisma.drinkLog.create({
      data: {
        userId: body.user_id ?? LOCAL_USER_ID,
        recipeId: body.recipe_id ?? body.recipeId ?? null,
        recipeName: body.recipe_name ?? body.recipeName ?? '未命名配方',
        recipeSnapshot: body.recipe_snapshot ?? body.recipeSnapshot ?? {},
        drinkDate: body.drink_date ? new Date(body.drink_date) : new Date(),
        drinkTime: body.drink_time ?? body.drinkTime ?? null,
        rating: Number(body.rating ?? 0),
        tasteScores: body.taste_scores ?? body.tasteScores ?? {},
        note: body.note ?? null,
        comment: body.note ?? body.comment ?? null,
        isFinished: body.is_finished ?? body.isFinished ?? true,
        isFavorite: body.is_favorite ?? body.isFavorite ?? false,
        isStarred: body.is_starred ?? body.isStarred ?? false,
        moodTags: body.mood_tags ?? body.moodTags ?? [],
        imageUrl: body.image_url ?? body.imageUrl ?? null,
        sourcePage: body.source_page ?? body.sourcePage ?? null,
      },
    });

    return NextResponse.json({ success: true, drink_log: serialize(log) });
  } catch (error) {
    console.error('POST /api/drink-logs error', error);
    return NextResponse.json({ success: false, error: 'Failed to create drink log' }, { status: 500 });
  }
}
