import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getOrCreateSessionUser, sessionResponse } from '@/lib/auth/session';

export async function GET(request: Request) {
  const session = await getOrCreateSessionUser(request);
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const logs = await prisma.drinkLog.findMany({
    where: { userId: session.userId, drinkDate: { gte: start, lt: end } },
  });

  const days = logs.reduce<Record<string, any>>((acc, log) => {
    const key = log.drinkDate.toISOString().split('T')[0];
    const current = acc[key] ?? { date: key, count: 0, hasHighRating: false, hasFavorite: false, hasStarred: false, maxRating: 0 };
    current.count += 1;
    current.hasHighRating ||= log.rating >= 4.5;
    current.hasFavorite ||= log.isFavorite;
    current.hasStarred ||= log.isStarred;
    current.maxRating = Math.max(current.maxRating, log.rating);
    acc[key] = current;
    return acc;
  }, {});

  return sessionResponse(NextResponse.json({ success: true, days: Object.values(days) }), session);
}
