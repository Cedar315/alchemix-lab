import nextEnv from '@next/env';
import {spawnSync} from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
const names=['DEEPSEEK_API_KEY','DEEPSEEK_API_URL','DEEPSEEK_MODEL','KNOWLEDGE_SEARCH_PROVIDER','DEEPSEEK_SEARCH_MODEL'];
for(const name of names)if(!process.env[name]?.trim())throw Error(`Missing ${name}`);
for(const name of names){
 const result=spawnSync('npx',['--yes','vercel','env','add',name,'production','--force','--yes',...(name.endsWith('_KEY')?['--sensitive']:['--no-sensitive'])],{input:process.env[name].trim(),encoding:'utf8'});
 // Do not print CLI output: it could echo a secret during an error.
 console.log(`${name}: ${result.status===0?'updated':'failed'}`);
 if(result.status!==0)process.exit(1);
}
