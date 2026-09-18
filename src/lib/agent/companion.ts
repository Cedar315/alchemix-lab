import { diagnostic, diagnosticText, timed } from './diagnostics';
import { clarificationPolicy } from "./clarification-policy";
import { knowledgeSchema, decisionSchema, type CompanionInput, type CompanionResult, type Decision } from './companion-contract';
import { findRecipe, recipeContext, namedRecipes, exactRecipeName, matchWorkflow, nearbyWorkflow, verifiedMaterials, mentionedMaterials, mentionedRecipe, similarRecipes, substitutionRecipes, alternativesForMissing, ingredientKey, sameIngredientFamily } from './workflow-catalog';
import { healthKnowledgeFor } from './health-knowledge';
import { actualProblem, alternativeAnswer, consultationDecision, resolveConsultation } from './consultation';
import type { KnowledgeAnswer } from './core';
export const companionPrompt = `你是按需调酒助手的意图识别器，只返回JSON，字段必须齐全：
{"intent":"operate","dialogueAct":"new_task","materials":[],"recipeName":"","category":"any","capability":"none","question":"","knowledgeQuestion":"","facts":{"missingMaterial":"","availableMaterialsKnown":false,"actualMaterials":"","actualSteps":""}}
intent只能选operate（找页面操作）、explore（材料搭配风味）、recommend（库内选酒）、named（指定酒单）、change（当前酒缺料替换）、guide（制作步骤）、troubleshoot（实际故障）、knowledge（知识）、out_of_scope、unclear。
dialogueAct=new_task|answer|correction|feedback|cancel；category=classic|convenience|any；capability=recipe|substitute|lab|finder|records|none。
无需用户选择帮助菜单。明确取消优先。结合上一轮追问解释是的/没有/数字，指代不明则unclear。纠正优先于旧事实。当前配方材料不是用户库存或实际已倒入量。仅提取用户明确说有的材料；不要把没有的材料或配方要求写入materials。询问材料搭配风味用explore并提取提到的材料。当前酒缺料但未提出替代材料时用change，先以酒库中的基酒或剩余饮料找其他真实酒单，不先问全部库存；提出具体替代材料时用change，先查口感和调制差异，再提供实验室动作。询问某种基酒还能搭配什么饮料、能做哪些其他酒时用recommend。操作说明用operate和已知capability；关于改良/便利店版本用substitute。知识问题无须选酒。
推荐有材料时提取全部已有材料；指定酒名提取原文名称；category只有用户明确表态才给类别。knowledgeQuestion为结合真实对话重述的完整知识问题；混合推荐和知识保留知识部分。缺关键事实时question只问一个必要问题，不问页面已有的信息。“这杯”默认指page中的当前酒；用户回答材料名称时接续上一轮缺料追问，不再问是哪杯。降低酒感、太甜怎么调整属于change或troubleshoot，不是找功能。不得生成URL、配方、精确比例或自由答案。
${clarificationPolicy}
悬浮助手回复规则：缺料先确认缺什么；用户已提出具体替代材料（如“没有椰奶，椰汁可以吗”）时直接检索口感、质地和调制注意事项，并给实验室按钮；不要求确认全部库存，也不把候选材料当作已拥有。未提出替代候选时先找同基酒或同饮料的其他酒单。实际故障先问实际使用的材料，再问操作过程，已经说明的不重复问；页面配方不是实际使用记录。facts.missingMaterial只提取缺少的材料；availableMaterialsKnown仅在用户明确说明手边材料（包括明确没有）时为true；actualMaterials和actualSteps必须是用户原话的摘录，无证据留空。pending是上一轮等待补充的事项，用户回答、纠正时继续；用户提出新问题时用new_task并放下旧事项。材料搭配风味只交实验室，用户明确要查酒时才recommend。混合知识与推荐先回答知识，但两件事都完成。`;
export type CompanionDeps = {
    model: (state: unknown, signal: AbortSignal) => Promise<{
        value: unknown;
        model: string;
        usage: unknown;
    }>;
    search: (q: string, c: string, s: AbortSignal) => Promise<KnowledgeAnswer>;
};
export async function runCompanion(input: CompanionInput, deps: CompanionDeps, signal = AbortSignal.timeout(45000)): Promise<CompanionResult> {
    const result: CompanionResult = { status: 'answered', message: '', clarification: '', actions: [], recipes: [], knowledge: null, pending: null, taskId: input.taskId, contextVersion: input.contextVersion, trace: [], model: '' };
    const clarify = (q: string) => { result.status = 'needs_info'; result.clarification = q; };
    try {
        signal.throwIfAborted();
        if (/^(算了|取消|先不改了|先不改|停止|不用了)[。！!]*$/.test(input.question.trim())) {
            result.status = 'cancelled';
            result.message = '好的，先不继续处理。';
            return result;
        }
        // Client page text is untrusted background. Recipe requirements are resolved from the shared catalogue.
        const page = input.page.kind === 'lab' ? input.page : recipeContext(input.page.kind, input.page.recipeId ?? '');
        if (input.page.kind !== 'lab' && !findRecipe(input.page.kind, input.page.recipeId ?? '')) {
            clarify('当前酒单已不可用，请返回配方页重新选择。');
            return result;
        }
        const healthKnowledge = healthKnowledgeFor(input.question);
        if (healthKnowledge) {
            result.message = page.ingredients.length ? `这杯酒库配方列出的材料是：${page.ingredients.map(item => item.name).join('、')}。` : '';
            result.knowledge = {
                status: 'answered',
                claims: [{ text: healthKnowledge.answer, evidenceIds: [healthKnowledge.id] }],
                citations: [{ id: healthKnowledge.id, title: healthKnowledge.title, sources: healthKnowledge.sources }],
            };
            if (healthKnowledge.id !== 'pregnancy-alcohol-cocktail' && page.ingredients.some(item => /奶|乳|养乐多|酸奶/.test(item.name)))
                result.clarification = '要判断这款饮料是否适合你，还需要核对实际产品的配料表和过敏原标注。你可以发来标签。';
            result.trace.push({ tool: 'seed_knowledge', status: healthKnowledge.id, elapsedMs: 0 });
            return result;
        }
        let d: Decision;
        const categoryPending = input.pending?.kind === 'category' ? input.pending : null;
        const alternativePending = input.pending?.kind === 'alternative' ? input.pending : null;
        const newMaterials = alternativePending ? alternativeAnswer(input.question) : [];
        const choice = categoryPending && /^(经典酒?|便利店(?:调酒)?)[。！!]*$/.test(input.question.trim());
        const consultation = consultationDecision({ ...input, page });
        if (choice) {
            d = { intent: categoryPending?.recipeName ? 'named' : 'recommend', dialogueAct: 'answer', materials: categoryPending!.materials, category: input.question.startsWith('经典') ? 'classic' : 'convenience', recipeName: categoryPending?.recipeName ?? '', capability: 'none', question: '', knowledgeQuestion: '' };
        }
        else if (alternativePending && newMaterials.length) {
            d = { intent: 'explore', dialogueAct: 'answer', materials: newMaterials, category: 'any', recipeName: '', capability: 'none', question: '', knowledgeQuestion: '' };
        }
        else if (consultation) {
            d = consultation;
        }
        else {
            const state = { ...input, page };
            let r = await timed('intent_model', () => deps.model(state, signal));
            let parsed = decisionSchema.safeParse(r.value);
            if (!parsed.success) {
                r = await deps.model({ ...state, protocolErrors: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) }, signal);
                parsed = decisionSchema.safeParse(r.value);
            }
            if (!parsed.success)
                throw Error('INVALID_PROTOCOL');
            d = parsed.data;
            result.model = r.model;
            result.usage = r.usage;
        }
        diagnostic('intent', { intent: d.intent, dialogueAct: d.dialogueAct, needsClarification: Boolean(d.question), knowledgeQuestion: diagnosticText(d.knowledgeQuestion) });
        if (categoryPending?.recipeName && d.dialogueAct === 'answer') { d.intent='named'; d.recipeName=categoryPending.recipeName; }
        // Guard explicit workflow requests against model routing drift; all entities still come from the same catalogue.
        const literalMaterials = mentionedMaterials(input.question);
        const literalRecipe = mentionedRecipe(input.question);
        if (d.dialogueAct !== 'cancel') {
            if (literalRecipe && /打开|查看|看看|酒单/.test(input.question) && !/怎么|如何|为什么|缺|没有|改良/.test(input.question)) {
                d.intent = 'named';
                d.recipeName = literalRecipe.nameZh;
                d.question = '';
            }
            else if (literalMaterials.length >= 2 && /什么味|什么风味|配起来|搭配.*(?:味|风)|混合.*味/.test(input.question) && !/已经|分层|失败|没有|不能|不可以/.test(input.question)) {
                d.intent = 'explore';
                d.materials = literalMaterials;
                d.question = '';
                if (!/另外|还想|同时|以及/.test(input.question))
                    d.knowledgeQuestion = '';
            }
            if (/我有|手边有|材料是|材料有/.test(input.question) && /能做什么|能调什么|可以做什么|能做哪|推荐.*酒/.test(input.question)) {
                d.intent = 'recommend'; d.question = '';
                if (!/另外|还想|同时|以及/.test(input.question)) d.knowledgeQuestion = '';
            }
            if (d.intent === 'recommend' && /我有|手边有|材料是|材料有/.test(input.question))
                d.materials = [...new Set([...d.materials, ...literalMaterials])];
            const preferenceText = [...input.history.filter(h => h.role === 'user').map(h => h.content), input.question].join(' ');
            if (!/经典|便利店/.test(preferenceText))
                d.category = 'any';
        }
        if (d.dialogueAct !== 'cancel' && actualProblem(input.question)) d.intent = 'troubleshoot';
        if (d.dialogueAct !== 'cancel' && /降低酒感|酒感太/.test(input.question)) { d.intent = 'change'; d.question = ''; }
        // A clear technique question in this assistant already has the cocktail domain.
        if (d.intent === 'knowledge' && /过滤|摇和|搅拌|稀释|摇酒壶/.test(input.question)
            && /调酒|鸡尾酒/.test(d.question) && /其他方面|其他领域|其他.*过滤/.test(d.question)) d.question = '';
        const consultationResult = d.dialogueAct === 'cancel' ? null : resolveConsultation(input, d, page);
        if (consultationResult) {
            if (d.intent === 'change' && page.kind === 'classic')
                result.actions.push({ label: '查看便利店改良选项', action: { kind: 'locate', target: 'substitute' } });
            if (consultationResult.clarification) {
                result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
                clarify(consultationResult.clarification);
                result.pending = consultationResult.pending;
                return result;
            }
            if (consultationResult.openAlternatives && consultationResult.missingMaterial) {
                const matches = alternativesForMissing(page, consultationResult.missingMaterial);
                result.trace.push({ tool: 'search_recipe_catalog', status: String(matches.length), elapsedMs: 0 });
                if (matches.length) {
                    result.recipes = matches.map(({ recipe, anchor }) => ({ id: recipe.id, name: recipe.nameZh, category: recipe.kind === 'classic' ? 'classic' : 'convenience', reason: `与当前酒共用${anchor}，这份酒单不需要${consultationResult.missingMaterial}。其他材料是否在手边，请打开酒单核对。`, missing: [], action: { kind: 'recipe', category: recipe.kind === 'classic' ? 'classic' : 'convenience', id: recipe.id } }));
                    result.message = `这杯缺少${consultationResult.missingMaterial}。可以先看看这些使用${matches[0].anchor}的其他酒单；如果想试手边的新材料，也可以告诉我材料名称。`;
                    result.pending = { kind: 'alternative', anchor: matches[0].anchor, missingMaterial: consultationResult.missingMaterial };
                    return result;
                }
            }
            if (consultationResult.proposedReplacement && consultationResult.missingMaterial) {
                const retained = page.ingredients.filter(i => !sameIngredientFamily(i.name, consultationResult.missingMaterial!)).map(i => ({ name: i.name }));
                if (retained.length)
                    result.actions.push({ label: '到实验室试调', action: { kind: 'prefill', materials: [...retained, { name: consultationResult.proposedReplacement }] } });
            }
            d.knowledgeQuestion = consultationResult.question;
            // Once the requested facts are known, discard generic repeated stock/material questions.
            if (/缺少哪|缺哪|手边|哪些材料|怎么调/.test(d.question)) d.question = '';
            if (consultationResult.kind === 'troubleshoot' && /多少|用量|加冰|冰块/.test(d.question)
                && !/多少|几毫升|精确|比例|容量|溢/.test(input.question + consultationResult.question)) d.question = '';
            if (consultationResult.kind === 'substitution' && !d.question) {
                const candidates = substitutionRecipes(page, consultationResult.missingMaterial!, consultationResult.materials);
                result.trace.push({ tool: 'search_recipe_catalog', status: String(candidates.length), elapsedMs: 0 });
                if (candidates.length && !/等味|等量|比例|多少/.test(input.question + consultationResult.question)) {
                    result.recipes = candidates;
                    result.message = `这杯缺少${consultationResult.missingMaterial}，你手边有${consultationResult.materials.join('、')}。酒库中有以下搭配参考，卡片列出了配方和风味；它们与原配方有区别，不能视为等味或等量替换。`;
                    result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
                    return result;
                }
            }
        }
        if (d.dialogueAct !== 'cancel' && d.question && ['unclear', 'knowledge', 'guide', 'change', 'troubleshoot'].includes(d.intent)) {
            result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
            clarify(d.question);
            return result;
        }
        const similarPage = (choice || d.dialogueAct === 'answer') && categoryPending?.similarTo ? categoryPending.similarTo : /类似|相似|这个口味|这种口味/.test(input.question) && /找|推荐|换|喜欢/.test(input.question) ? page : null;
        if (similarPage) {
            const matches = similarRecipes(similarPage);
            if (!matches.length) { result.status='no_results'; result.message='现有酒库里暂时没有找到可以说明相似依据的其他酒款。'; return result; }
            if (new Set(matches.map(m=>m.recipe.kind)).size > 1 && d.category === 'any') {
                clarify('想看经典酒还是便利店调酒？'); result.pending={kind:'category',materials:[],similarTo:similarPage}; return result;
            }
            result.recipes=matches.filter(m=>d.category==='any'||m.recipe.kind===d.category).slice(0,3).map(({recipe:r,reason})=>({id:r.id,name:r.nameZh,category:r.kind,reason,missing:[],action:{kind:'recipe',category:r.kind,id:r.id}}));
            result.message=`根据${similarPage.name}找到以下相近选择，材料是否齐全请在酒单中核对。`;
            return result;
        }
        signal.throwIfAborted();
        result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
        if (d.dialogueAct === 'cancel') {
            result.status = 'cancelled';
            result.message = '好的，先不继续处理。';
            return result;
        }
        const materials = choice ? verifiedMaterials(categoryPending!.materials, input) : verifiedMaterials(d.materials, input);
        const hasKnowledge = ['knowledge', 'guide', 'troubleshoot'].includes(d.intent) || Boolean(d.knowledgeQuestion);
        if (d.intent === 'out_of_scope') {
            result.status = 'out_of_scope';
            result.message = '我可以帮你找调酒功能、查看酒单，或解答制作问题。';
            return result;
        }
        if (d.intent === 'unclear') {
            clarify(d.question || '你指的是哪项材料、用量或操作？');
            return result;
        }
        if (d.intent === 'recommend') {
            if (!materials.length)
                clarify('你手边有哪些材料？');
            else {
                const completeMatches = matchWorkflow(materials);
                const matches = [...completeMatches, ...nearbyWorkflow(materials)];
                result.trace.push({ tool: 'match_workflow', status: String(matches.length), elapsedMs: 0 });
                const kinds = new Set((completeMatches.length ? completeMatches : matches).map(m => m.recipe.kind));
                if (kinds.size > 1 && d.category === 'any') {
                    clarify('想看经典酒还是便利店调酒？');
                    result.pending = { kind: 'category', materials };
                }
                else {
                    const selected = matches.filter(m => d.category === 'any' || (d.category === 'classic' ? m.recipe.kind === 'classic' : m.recipe.kind === 'easy')).slice(0, 3);
                    result.recipes = selected.map(({ recipe: r, missing }) => ({ id: r.id, name: r.nameZh, category: r.kind === 'classic' ? 'classic' : 'convenience', reason: missing.length ? `这是接近的酒单，还缺${missing.join('、')}；补齐后请按完整酒单确认用量。` : `已匹配你提供的材料；冰块和器具请在酒单中确认。`, missing, action: { kind: 'recipe', category: r.kind === 'classic' ? 'classic' : 'convenience', id: r.id } }));
                    if (selected.some(item => item.missing.length)) result.message = selected.some(item => !item.missing.length)
                        ? '先列出材料齐全的酒单，再列出还差一种材料的接近选择。'
                        : '目前没有材料齐全的酒单，下面是还差一种材料的接近选择。';
                    if (!selected.length) {
                        result.status = 'no_results';
                        result.message = '现有酒库里暂时没找到材料齐全且配方可核对的候选，可以去选酒页调整条件。';
                        result.actions.push({ label: '去选酒页', action: { kind: 'navigate', target: 'finder' } });
                    }
                }
            }
        }
        else if (d.intent === 'named') {
            const found = namedRecipes(d.recipeName).filter(r => d.category === 'any' || r.kind === d.category);
            if (found.length === 1) {
                const r = found[0];
                result.actions.push({ label: `查看${r.nameZh}`, action: { kind: 'recipe', category: r.kind, id: r.id } });
                result.message = exactRecipeName(d.recipeName, r) ? `找到${r.nameZh}的酒单。` : `你可能想找${r.nameZh}，可以打开酒单确认。`;
            }
            else if (found.length > 1) {
                if(new Set(found.map(r=>r.kind)).size>1) { clarify('你想查看哪一类酒单：经典酒还是便利店调酒？'); result.pending={kind:'category',materials:[],recipeName:d.recipeName}; }
                else result.recipes=found.slice(0,3).map(r=>({id:r.id,name:r.nameZh,category:r.kind,reason:'找到同名酒单，请查看配方确认版本。',missing:[],action:{kind:'recipe',category:r.kind,id:r.id}}));
            }
            else {
                result.status = 'no_results';
                result.message = '暂时没有找到这个酒名对应的酒单。';
            }
        }
        else if (d.intent === 'explore') {
            const experimentalMaterials = alternativePending && newMaterials.length ? [alternativePending.anchor, ...materials.filter(name => ingredientKey(name) !== ingredientKey(alternativePending.anchor))] : materials;
            if (!experimentalMaterials.length)
                clarify('你想探索哪几种材料的搭配？');
            else {
                result.message = `把${experimentalMaterials.join('和')}带到实验室查看搭配，用量由你确认。`;
                result.actions.push({ label: '到实验室试调', action: { kind: 'prefill', materials: experimentalMaterials.map(name => ({ name })) } });
            }
        }
        else if (d.intent === 'operate') {
            const cap = d.capability;
            if (cap === 'recipe' && page.kind !== 'lab' || cap === 'substitute' && page.kind === 'classic' || cap === 'lab' && page.kind === 'lab')
                result.actions.push({ label: cap === 'substitute' ? '查看便利店改良选项' : cap === 'recipe' ? '查看制作步骤' : '查看实验操作', action: { kind: 'locate', target: cap as 'recipe' | 'substitute' | 'lab' } });
            else if (cap === 'lab' || cap === 'finder' || cap === 'records')
                result.actions.push({ label: cap === 'lab' ? '打开实验室' : cap === 'records' ? '打开我的记录' : '去选酒页', action: { kind: 'navigate', target: cap } });
            else
                clarify('你想找到哪个功能？可以描述你准备进行的操作。');
        }
        else if (d.intent === 'change' && !d.question) {
            if (/降低酒感|酒感太/.test(input.question) && page.ingredients.length >= 2)
                result.actions.push({ label: '到实验室调整', action: { kind: 'prefill', materials: page.ingredients.map(i => ({ name: i.name })) } });
            if (page.kind === 'classic' && !result.actions.length)
                result.actions.push({ label: '查看便利店改良选项', action: { kind: 'locate', target: 'substitute' } });
        }
        if (d.question && !result.clarification && ['change', 'guide', 'troubleshoot'].includes(d.intent))
            clarify(d.question);
        const needSearch = hasKnowledge || (d.intent === 'change' && !d.question);
        if (needSearch && (!d.question || ['recommend', 'named', 'operate', 'explore'].includes(d.intent))) {
            const start = Date.now();
            try {
                const answer = await deps.search(d.knowledgeQuestion || input.question, JSON.stringify({ recipeRequirements: page, userConversation: input.history, currentQuestion: input.question, consultation: consultationResult, notice: '配方和编辑值不是实际倒入量；用户纠正优先。不支持的精确替代比例不可推导。' }), signal);
                signal.throwIfAborted();
                if (answer.claims.some(c => !c.evidenceIds.length || c.evidenceIds.some(id => !answer.citations.some(s => s.id === id))))
                    throw Error('UNSUPPORTED');
                result.knowledge = knowledgeSchema.parse(answer);
                result.trace.push({ tool: 'search_knowledge', status: answer.status, elapsedMs: Date.now() - start });
                if (!answer.claims.length && !result.message) {
                    result.message = consultationResult?.openAlternatives
                        ? '酒库和资料暂时没有找到合适的其他酒款，可以到选酒页调整条件。'
                        : d.intent === 'change'
                        ? '站内资料和本次联网查询没有找到适用于这些材料的可靠替代建议，暂时不能确定替代方式。'
                        : answer.status === 'no_evidence'
                            ? '我没有查到与这个问题直接相关的资料。你可以补充酒名、材料或当前操作，我再按具体情况查。'
                            : '查到的资料没有直接支持明确结论。你可以补充当前配方和实际情况，我再缩小范围。';
                }
                if (consultationResult?.openAlternatives && !result.recipes.length && !answer.claims.length)
                    result.actions.push({ label: '去选酒页', action: { kind: 'navigate', target: 'finder' } });
            }
            catch {
                result.trace.push({ tool: 'search_knowledge', status: 'error', elapsedMs: Date.now() - start });
                result.message = [result.message, '这次资料查询没有完成，你可以重试。'].filter(Boolean).join('\n');
                if (consultationResult) result.pending = input.pending;
                if (consultationResult || (!result.actions.length && !result.recipes.length))
                    result.status = signal.aborted ? 'timeout' : 'unavailable';
            }
        }
        if (result.knowledge?.claims.length && result.recipes.length && d.knowledgeQuestion && !consultationResult) result.message = '';
        if (!result.message && !result.clarification && !result.knowledge && !result.actions.length && !result.recipes.length)
            clarify('请说说当前这杯遇到的具体问题。');
        return result;
    }
    catch {
        return { ...result, pending: input.pending, status: signal.aborted ? 'timeout' : 'unavailable', message: '助手暂时未能完成处理，请稍后重试。' };
    }
}
