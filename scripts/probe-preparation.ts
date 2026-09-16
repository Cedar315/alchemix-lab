import nextEnv from '@next/env';nextEnv.loadEnvConfig(process.cwd(),true);
const {preparationModel}=await import('../src/lib/agent/preparation-provider');
for(const question of ['300','算了，不做了'])try{console.log(JSON.stringify({question,...await preparationModel('intent',{question,context:'',history:[]},AbortSignal.timeout(30000))}));}catch(e){console.log({error:e instanceof Error?e.name:'error'});}
