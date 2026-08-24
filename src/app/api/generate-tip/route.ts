export async function POST(req: Request) {
  try {
    const body = await req.json();
    const problem = String(body.problem ?? '').trim();

    if (!problem) {
      return Response.json({ error: 'problem is required' }, { status: 400 });
    }

    const isTooSweet = problem.includes('甜');
    const isTooStrong = problem.includes('酒') || problem.includes('冲') || problem.includes('烈');
    const isTooSour = problem.includes('酸');

    return Response.json({
      title: `${problem} 怎么救`,
      content: isTooSweet
        ? '加入柠檬汁或苏打水，利用酸度和稀释降低糖感；如果有冰块，先加满冰再轻搅。'
        : isTooStrong
          ? '先加满冰块，再补充 3-4 倍无酒精 mixer，例如苏打水、汤力水或果汁，降低乙醇冲击。'
          : isTooSour
            ? '加入少量糖浆、蜂蜜水或甜型汽水，把酸度拉回 2-3 分区间。'
            : '优先用冰块和苏打水做物理稀释，再用少量柠檬或糖浆微调酸甜平衡。',
      icon: isTooStrong ? 'warning' : 'science',
    });
  } catch (error: any) {
    console.error('POST /api/generate-tip error', error);
    return Response.json({ error: 'Tip generation failed' }, { status: 500 });
  }
}
