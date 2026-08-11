export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query ?? '').trim();

    if (!query) {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const lower = query.toLowerCase();
    const useGin = query.includes('金酒') || lower.includes('gin');
    const useVodka = query.includes('伏特加') || lower.includes('vodka');
    const useSweet = query.includes('甜') || query.includes('果汁') || query.includes('雪碧');
    const spirit = useGin ? '金酒 Gin' : useVodka ? '伏特加 Vodka' : '金酒 Gin';
    const mixer = useSweet ? '雪碧 Sprite' : useGin ? '汤力水 Tonic' : '苏打水 Soda';

    return Response.json({
      text: `🔬 我会先按“低风险、便利店可买、容易入口”的原则处理。\n\n建议用 ${spirit} 做骨架，搭配 ${mixer}，加满冰块后轻搅。比例从 1:4 开始更适合新手；如果觉得酒感弱，再把基酒增加 5-10ml。\n\n这条回复来自本地 AlcheMix Lab 规则与数据库上下文，没有调用真实 OpenAI API。`,
      cocktails: [
        {
          id: `assistant-${Date.now()}`,
          chineseName: useSweet ? '清爽雪碧高球' : '经典实验高球',
          name: useSweet ? 'Sprite Lab Highball' : 'Classic Lab Highball',
          subtitle: '便利店友好配方',
          spirit,
          mixer,
          size: '180ml',
          rating: {
            sweet: useSweet ? 4 : 2,
            acid: 3,
            strength: useVodka || useGin ? 2 : 1,
          },
          comments: `${spirit} 提供酒体，${mixer} 负责稀释、气泡和入口平衡。`,
          tags: ['新手友好', '本地生成'],
        },
      ],
    });
  } catch (error: any) {
    console.error('POST /api/assistant error', error);
    return Response.json({ error: error?.message ?? 'Assistant failed' }, { status: 500 });
  }
}
