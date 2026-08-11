import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

function serialize(log: any) {
  return log ? { ...log, id: log.id.toString(), drinkDate: log.drinkDate.toISOString().split('T')[0] } : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipeId = searchParams.get('recipe_id') ?? searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ has_logged: false, drink_log: null });

  const log = await prisma.drinkLog.findFirst({
    where: { userId: LOCAL_USER_ID, recipeId },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ has_logged: Boolean(log), drink_log: serialize(log) });
}
