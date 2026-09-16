// Retired placeholder endpoint. No active application callers remain.
export async function POST() {
  return Response.json({ error: '此旧接口已停用，请使用调酒问答或材料助手。', replacement: '/ask' }, { status: 410 });
}
