import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getOrCreateSessionUser, sessionResponse } from '@/lib/auth/session';

function serialize(log: any) {
  return {
    ...log,
    id: log.id.toString(),
    drinkDate: log.drinkDate.toISOString().split('T')[0],
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getOrCreateSessionUser(request);
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 });

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const logs = await prisma.drinkLog.findMany({
    where: { userId: session.userId, drinkDate: { gte: start, lt: end } },
    orderBy: { createdAt: 'desc' },
  });

  return sessionResponse(NextResponse.json({ success: true, drink_logs: logs.map(serialize) }), session);
}
