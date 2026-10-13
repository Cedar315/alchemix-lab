import { audit } from '@/lib/admin/telemetry';
import { requireAdmin,authErrorResponse } from '@/lib/auth/current-user';
import { listCandidates,reviewCandidate,relatedSeedTitles } from '@/lib/knowledge/review/store';
import { reviewInput } from '@/lib/knowledge/review/contract';
import { RagError } from '@/lib/knowledge/rag/core';
export const runtime='nodejs';
export const maxDuration=60;
function failure(error:unknown) { return authErrorResponse(error)??Response.json({error:error instanceof RagError?error.message:'知识审核暂不可用，请检查迁移和服务配置。'},{status:error instanceof RagError?error.status:503}); }
export async function GET() {
  try { await requireAdmin();const candidates=await listCandidates();return Response.json({candidates:candidates.map(c=>({...c,related:relatedSeedTitles(c)}))},{headers:{'Cache-Control':'no-store'}}); } catch(e) {return failure(e);}
}
export async function POST(request:Request) {
  try {
    const {user}=await requireAdmin();
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin) return Response.json({error:'来源不匹配'},{status:403});
    if(!request.headers.get('content-type')?.includes('application/json')) return Response.json({error:'请使用 JSON'},{status:415});
    const raw=await request.text();if(raw.length>24000)return Response.json({error:'内容过长'},{status:413});
    let body:unknown;try {body=JSON.parse(raw);}catch{return Response.json({error:'JSON 格式不正确'},{status:400});}
    const parsed=reviewInput.safeParse(body);if(!parsed.success)return Response.json({error:'请检查内容、来源链接和操作参数'},{status:400});
    await audit(user.id,'attempt_knowledge_'+parsed.data.action,parsed.data.id);
    return Response.json(await reviewCandidate(parsed.data,user.id),{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return failure(e);}
}
