import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { authErrorResponse, requireUser } from '@/lib/auth/current-user';
import { z } from 'zod';

const drinkLogSchema = z.object({
  recipe_id: z.string().max(200).optional().nullable(),
  recipeId: z.string().max(200).optional().nullable(),
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

export async function POST(request: Request) {
  try {
    const body = drinkLogSchema.parse(await request.json());
    const { user } = await requireUser();

    const log = await prisma.drinkLog.create({
      data: {
        userId: user.id,
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
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid drink log' : 'Failed to create drink log' }, { status });
  }
}

export async function GET() {
  try {
    const { user } = await requireUser();
    const logs = await prisma.drinkLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 500 });
    return NextResponse.json({ success: true, drink_logs: logs.map(serialize) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ success: false, error: 'Failed to read drink logs' }, { status: 500 });
  }
}
