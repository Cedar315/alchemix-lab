import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getOrCreateSessionUser, sessionResponse } from '@/lib/auth/session';
import { z } from 'zod';

const updateSchema = z.object({
  recipe_name: z.string().max(200).optional(),
  recipeName: z.string().max(200).optional(),
  recipe_snapshot: z.any().optional(),
  recipeSnapshot: z.any().optional(),
  drink_date: z.string().max(30).optional(),
  drink_time: z.string().max(20).optional().nullable(),
  drinkTime: z.string().max(20).optional().nullable(),
  rating: z.coerce.number().min(0).max(5).optional(),
  taste_scores: z.any().optional(),
  tasteScores: z.any().optional(),
  note: z.string().max(5000).optional().nullable(),
  comment: z.string().max(5000).optional().nullable(),
  is_finished: z.boolean().optional(),
  isFinished: z.boolean().optional(),
  is_favorite: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  mood_tags: z.array(z.string().max(50)).max(30).optional(),
  moodTags: z.array(z.string().max(50)).max(30).optional(),
  image_url: z.string().max(2048).optional().nullable(),
  imageUrl: z.string().max(2048).optional().nullable(),
  source_page: z.string().max(200).optional().nullable(),
  sourcePage: z.string().max(200).optional().nullable(),
});

function serialize(log: any) {
  return {
    ...log,
    id: log.id?.toString?.() ?? log.id,
    drinkDate: log.drinkDate?.toISOString?.().split('T')[0] ?? log.drinkDate,
    createdAt: log.createdAt?.toISOString?.() ?? log.createdAt,
    updatedAt: log.updatedAt?.toISOString?.() ?? log.updatedAt,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = updateSchema.parse(await request.json());
    const session = await getOrCreateSessionUser(request);
    const { id: rawId } = await params;
    const id = BigInt(rawId);
    const update = await prisma.drinkLog.updateMany({
      where: { id, userId: session.userId },
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

    if (update.count === 0) {
      return sessionResponse(NextResponse.json({ success: false, error: 'Drink log not found' }, { status: 404 }), session);
    }
    const log = await prisma.drinkLog.findUniqueOrThrow({ where: { id } });

    return sessionResponse(NextResponse.json({ success: true, drink_log: serialize(log) }), session);
  } catch (error) {
    console.error('PATCH /api/drink-logs/[id] error', error);
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid drink log' : 'Failed to update drink log' }, { status });
  }
}
