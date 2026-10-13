import test from 'node:test';
import assert from 'node:assert/strict';
import { companionInput, type CompanionInput } from './companion-contract';
import { runCompanion } from './companion';
import { resolveBeforeL3, resolveL1, resolveL2 } from './intent-funnel';
import { companionRoutingToolDefinitions, decisionFromToolCalls } from './companion-tools';
import { recipeContext } from './workflow-catalog';

function input(question: string, extra: Partial<CompanionInput> = {}) {
    return companionInput.parse({
        version: 2, taskId: crypto.randomUUID(), contextVersion: 0, question,
        page: recipeContext('classic', 'margarita'), history: [], pending: null, ...extra,
    });
}

test('L1 priority routes faults before material exploration and cancellation before everything', () => {
    const fault = resolveL1(input('我已经把金酒和养乐多混好了，为什么分层？'));
    assert.equal(fault?.layer, 'L1');
    assert.equal(fault?.rule, 'actual_problem');
    assert.equal(fault?.decision.intent, 'troubleshoot');

    const cancelled = resolveBeforeL3(input('取消', {
        pending: { kind: 'troubleshoot', stage: 'steps', question: '为什么分层', actualMaterials: '金酒和养乐多', actualSteps: '' },
    }));
    assert.equal(cancelled?.rule, 'cancel');
    assert.equal(cancelled?.decision.dialogueAct, 'cancel');
});

test('L1 keeps recipe search distinct from flavor exploration', () => {
    const recipe = resolveL1(input('我有伏特加和橙汁，能做什么酒？'));
    assert.equal(recipe?.rule, 'available_materials_recipe_search');
    assert.equal(recipe?.decision.intent, 'recommend');
    assert.deepEqual(recipe?.decision.materials.sort(), ['伏特加', '橙汁'].sort());

    const flavor = resolveL1(input('伏特加和橙汁配起来是什么味道？'));
    assert.equal(flavor?.rule, 'material_flavor_exploration');
    assert.equal(flavor?.decision.intent, 'explore');
});

test('mixed workflow and knowledge requests reach planning and preserve both results', async () => {
    for (const [question, intent, knowledgeQuestion] of [
        ['我有伏特加和橙汁，能做什么酒？另外，苏打水可以放进摇酒壶里摇吗？', 'recommend', '苏打水可以放进摇酒壶里摇吗？'],
        ['打开玛格丽特的酒单，顺便解释一下干摇是什么意思。', 'named', '干摇是什么意思？'],
        ['伏特加和橙汁配起来是什么味道？同时解释一下干摇。', 'explore', '干摇是什么意思？'],
    ] as const) {
        assert.equal(resolveBeforeL3(input(question)), null);
        let modelCalls = 0;
        const queries: string[] = [];
        const result = await runCompanion(input(question), {
            model: async () => {
                modelCalls++;
                return { value: { intent, dialogueAct: 'new_task', materials: ['伏特加', '橙汁', '苏打水'], recipeName: '玛格丽特', category: 'any', capability: 'none', question: '', knowledgeQuestion: intent === 'named' ? '' : knowledgeQuestion }, model: 'fixture', usage: null };
            },
            search: async q => {
                queries.push(q);
                return { status: 'answered', claims: [{ text: '已核对的知识说明', evidenceIds: ['evidence'] }], citations: [{ id: 'evidence', title: '资料', sources: [{ title: '资料', url: 'https://example.com/evidence' }] }] };
            },
        });
        assert.equal(modelCalls, 1);
        assert.deepEqual(queries, [intent === 'named' ? '解释一下干摇是什么意思。' : knowledgeQuestion]);
        assert.equal(result.knowledge?.status, 'answered');
        assert.ok(result.actions.length || result.recipes.length || result.pending?.kind === 'category');
        assert.ok(!result.recipes.some(r => /苏打/.test(r.name) && !r.missing.length));
    }
});

test('L2 continues explicit pending state without asking the model to classify it', () => {
    const category = resolveL2(input('经典酒', { pending: { kind: 'category', materials: ['伏特加', '橙汁'] } }));
    assert.equal(category?.rule, 'category_answer');
    assert.equal(category?.decision.dialogueAct, 'answer');
    assert.equal(category?.decision.category, 'classic');

    const missing = resolveL2(input('青柠', {
        pending: { kind: 'substitution', stage: 'missing', question: '这杯材料不齐', missingMaterial: '', materials: [], materialsKnown: false },
    }));
    assert.equal(missing?.rule, 'continue_pending_consultation');
    assert.equal(missing?.decision.intent, 'change');
});

test('ambiguous requests fall through to L3', () => {
    assert.equal(resolveBeforeL3(input('这个可以吗？')), null);
});

test('tool decoding errors get one bounded repair, while transport failures are not retried', async () => {
    for (const failure of ['INVALID_TOOL_ARGUMENTS', 'EXPECTED_ONE_TOOL_CALL', 'UNKNOWN_TOOL_CALL', 'NETWORK_ERROR']) {
        let calls = 0;
        const result = await runCompanion(input('这个可以吗？'), {
            model: async state => {
                if (++calls === 1) throw Error(failure);
                assert.ok((state as { protocolErrors?: unknown }).protocolErrors);
                return { value: { intent: 'unclear', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any', capability: 'none', question: '你指哪一种材料？', knowledgeQuestion: '' }, model: 'fixture', usage: null };
            },
            search: async () => { throw Error('must not search'); },
        });
        assert.equal(calls, failure === 'NETWORK_ERROR' ? 1 : 2);
        assert.equal(result.status, failure === 'NETWORK_ERROR' ? 'unavailable' : 'needs_info');
    }
    let calls = 0;
    const result = await runCompanion(input('这个可以吗？'), {
        model: async () => { calls++; throw Error('INVALID_TOOL_ARGUMENTS'); },
        search: async () => { throw Error('must not search'); },
    });
    assert.equal(calls, 2);
    assert.equal(result.status, 'unavailable');
});

test('L1 handles explicit current-recipe navigation', () => {
    const steps = resolveL1(input('制作步骤在哪里？'));
    assert.equal(steps?.rule, 'current_recipe_details');
    assert.equal(steps?.decision.capability, 'recipe');
});

test('LangChain tool schemas become provider tools and validated decisions', () => {
    assert.ok(companionRoutingToolDefinitions.length >= 8);
    assert.ok(companionRoutingToolDefinitions.every(item => item.type === 'function' && item.function.name));
    const decision = decisionFromToolCalls([{
        id: 'call_1', type: 'function', function: {
            name: 'change_recipe',
            arguments: JSON.stringify({
                dialogue_act: 'correction', materials: ['柠檬'], knowledge_question: '青柠可否换成柠檬',
                facts: { missing_material: '青柠', available_materials_known: true },
            }),
        },
    }]);
    assert.equal(decision.intent, 'change');
    assert.equal(decision.dialogueAct, 'correction');
    assert.equal(decision.facts?.missingMaterial, '青柠');
    assert.throws(() => decisionFromToolCalls([]), /EXPECTED_ONE_TOOL_CALL/);
    assert.throws(() => decisionFromToolCalls([{ name: 'delete_everything', args: {} }]), /UNKNOWN_TOOL_CALL/);
});

test('the companion skips the model for L1/L2 and records L3 fallback', async () => {
    let models = 0;
    const dependencies = {
        model: async () => {
            models++;
            return {
                value: { intent: 'unclear', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any', capability: 'none', question: '你具体指什么？', knowledgeQuestion: '' },
                model: 'fixture', usage: null,
            };
        },
        search: async () => ({ status: 'no_evidence', claims: [], citations: [] }),
    };
    const l1 = await runCompanion(input('打开玛格丽特酒单'), dependencies);
    assert.equal(models, 0);
    assert.equal(l1.trace.find(item => item.tool === 'route_layer')?.status, 'L1:named_recipe');

    const l2 = await runCompanion(input('经典酒', { pending: { kind: 'category', materials: ['伏特加', '橙汁'] } }), dependencies);
    assert.equal(models, 0);
    assert.equal(l2.trace.find(item => item.tool === 'route_layer')?.status, 'L2:category_answer');

    const l3 = await runCompanion(input('这个可以吗？'), dependencies);
    assert.equal(models, 1);
    assert.equal(l3.trace.find(item => item.tool === 'route_layer')?.status, 'L3:langchain_tool_call');
});
