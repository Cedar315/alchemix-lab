import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const logs = await prisma.drinkLog.findMany({
    where: { userId: LOCAL_USER_ID, drinkDate: { gte: start, lt: end } },
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

  return NextResponse.json({ success: true, days: Object.values(days) });
}
