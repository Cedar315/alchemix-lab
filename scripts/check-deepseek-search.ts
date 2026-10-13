import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const {deepseekSearch}=await import('../src/lib/knowledge/review/deepseek-search');
const rows=await deepseekSearch('cocktail dilution too much alcohol',['diffordsguide.com','liquor.com'],AbortSignal.timeout(40000));
console.log(JSON.stringify(rows.map(r=>({title:r.title,url:r.url,contentLength:r.content.length})),null,2));
if(!rows.some(r=>r.content.length>40))process.exitCode=1;
