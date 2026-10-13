import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTaskState, taskStateSchema } from './task-state';
test('unknown affects only awaited field and correction replaces that field',()=>{
 const a=mergeTaskState(undefined,'排障','lab:杯子','actualMaterials','烧酒、苏打水');
 const b=mergeTaskState({...a,awaitingField:'actualSteps'},a.goal,a.recipeKey,'actualSteps','不确定');
 assert.equal(b.facts.actualMaterials.value,'烧酒、苏打水');assert.equal(b.facts.actualSteps.certainty,'unknown');
 const c=mergeTaskState({...b,awaitingField:'actualMaterials'},a.goal,a.recipeKey,'actualMaterials','不是烧酒，是金酒');
 assert.equal(c.lastAct,'correction');assert.equal(c.facts.actualSteps.certainty,'unknown');
 assert.equal(c.facts.actualMaterials.value,'不是烧酒，是金酒');assert.ok(taskStateSchema.safeParse(c).success);
});
test('estimated values remain marked and recipe changes isolate facts',()=>{
 const a=mergeTaskState(undefined,'用量','lab:A','quantity','大概40毫升烧酒');
 assert.equal(a.facts.quantity.certainty,'estimated');
 const b=mergeTaskState(a,'新配方','lab:B','actualSteps','搅拌');
 assert.equal(b.goal,'新配方');assert.equal(b.facts.quantity,undefined);
});
