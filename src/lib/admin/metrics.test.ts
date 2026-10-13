import test from 'node:test';
import assert from 'node:assert/strict';
import { dateWindow,rate,scrub,isInternalIdentity } from './metrics';
test('unknown feedback never becomes zero percent',()=>{assert.equal(rate(0,0),null);assert.equal(rate(1,3),33.3);});
test('rolling comparisons have equal duration and today starts at UTC midnight',()=>{const now=new Date('2026-09-22T12:00:00Z');const w=dateWindow(new URLSearchParams(),now);assert.equal(+w.end-+w.start,+w.start-+w.previous);assert.equal(dateWindow(new URLSearchParams('days=1'),now).start.toISOString(),'2026-09-22T00:00:00.000Z');});
test('invalid, reversed and oversized periods are rejected',()=>{for(const q of ['start=no&end=bad','start=2026-09-22&end=2026-09-20','start=2020-01-01&end=2026-09-22'])assert.throws(()=>dateWindow(new URLSearchParams(q)));});
test('nested credentials, reasoning and identifying text are removed',()=>{const x=scrub({question:'hello a@example.com 13812345678 Bearer secret',thinking:'private',nested:{apiKey:'secret',url:'https://u:p@example.com/path?token=secret'}}) as any;assert.equal(x.thinking,undefined);assert.equal(x.nested.apiKey,undefined);assert.ok(!JSON.stringify(x).includes('secret'));assert.ok(!x.question.includes('example.com'));assert.equal(x.nested.url,'https://example.com/path');});
test('only trusted metadata or configured email classifies internal users',()=>{assert.equal(isInternalIdentity('regular@example.com',{role:'admin'}),true);assert.equal(isInternalIdentity('test@example.com',{is_test:true}),true);assert.equal(isInternalIdentity('regular@example.com',{}),false);});
