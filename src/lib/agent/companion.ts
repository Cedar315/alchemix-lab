import { parseRescueFollowup, rescueFollowupSchema, rescueFollowupPrompt, rescueReviewPrompt, removeRepeatedQuestion, respectRescueGoal, type RescueReply, type RescueTurn } from './rescue-followup';
import { mergeTaskState, startsNewTask, knownFacts, type TaskState } from './task-state';
import { diagnostic, diagnosticText, timed, diagnosticError } from './diagnostics';
import { clarificationPolicy } from "./clarification-policy";
import { knowledgeSchema, decisionSchema, type CompanionInput, type CompanionResult, type Decision } from './companion-contract';
import { findRecipe, recipeContext, namedRecipes, exactRecipeName, matchWorkflow, nearbyWorkflow, verifiedMaterials, mentionedMaterials, mentionedRecipe, similarRecipes, substitutionRecipes, alternativesForMissing, ingredientKey } from './workflow-catalog';
import { techniqueKnowledgeFor } from './technique-knowledge';
import { isRescueConversation } from './adjustment';
import { healthKnowledgeFor } from './health-knowledge';
import { actualProblem, alternativeAnswer, resolveConsultation, proposedReplacement, recipeMaterialMatches } from './consultation';
import { additionalKnowledgeRequest, hasAdditionalRequest, resolveBeforeL3 } from './intent-funnel';
import type { KnowledgeAnswer } from './core';
export const companionPrompt = `你是按需调酒助手的 L3 任务规划器。L1 高置信规则和 L2 对话状态均无法确定时才会调用你。根据任务选择且只调用一个提供的 LangChain 工具。
无需用户选择帮助菜单。明确取消优先。结合上一轮追问解释是的/没有/数字，指代不明则调用clarify_request。纠正优先于旧事实。当前配方材料不是用户库存或实际已倒入量。仅提取用户明确说有的材料；不要把没有的材料或配方要求写入materials。询问材料搭配风味调用explore_materials并提取提到的材料。当前酒缺料或替换调用change_recipe；询问某种基酒能做哪些其他酒调用find_recipes。找页面功能调用locate_feature；关于改良/便利店版本的capability用substitute。知识问题无须选酒。
推荐有材料时提取全部已有材料；指定酒名提取原文名称；category只有用户明确表态才给类别。knowledge_question为结合真实对话重述的完整知识问题；混合推荐和知识保留知识部分。只补足已有事实中的指代，不扩展用户问题，不添加用户未要求的品牌、配方、酒精数值或精确换算。缺关键事实时clarification只问一个必要问题，不问页面已有的信息。“这杯”默认指page中的当前酒；用户回答材料名称时接续上一轮缺料追问，不再问是哪杯。降低酒感属于change_recipe；用户已经调制后太甜属于troubleshoot_recipe，不是找功能。不得生成URL、配方、精确比例或自由答案。下方策略中的question对应工具参数clarification，facts字段在工具参数中使用snake_case。
${clarificationPolicy}
补救咨询（pending.kind=rescue 或倒多、加多等）：自主决定追问或查资料，没有固定字段顺序。pending.conversation保存用户原话与追问，按时间理解，明确纠正优先；不要将旧说法和纠正同时当作事实。材料已明确而用量未知时保留材料；简短数字只在上一问明确材料、总量/额外量和单位时接续。估计值保留不确定性，不记得用量时仍可检索不依赖精确数字的处理方向。一般建议和精确计算分开，不编造补加量，也不强制转实验室。
悬浮助手回复规则：缺料先确认缺什么；用户已提出具体替代材料（如“没有椰奶，椰汁可以吗”）时直接检索口感、质地和调制注意事项，并给实验室按钮；不要求确认全部库存，也不把候选材料当作已拥有。未提出替代候选时先找同基酒或同饮料的其他酒单。实际故障仅追问会改变建议的必要条件，不要求填写完整材料和操作表。页面配方不是实际使用记录。facts.missing_material只提取缺少的材料；available_materials_known仅在用户明确说明手边材料（包括明确没有）时为true；actual_materials和actual_steps必须是用户原话的摘录，无证据留空。pending是上一轮等待补充的事项，用户回答、纠正时继续；用户提出新问题时dialogue_act用new_task并放下旧事项。材料搭配风味只交实验室，用户明确要查酒时才调用find_recipes。混合知识与推荐把知识部分放进knowledge_question，使两件事都能完成。`;
export type CompanionDeps = {
    reviewRescue?: (prompt:string,state:unknown,signal:AbortSignal) => Promise<{value:unknown}>;
    followup?: (prompt:string,state:unknown,signal:AbortSignal) => Promise<{value:unknown}>;
    model: (state: unknown, signal: AbortSignal) => Promise<{
        value: unknown;
        model: string;
        usage: unknown;
    }>;
    search: (q: string, c: string, s: AbortSignal) => Promise<KnowledgeAnswer>;
};
async function runCompanionTurn(input: CompanionInput, deps: CompanionDeps, signal = AbortSignal.timeout(45000)): Promise<CompanionResult> {
    const result: CompanionResult = { status: 'answered', message: '', clarification: '', actions: [], recipes: [], knowledge: null, pending: null, taskId: input.taskId, contextVersion: input.contextVersion, trace: [], model: '' };
    const clarify = (q: string, resume?: Decision) => {
        result.status = 'needs_info'; result.clarification = q;
        if(!result.pending) result.pending = {kind:'clarification',intent:resume && resume.intent!=='out_of_scope'?resume.intent:'unclear',question:(input.pending && 'question' in input.pending ? input.pending.question : input.question),clarification:q.slice(0,500),awaitingField:/怎么调|怎么做|操作|搅拌|摇和/.test(q)?'actualSteps':/用了哪些|什么材料/.test(q)?'actualMaterials':'detail',slots:{...(input.pending?.kind==='clarification'?input.pending.slots:{}),...(resume?{category:resume.category,recipeName:resume.recipeName,materials:JSON.stringify(resume.materials)}:{})},recipeKey:input.page.kind+':'+(input.page.recipeId||input.page.name)};
    };
    try {
        signal.throwIfAborted();
        if (/^(算了|取消|先不改了|先不改|停止|不用了)[。！!]*$/.test(input.question.trim())) {
            result.status = 'cancelled';
            result.message = '好的，先不继续处理。';
            result.trace.push({ tool: 'route_layer', status: 'L1:cancel', elapsedMs: 0 });
            return result;
        }
        if (/^(谢谢|谢谢你|解决了|没问题了|没有其他问题了)[！!。]*$/.test(input.question.trim())) {
            result.message = '好的，这次先聊到这里。';
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
            result.trace.unshift({ tool: 'route_layer', status: 'L1:health_knowledge', elapsedMs: 0 });
            return result;
        }
        let d: Decision;
        const categoryPending = input.pending?.kind === 'category' ? input.pending : null;
        const alternativePending = input.pending?.kind === 'alternative' ? input.pending : null;
        const newMaterials = alternativePending ? alternativeAnswer(input.question) : [];
        const choice = categoryPending && /^(经典酒?|便利店(?:调酒)?)[。！!]*$/.test(input.question.trim());
        const routed = resolveBeforeL3({ ...input, page }, page);
        const rescue = isRescueConversation(input) && !routed;
        const routeLayer = routed?.layer ?? 'L3';
        const routeRule = routed?.rule ?? 'langchain_tool_call';
        if (routed) d = routed.decision;
        else {
            const state = { ...input, page };
            let planned: Decision | undefined;
            let protocolErrors: unknown;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const r = await timed('intent_model_l3', () => deps.model(protocolErrors ? { ...state, protocolErrors } : state, signal));
                    const parsed = decisionSchema.safeParse(r.value);
                    if (!parsed.success) {
                        protocolErrors = parsed.error.issues.map(i => ({ path: i.path, message: i.message }));
                        continue;
                    }
                    planned = parsed.data;
                    result.model = r.model;
                    result.usage = r.usage;
                    break;
                } catch (error) {
                    // Tool decoding happens inside the provider, before decisionSchema.
                    // Repair only protocol errors once; never retry transport failures here.
                    if (attempt || !(error instanceof Error) || !['INVALID_TOOL_ARGUMENTS', 'EXPECTED_ONE_TOOL_CALL', 'UNKNOWN_TOOL_CALL'].includes(error.message)) throw error;
                    protocolErrors = [{ message: error.message, instruction: '只调用一个已提供工具，参数须符合该工具schema。' }];
                    diagnostic('intent_protocol_retry', { code: error.message });
                }
            }
            if (!planned) throw Error('INVALID_PROTOCOL');
            d = planned;
        }
        result.trace.push({ tool: 'route_layer', status: `${routeLayer}:${routeRule}`, elapsedMs: 0 });
        result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
        diagnostic('intent', { layer: routeLayer, rule: routeRule, intent: d.intent, dialogueAct: d.dialogueAct, needsClarification: Boolean(d.question), knowledgeQuestion: diagnosticText(d.knowledgeQuestion) });
        if (categoryPending?.recipeName && d.dialogueAct === 'answer') { d.intent='named'; d.recipeName=categoryPending.recipeName; }
        // Guard explicit workflow requests against model routing drift; all entities still come from the same catalogue.
        const additional = additionalKnowledgeRequest(input.question);
        const literalMaterials = mentionedMaterials(additional?.primary ?? input.question);
        const literalRecipe = mentionedRecipe(input.question);
        if (d.dialogueAct !== 'cancel') {
            if (literalRecipe && /打开|查看|看看|酒单/.test(input.question) && !/怎么|如何|为什么|缺|没有|改良/.test(input.question)) {
                d.intent = 'named';
                d.recipeName = literalRecipe.nameZh;
                d.question = '';
            }
            else if (!proposedReplacement(input.question) && literalMaterials.length >= 2 && /什么味|什么风味|配起来|搭配.*(?:味|风)|混合.*味/.test(input.question) && !/已经|分层|失败|没有|不能|不可以|有说|有写|不是|说错|其实/.test(input.question)) {
                d.intent = 'explore';
                d.materials = literalMaterials;
                d.question = '';
                if (!hasAdditionalRequest(input.question))
                    d.knowledgeQuestion = '';
            }
            if (/我有|手边有|材料是|材料有/.test(input.question) && /能做什么|能调什么|可以做什么|能做哪|推荐.*酒/.test(input.question)) {
                d.intent = 'recommend'; d.question = '';
                if (!hasAdditionalRequest(input.question)) d.knowledgeQuestion = '';
            }
            if (d.intent === 'recommend' && /我有|手边有|材料是|材料有/.test(input.question))
                d.materials = additional ? literalMaterials : [...new Set([...d.materials, ...literalMaterials])];
            if (additional && ['recommend', 'named', 'operate', 'explore'].includes(d.intent) && !d.knowledgeQuestion)
                d.knowledgeQuestion = additional.question;
            const preferenceText = [...input.history.filter(h => h.role === 'user').map(h => h.content), input.question].join(' ');
            if (!/经典|便利店/.test(preferenceText))
                d.category = 'any';
        }
        if (d.dialogueAct !== 'cancel' && actualProblem(input.question)) d.intent = 'troubleshoot';
        if (d.dialogueAct !== 'cancel' && /降低酒感|酒感太/.test(input.question)) { d.intent = 'change'; d.question = ''; }
        // A clear technique question in this assistant already has the cocktail domain.
        if (d.intent === 'knowledge' && /过滤|摇和|搅拌|稀释|摇酒壶/.test(input.question)
            && /调酒|鸡尾酒/.test(d.question) && /其他方面|其他领域|其他.*过滤/.test(d.question)) d.question = '';
        const consultationResult = d.dialogueAct === 'cancel' || rescue ? null : resolveConsultation({ ...input, page }, d, page);
        if (consultationResult) {
            result.pending = consultationResult.pending;
            if (consultationResult.recheckMessage) result.message = consultationResult.recheckMessage;
            if (d.intent === 'change' && page.kind === 'classic')
                result.actions.push({ label: '查看便利店改良选项', action: { kind: 'locate', target: 'substitute' } });
            if (consultationResult.clarification) {
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
                const retained = page.ingredients.filter(i => !recipeMaterialMatches(i.name, consultationResult.missingMaterial!)).map(i => ({ name: i.name, amount: i.amount }));
                if (retained.length)
                    result.actions.push({ label: '查看实验结果', action: { kind: 'prefill', reference: 'standard', materials: [...retained, { name: consultationResult.proposedReplacement }] } });
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
                    return result;
                }
            }
        }
        if (rescue && ['troubleshoot','change','guide','knowledge','unclear'].includes(d.intent) && d.dialogueAct !== 'cancel') {
            const previous = input.pending?.kind === 'rescue' ? input.pending.conversation : [];
            const goal = input.pending && 'question' in input.pending ? input.pending.question : input.question;
            const conversation = [...previous, {role:'user' as const,content:input.question}, ...(d.question ? [{role:'assistant' as const,content:d.question}] : [])];
            result.pending = {kind:'rescue', question:goal, recipeKey:page.kind+':'+(page.recipeId||page.name), conversation:conversation.length > 24 ? [...conversation.slice(0,2),...conversation.slice(-22)] : conversation};
            // Preserve evidence and corrections even when the planner emits only a short query.
            d.knowledgeQuestion = conversation.filter(turn=>turn.role==='user').map(turn=>turn.content).join('；');
            if (d.intent === 'unclear' && !d.question) d.intent = 'troubleshoot';
        }
        if (rescue && result.pending?.kind==='rescue' && d.question && deps.reviewRescue) {
            const rescuePending=result.pending;
            const conversation=rescuePending.conversation.slice(0,-1); // Exclude the unshown draft question.
            try {
                const response=await checkRescueReply({kind:'clarify',message:'',question:d.question},conversation,deps,signal);
                result.message=response.message ? `${response.kind==='guidance'?'一般调酒建议（未获本次检索证实）：':''}${response.message}` : '';
                result.clarification=response.question;
                result.status=response.question?'needs_info':'answered';
                result.pending={...rescuePending,conversation:[...conversation,{role:'assistant' as const,content:[result.message,response.question].filter(Boolean).join('\n')}].slice(-24)};
                result.trace.push({tool:'rescue_review',status:response.kind,elapsedMs:0});
                return result;
            } catch(error) {
                diagnosticError('rescue_review',error);
                // Do not expose an unreviewed question; proceed to retrieval and the bounded fallback.
                d.question='';result.pending={...rescuePending,conversation};
            }
        }
        if (d.dialogueAct !== 'cancel' && d.question && ['unclear', 'knowledge', 'guide', 'change', 'troubleshoot'].includes(d.intent)) {
            clarify(d.question, d);
            if(result.pending?.kind==='clarification') result.pending={...result.pending,intent:d.intent as 'unclear'|'knowledge'|'guide'|'change'|'troubleshoot',slots:{...(input.pending?.kind==='clarification'?input.pending.slots:{}),...(d.facts?.actualMaterials?{actualMaterials:d.facts.actualMaterials}:{}),...(d.facts?.actualSteps?{actualSteps:d.facts.actualSteps}:{})}};
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
                clarify('你手边有哪些材料？', d);
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
                clarify('你想探索哪几种材料的搭配？', d);
            else {
                result.message = `把${experimentalMaterials.join('和')}生成建议用量的参考搭配，点击下方按钮查看结果，也可以继续调整用量。`;
                result.actions.push({ label: '查看实验结果', action: { kind: 'prefill', reference: 'standard', materials: experimentalMaterials.map(name => ({ name,
                    ...(alternativePending && ingredientKey(name) === ingredientKey(alternativePending.anchor)
                        ? { amount: page.ingredients.find(i => ingredientKey(i.name) === ingredientKey(name))?.amount } : {}) })) } });
            }
        }
        else if (d.intent === 'operate') {
            const cap = d.capability;
            if (cap === 'recipe' && page.kind !== 'lab' || cap === 'substitute' && page.kind === 'classic' || cap === 'lab' && page.kind === 'lab')
                result.actions.push({ label: cap === 'substitute' ? '查看便利店改良选项' : cap === 'recipe' ? '查看制作步骤' : '查看实验操作', action: { kind: 'locate', target: cap as 'recipe' | 'substitute' | 'lab' } });
            else if (cap === 'lab' || cap === 'finder' || cap === 'records')
                result.actions.push({ label: cap === 'lab' ? '打开实验室' : cap === 'records' ? '打开我的记录' : '去选酒页', action: { kind: 'navigate', target: cap } });
            else
                clarify('你想找到哪个功能？可以描述你准备进行的操作。', d);
        }
        else if (d.intent === 'change' && !d.question) {
            if (/降低酒感|酒感太/.test(input.question) && page.ingredients.length >= 2)
                result.actions.push({ label: '查看实验结果', action: { kind: 'prefill', reference: 'lower_alcohol', materials: page.ingredients.map(i => ({ name: i.name })) } });
            if (page.kind === 'classic' && !result.actions.length)
                result.actions.push({ label: '查看便利店改良选项', action: { kind: 'locate', target: 'substitute' } });
        }
        if (d.question && !result.clarification && ['change', 'guide', 'troubleshoot'].includes(d.intent))
            clarify(d.question, d);
        const needSearch = hasKnowledge || (d.intent === 'change' && !d.question);
        if (needSearch && (!d.question || ['recommend', 'named', 'operate', 'explore'].includes(d.intent))) {
            const start = Date.now();
            try {
                // Preserve a new standalone question; a planner rewrite must not invent extra tasks.
                const question = d.intent === 'knowledge' && !consultationResult && !hasAdditionalRequest(input.question)
                    && (d.dialogueAct === 'new_task' || (!input.history.length && !input.pending))
                    ? input.question : d.knowledgeQuestion || input.question;
                const answer = (rescue ? null : techniqueKnowledgeFor(question)) ?? await deps.search(question, JSON.stringify({ recipeRequirements: page, userConversation: input.history, currentQuestion: input.question, consultation: consultationResult, rescueConversation: rescue ? result.pending : undefined, legacyAdjustment: rescue && input.pending?.kind === 'adjustment' ? input.pending : undefined, mergedTaskState: input.pending?.taskState, notice: '配方和编辑值不是实际倒入量；用户纠正优先。不支持的精确替代比例不可推导。' }), signal);
                signal.throwIfAborted();
                if (answer.claims.some(c => !c.evidenceIds.length || c.evidenceIds.some(id => !answer.citations.some(s => s.id === id))))
                    throw Error('UNSUPPORTED');
                result.knowledge = knowledgeSchema.parse(answer);
                result.trace.push({ tool: 'search_knowledge', status: answer.status, elapsedMs: Date.now() - start });
                if (rescue && !answer.claims.length && deps.followup) {
                    try {
                        const next = await timed('rescue_followup', () => deps.followup!(rescueFollowupPrompt, {
                            page, originalQuestion: result.pending && 'question' in result.pending ? result.pending.question : input.question,
                            conversation: result.pending?.kind==='rescue' ? result.pending.conversation : input.history,
                            currentQuestion:input.question, retrieval:{status:answer.status,claims:answer.claims},
                        }, signal));
                        let response;
                        try {
                            response = parseRescueFollowup(next.value, result.pending?.kind==='rescue' ? result.pending.conversation.filter(t=>t.role==='user').map(t=>t.content).join('\n') : input.question);
                        } catch(error) {
                            // An unsupported suggestion need not discard an independently valid question.
                            const draft=rescueFollowupSchema.safeParse(next.value);
                            if(!draft.success || !draft.data.question) throw error;
                            response=parseRescueFollowup({kind:'clarify',message:'',question:draft.data.question},'');
                        }
                        response=await checkRescueReply(response,result.pending?.kind==='rescue'?result.pending.conversation:input.history,deps,signal);
                        result.message = response.message ? `${response.kind==='guidance'?'一般调酒建议（未获本次检索证实）：':''}${response.message}` : '';
                        result.clarification = response.question;
                        result.status = response.question ? 'needs_info' : 'answered';
                        if (result.pending?.kind==='rescue') {
                            const turns=[...result.pending.conversation,{role:'assistant' as const,content:[result.message,response.question].filter(Boolean).join('\n')}];
                            result.pending={...result.pending,conversation:turns.length>24?[...turns.slice(0,2),...turns.slice(-22)]:turns};
                        }
                        result.trace.push({tool:'rescue_followup',status:response.kind,elapsedMs:0});
                        return result;
                    } catch(error) {
                        diagnosticError('rescue_followup',error);
                        result.trace.push({tool:'rescue_followup',status:'error',elapsedMs:0});
                        // Keep the completed retrieval result when the optional follow-up fails validation.
                    }
                }
                if (!answer.claims.length && !result.message) {
                    result.message = consultationResult?.pending?.kind === 'substitution' && consultationResult.pending.stage === 'advising'
                        ? `已确认当前配方列有${consultationResult.missingMaterial}，但现有资料不足以支持省略后的具体处理建议。`
                        : consultationResult?.openAlternatives
                        ? '酒库和资料暂时没有找到合适的其他酒款，可以到选酒页调整条件。'
                        : d.intent === 'change'
                        ? '站内资料和本次联网查询没有找到适用于这些材料的可靠替代建议，暂时不能确定替代方式。'
                        : rescue
                        ? '现有资料不足以支持这杯的具体补救建议，暂时不能确定该怎么调整。'
                        : answer.status === 'no_evidence'
                            ? '现有资料里暂时没有找到这个问题的相关依据。'
                            : /比例|换算|精确/.test(question)
                                ? '现有资料不足以确定这个替换比例，暂时不能给出准确用量。'
                                : '现有资料还不足以确定这个问题的答案。';
                }
                if (consultationResult?.openAlternatives && !result.recipes.length && !answer.claims.length)
                    result.actions.push({ label: '去选酒页', action: { kind: 'navigate', target: 'finder' } });
            }
            catch (error) {
                diagnosticError('search_knowledge',error);
                result.trace.push({ tool: 'search_knowledge', status: 'error', elapsedMs: Date.now() - start });
                result.message = [result.message, '这次资料查询没有完成，你可以重试。'].filter(Boolean).join('\n');
                if (consultationResult) result.pending = consultationResult.pending ?? input.pending;
                if (consultationResult || (!result.actions.length && !result.recipes.length))
                    result.status = signal.aborted ? 'timeout' : 'unavailable';
            }
        }
        if (result.knowledge?.claims.length && result.recipes.length && d.knowledgeQuestion && !consultationResult) result.message = '';
        if (!result.message && !result.clarification && !result.knowledge && !result.actions.length && !result.recipes.length)
            clarify('请说说当前这杯遇到的具体问题。');
        return result;
    }
    catch (error) {
        diagnosticError('companion',error);
        return { ...result, pending: input.pending, status: signal.aborted ? 'timeout' : 'unavailable', message: '助手暂时未能完成处理，请稍后重试。' };
    }
}


function awaitingField(pending:NonNullable<CompanionInput['pending']>):string {
 if(pending.kind==='clarification')return pending.awaitingField;
 if(pending.kind==='troubleshoot')return pending.stage==='materials'?'actualMaterials':'actualSteps';
 if(pending.kind==='substitution')return pending.stage==='missing'?'missingMaterial':pending.stage==='available'?'availableMaterials':'detail';
 return pending.kind==='adjustment'?'quantities':pending.kind==='category'?'category':'replacement';
}
// The shared L2 envelope belongs to the task, not to a particular business branch.
export async function runCompanion(input:CompanionInput,deps:CompanionDeps,signal=AbortSignal.timeout(45000)):Promise<CompanionResult>{
 const key=input.page.kind+':'+(input.page.recipeId||input.page.name);
 const old=input.pending;
 const discard=startsNewTask(input.question)||(old?.taskState&&old.taskState.recipeKey!==key)||(old?.kind==='rescue'&&old.recipeKey!==key);
 let state:TaskState|undefined;
 let turn=discard?{...input,pending:null}:input;
 if(turn.pending && turn.pending.kind!=='rescue' && turn.pending.kind!=='adjustment'){
  state=mergeTaskState(turn.pending.taskState,'question' in turn.pending?turn.pending.question:input.question,key,awaitingField(turn.pending),input.question);
  turn={...turn,pending:{...turn.pending,taskState:state}};
 }
 if(state?.lastAct==='unknown' && turn.pending?.kind!=='adjustment') {
  return {status:'answered',message:`${knownFacts(state)?'已保留：'+knownFacts(state)+'。':''}这项信息暂不确定，我不会把它当作已确认事实。你可以继续补充其他已知材料或操作。`,clarification:'',actions:[],recipes:[],knowledge:null,pending:turn.pending,taskId:input.taskId,contextVersion:input.contextVersion,trace:[{tool:'route_layer',status:'L2:unknown_field',elapsedMs:0}],model:''};
 }
 const result=await runCompanionTurn(turn,deps,signal);
 if(result.pending && result.pending.kind!=='rescue'){
  const base=result.pending.taskState||state||mergeTaskState(undefined,'question' in result.pending?result.pending.question:input.question,key,'',input.question);
  const field=result.pending.kind==='adjustment'&&result.pending.taskState?result.pending.taskState.awaitingField:awaitingField(result.pending);
  result.pending={...result.pending,taskState:{...base,awaitingField:field}};
 }
 return result;
}

async function checkRescueReply(draft:RescueReply,conversation:RescueTurn[],deps:CompanionDeps,signal:AbortSignal):Promise<RescueReply> {
 const userText=conversation.filter(t=>t.role==='user').map(t=>t.content).join('\n');
 const checked=deps.reviewRescue ? parseRescueFollowup((await timed('rescue_review',()=>deps.reviewRescue!(rescueReviewPrompt,{draft,conversation},signal))).value,userText) : draft;
 return removeRepeatedQuestion(respectRescueGoal(checked,conversation),conversation);
}
