import { authErrorResponse, requireUser } from '@/lib/auth/current-user';
import { acquireBudget, releaseBudget, BudgetError } from '@/lib/ai/request-budget';
import { lookupRequest } from '@/lib/ingredients/lookup-contract';
import { findIngredientSources } from '@/lib/ingredients/web-lookup';
export const runtime = 'nodejs';
export const maxDuration = 40;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  let acquired = false;
  try {
    const { user } = await requireUser();
    const raw = await req.text();
    if (raw.length > 2000) return Response.json({ error: '查询内容过长' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: '查询格式不正确' }, { status: 400 }); }
    const parsed = lookupRequest.safeParse(body);
    if (!parsed.success) return Response.json({ error: '请输入1–100字的饮料名称，可带上品牌和口味' }, { status: 400 });
    if (!process.env.DEEPSEEK_API_KEY) return Response.json({ error: '联网搜索尚未配置，可以先按包装配料表补全' }, { status: 503 });
    await acquireBudget(user.id, requestId);
    acquired = true;
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(30000)]);
    const result = await findIngredientSources(parsed.data.query, signal);
    return Response.json({ ...result, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof BudgetError) return Response.json({ error: '查询较频繁或已有请求处理中，请稍后重试' }, { status: 429 });
    console.warn(JSON.stringify({ event: 'ingredient_lookup_failed', requestId }));
    return Response.json({ error: '这次联网查询没有完成，请重试或按包装配料表补全', requestId }, { status: 502 });
  } finally {
    if (acquired) await releaseBudget(requestId).catch(() => console.warn(JSON.stringify({ event: 'ingredient_lookup_release_failed', requestId })));
  }
}
