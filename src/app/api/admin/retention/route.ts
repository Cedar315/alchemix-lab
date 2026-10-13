import { timingSafeEqual } from 'node:crypto';
import { purgeDetails } from '@/lib/admin/telemetry';
export async function GET(request:Request){
 const expected=process.env.CRON_SECRET,actual=request.headers.get('authorization')||'';
 if(!expected||actual.length!==`Bearer ${expected}`.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(`Bearer ${expected}`)))return Response.json({error:'Unauthorized'},{status:401});
 await purgeDetails();return Response.json({ok:true});
}
