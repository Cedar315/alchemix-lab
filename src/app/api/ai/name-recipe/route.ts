import { NameRecipeRequest } from '@/lib/ai/schemas/ai-request.schema';
import { callAIMock } from '@/lib/ai/services/ai-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = NameRecipeRequest.parse(body);

    // TODO: replace with AI creative naming module
    await callAIMock('name-recipe');

    const mock = {
      success: true,
      suggested_names: [
        { name: '江畔柠檬茶', tagline: '白酒与柠檬茶的东方邂逅，微涩解腻。' },
        { name: '小白的绿洲', tagline: '薄荷与维他茶碰撞，给传统白酒注入一丝夏日绿意。' },
      ],
    };

    return new Response(JSON.stringify(mock), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('name-recipe error', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
