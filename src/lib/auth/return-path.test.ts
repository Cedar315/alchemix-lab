import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from './return-path';
test('login only returns to same-site paths, including query strings',()=>{
  assert.equal(safeReturnPath('/ask?mode=agent'),'/ask?mode=agent');
  for (const path of ['//example.com','/\\example.com','/\n/example.com','https://example.com',null]) assert.equal(safeReturnPath(path),'/');
});
