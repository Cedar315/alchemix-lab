import prisma from '@/lib/db/prisma';
import { callMiniMaxJson } from '@/lib/ai/services/ai-client';
import { IngredientFactSchema } from '@/lib/ingredients/schema';

const systemPrompt = `You are AlcheMix Lab's beverage data assistant.
Return only JSON for one drink/ingredient. Use public web knowledge when available, but do not claim exact nutrition unless it is commonly available.
If data is uncertain, set confidence to "estimated" and explain in sourceNote.
Never write to any database.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query ?? '').trim();

    if (!query) {
      return Response.json({ success: false, error: 'query is required' }, { status: 400 });
    }

    const aiResult = await callMiniMaxJson<unknown>([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Look up this convenience-store drink or cocktail ingredient: ${query}

Return JSON with exactly these fields:
nameZh, nameEn, brand, aliases, type, category, subCategory, abv, sweetness, acidity, bitterness, carbonation, viscosity, sugarGPer100ml, caffeine, ingredients, flavorTags, suitableWith, avoidWith, recommendedVolumeMl, convenienceStoreAvailability, sourceType, confidence, isTemporary, sourceNote.

Rules:
- sourceType must be "ai_web_lookup"
- isTemporary must be true
- type must be alcohol, mixer, syrup, garnish, bitter, or other
- confidence must be high, medium, or estimated
- Do not invent precise sugar or ABV values; use null or estimated when uncertain.`,
      },
    ]);

    const parsed = IngredientFactSchema.parse({
      ...(aiResult as Record<string, unknown>),
      sourceType: 'ai_web_lookup',
      isTemporary: true,
    });

    const log = await prisma.ingredientLookupLog.create({
      data: {
        query,
        localMatched: false,
        aiUsed: true,
        aiResultJson: parsed,
        savedToIngredient: false,
      },
    });

    return Response.json({
      success: true,
      message: 'AI 联网生成 · 临时结果',
      lookupLogId: log.id.toString(),
      ingredient: parsed,
      caution: '请以实际包装配料表为准',
    });
  } catch (error: any) {
    console.error('POST /api/ingredients/ai-lookup error', error);
    return Response.json({ success: false, error: 'AI lookup failed' }, { status: 500 });
  }
}
