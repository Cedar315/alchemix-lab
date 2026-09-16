import nextEnv from '@next/env';
import { spawnSync } from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd(),true);
const action=process.argv[2];
if (!['status','deploy'].includes(action)) throw Error('Use status or deploy');
const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate',action!],{env:process.env,encoding:'utf8'});
// Prisma output may include host names; retain migration progress but redact connection lines.
for (const line of ((result.stdout||'')+(result.stderr||'')).split('\n')) {
  if (!/Datasource|postgres(?:ql)?:\/\/|DATABASE_URL|DIRECT_URL/.test(line)) console.log(line);
}
process.exitCode=result.status??1;
