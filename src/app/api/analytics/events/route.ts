import prisma from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.eventName || !body?.page || !body?.action) {
      return Response.json({ error: "eventName, page and action are required" }, { status: 400 });
    }

    const event = await prisma.analyticsEvent.create({
      data: {
        eventName: String(body.eventName),
        page: String(body.page),
        action: String(body.action),
        target: body.target ? String(body.target) : null,
        recipeId: body.recipeId ? String(body.recipeId) : null,
        ingredientIds: body.ingredientIds ?? [],
        source: body.source ? String(body.source) : null,
        sessionId: body.sessionId ? String(body.sessionId) : null,
        metadata: body.metadata ?? {},
        createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      },
    });

    return Response.json({ ok: true, id: event.id.toString() });
  } catch (error) {
    console.error("POST /api/analytics/events error", error);
    return Response.json({ error: "Failed to save analytics event" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const events = await prisma.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return Response.json({
      events: events.map((event) => ({
        ...event,
        id: event.id.toString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/analytics/events error", error);
    return Response.json({ events: [], error: "Failed to read analytics events" }, { status: 500 });
  }
}
