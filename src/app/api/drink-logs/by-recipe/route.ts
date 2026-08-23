import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getOrCreateSessionUser, sessionResponse } from '@/lib/auth/session';

function serialize(log: any) {
  return log ? { ...log, id: log.id.toString(), drinkDate: log.drinkDate.toISOString().split('T')[0] } : null;
}

export async function GET(request: Request) {
  const session = await getOrCreateSessionUser(request);
  const { searchParams } = new URL(request.url);
  const recipeId = searchParams.get('recipe_id') ?? searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ has_logged: false, drink_log: null });

  const log = await prisma.drinkLog.findFirst({
    where: { userId: session.userId, recipeId },
    orderBy: { updatedAt: 'desc' },
  });

  return sessionResponse(NextResponse.json({ has_logged: Boolean(log), drink_log: serialize(log) }), session);
}
