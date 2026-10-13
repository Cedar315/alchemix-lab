import { recordEvent } from '@/lib/admin/telemetry';
import { isInternalIdentity } from '@/lib/admin/metrics';
import { getCurrentUser } from '@/lib/auth/current-user';
import prisma from "@/lib/db/prisma";
import { authErrorResponse, requireAdmin } from "@/lib/auth/current-user";
import { z } from "zod";

const analyticsSchema = z.object({
  eventName: z.string().min(1).max(100),
  page: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  target: z.string().max(200).optional().nullable(),
  recipeId: z.string().max(200).optional().nullable(),
  ingredientIds: z.array(z.union([z.string().max(100), z.number()])).max(50).optional(),
  source: z.string().max(100).optional().nullable(),
  sessionId: z.string().max(150).optional().nullable(),
  metadata: z.record(z.any()).refine((value) => JSON.stringify(value).length <= 10_000, "metadata too large").optional(),
});

export async function POST(request: Request) {
  try {
    const raw=await request.text();
    if(raw.length>16000) return Response.json({error:'内容过长'},{status:413});
    const body = analyticsSchema.parse(JSON.parse(raw));
    const current=await getCurrentUser();
    if(['drink_recorded','ai_request'].includes(body.eventName))return Response.json({error:'保留事件名'},{status:400});
    await recordEvent({userId:current?.user.id||null,visitorId:body.sessionId||crypto.randomUUID(),internal:current?isInternalIdentity(current.user.email,current.authUser.app_metadata):false,name:body.eventName,page:body.page,source:(body.source||'').slice(0,100)});

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
        createdAt: new Date(),
      },
    });

    return Response.json({ ok: true, id: event.id.toString() });
  } catch (error) {
    console.error("POST /api/analytics/events error", error);
    return Response.json({ error: error instanceof z.ZodError ? "Invalid analytics event" : "Failed to save analytics event" }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
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
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ events: [], error: "Failed to read analytics events" }, { status: 500 });
  }
}
