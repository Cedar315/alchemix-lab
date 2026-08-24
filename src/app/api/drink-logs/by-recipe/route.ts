import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { authErrorResponse, requireUser } from '@/lib/auth/current-user';

function serialize(log: any) {
  return log ? { ...log, id: log.id.toString(), drinkDate: log.drinkDate.toISOString().split('T')[0] } : null;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipe_id') ?? searchParams.get('recipeId');
    if (!recipeId) return NextResponse.json({ has_logged: false, drink_log: null });

  const log = await prisma.drinkLog.findFirst({
    where: { userId: user.id, recipeId },
    orderBy: { updatedAt: 'desc' },
  });

    return NextResponse.json({ has_logged: Boolean(log), drink_log: serialize(log) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ has_logged: false, drink_log: null, error: 'Failed to read drink log' }, { status: 500 });
  }
}
