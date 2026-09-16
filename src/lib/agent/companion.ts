import { diagnostic, diagnosticText, timed } from './diagnostics';
import { clarificationPolicy } from "./clarification-policy";
import { knowledgeSchema, decisionSchema, type CompanionInput, type CompanionResult, type Decision } from './companion-contract';
import { findRecipe, recipeContext, namedRecipes, matchWorkflow, verifiedMaterials, mentionedMaterials, mentionedRecipe, similarRecipes, ingredientKey } from './workflow-catalog';
import type { KnowledgeAnswer } from './core';
export const companionPrompt = `你是按需调酒助手的意图识别器，只返回JSON，字段必须齐全：
{"intent":"operate","dialogueAct":"new_task","materials":[],"recipeName":"","category":"any","capability":"none","question":"","knowledgeQuestion":""}
intent只能选operate（找页面操作）、explore（材料搭配风味）、recommend（库内选酒）、named（指定酒单）、change（当前酒缺料替换）、guide（制作步骤）、troubleshoot（实际故障）、knowledge（知识）、out_of_scope、unclear。
dialogueAct=new_task|answer|correction|feedback|cancel；category=classic|convenience|any；capability=recipe|substitute|lab|finder|records|none。
无需用户选择帮助菜单。明确取消优先。结合上一轮追问解释是的/没有/数字，指代不明则unclear。纠正优先于旧事实。当前配方材料不是用户库存或实际已倒入量。仅提取用户明确说有的材料；不要把没有的材料或配方要求写入materials。询问材料搭配风味用explore并提取提到的材料。缺料保留当前酒，不选酒。操作说明用operate和已知capability；关于改良/便利店版本用substitute。知识问题无须选酒。
推荐有材料时提取全部已有材料；指定酒名提取原文名称；category只有用户明确表态才给类别。knowledgeQuestion为结合真实对话重述的完整知识问题；混合推荐和知识保留知识部分。缺关键事实时question只问一个必要问题，不问页面已有的信息。“这杯”默认指page中的当前酒；用户回答材料名称时接续上一轮缺料追问，不再问是哪杯。降低酒感、太甜怎么调整属于change或troubleshoot，不是找功能。不得生成URL、配方、精确比例或自由答案。
${clarificationPolicy}`;
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
        let d: Decision;
        const choice = input.pending && /^(经典酒?|便利店(?:调酒)?)[。！!]*$/.test(input.question.trim());
        const previousAssistant = [...input.history].reverse().find(h => h.role === 'assistant')?.content ?? '';
        const missingFollowup = /缺少哪|缺哪|哪一种材料/.test(previousAssistant)
            && input.question.length < 40
            && !/[？?]|为什么|怎么|如何|能否|可以吗|怎么办/.test(input.question);
        const missingRequest = /材料不齐|缺料|缺少|(?:这杯|当前).*(?:没有|缺)|没有.+(?:替|换)|没.+(?:了|有).*(?:怎么办|替|换)|用完.+(?:怎么办|替|换)/.test(input.question);
        if (choice) {
            d = { intent: input.pending?.recipeName ? 'named' : 'recommend', dialogueAct: 'answer', materials: input.pending!.materials, category: input.question.startsWith('经典') ? 'classic' : 'convenience', recipeName: input.pending?.recipeName ?? '', capability: 'none', question: '', knowledgeQuestion: '' };
        }
        else if (missingFollowup || missingRequest) {
            d = { intent: 'change', dialogueAct: missingFollowup ? 'answer' : 'new_task', materials: [], category: 'any', recipeName: '', capability: 'none', question: '', knowledgeQuestion: `${page.name}：${missingFollowup ? '缺少'+input.question+'，有什么替代及限制？' : input.question}` };
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
        if (input.pending?.recipeName && d.dialogueAct === 'answer') { d.intent='named'; d.recipeName=input.pending.recipeName; }
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
        const answersMissingPrompt = d.dialogueAct === 'answer' && missingFollowup;
        if (d.dialogueAct !== 'cancel' && d.intent !== 'unclear' && !d.question && (missingFollowup || missingRequest || /降低酒感|酒感太|太甜|太酸|太苦/.test(input.question))) {
            d.intent = 'change'; d.question = '';
            d.knowledgeQuestion = `${page.name}：${answersMissingPrompt ? '缺少'+input.question+'，有什么替代及限制？' : input.question}`;
            if (/材料不齐|缺料/.test(input.question) && !literalMaterials.length) d.question = '这杯缺少哪一种材料？';
            if (answersMissingPrompt && !page.ingredients.some(i => ingredientKey(i.name).includes(ingredientKey(input.question)) || ingredientKey(input.question).includes(ingredientKey(i.name)))) {
                clarify(`当前${page.name}的配方里没有列出“${input.question}”。你是在调整这杯，还是指另一份配方？`);
                return result;
            }
        }
        if (d.dialogueAct !== 'cancel' && d.question && ['unclear', 'knowledge', 'guide', 'change', 'troubleshoot'].includes(d.intent)) {
            result.trace.push({ tool: 'recognize_intent', status: d.intent, elapsedMs: 0 });
            clarify(d.question);
            return result;
        }
        const similarPage = (choice || d.dialogueAct === 'answer') && input.pending?.similarTo ? input.pending.similarTo : /类似|相似|这个口味|这种口味/.test(input.question) && /找|推荐|换|喜欢/.test(input.question) ? page : null;
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
        if (d.intent === 'change' && page.kind === 'convenience' && missingRequest
            && /怎么办|替|换/.test(input.question) && !/还是|或者|哪个|哪一种/.test(input.question)) {
            clarify('你手边有哪些可以替换的饮料？告诉我两三种，我按这杯的风味和气泡需求帮你比较。');
            return result;
        }
        const materials = choice ? verifiedMaterials(input.pending!.materials, input) : verifiedMaterials(d.materials, input);
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
                const matches = matchWorkflow(materials);
                result.trace.push({ tool: 'match_workflow', status: String(matches.length), elapsedMs: 0 });
                const kinds = new Set(matches.map(m => m.recipe.kind));
                if (kinds.size > 1 && d.category === 'any') {
                    clarify('想看经典酒还是便利店调酒？');
                    result.pending = { kind: 'category', materials };
                }
                else {
                    const selected = matches.filter(m => d.category === 'any' || (d.category === 'classic' ? m.recipe.kind === 'classic' : m.recipe.kind === 'easy')).slice(0, 3);
                    result.recipes = selected.map(({ recipe: r, missing }) => ({ id: r.id, name: r.nameZh, category: r.kind === 'classic' ? 'classic' : 'convenience', reason: `已匹配你提供的材料：${r.ingredients.join('、')}。冰块和器具请在酒单中确认。`, missing, action: { kind: 'recipe', category: r.kind === 'classic' ? 'classic' : 'convenience', id: r.id } }));
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
                result.message = `找到${r.nameZh}的酒单。`;
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
            if (!materials.length)
                clarify('你想探索哪几种材料的搭配？');
            else {
                result.message = `把${materials.join('和')}带到实验室查看搭配，用量由你确认。`;
                result.actions.push({ label: '到实验室查看搭配', action: { kind: 'prefill', materials: materials.map(name => ({ name })) } });
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
        else if (d.intent === 'change' && page.kind === 'classic' && !d.question) {
            result.message = '先保留当前这杯，可以在便利店改良选项中查看已有调整。该功能不保证每种缺料都有替代。';
            result.actions.push({ label: '查看便利店改良选项', action: { kind: 'locate', target: 'substitute' } });
        }
        if (d.question && !result.clarification && ['change', 'guide', 'troubleshoot'].includes(d.intent))
            clarify(d.question);
        const needSearch = hasKnowledge || (d.intent === 'change' && !d.question);
        if (needSearch && (!d.question || ['recommend', 'named', 'operate', 'explore'].includes(d.intent))) {
            const start = Date.now();
            try {
                const answer = await deps.search(d.knowledgeQuestion || input.question, JSON.stringify({ recipeRequirements: page, userConversation: input.history, currentQuestion: input.question, notice: '配方和编辑值不是实际倒入量；用户纠正优先。不支持的精确替代比例不可推导。' }), signal);
                signal.throwIfAborted();
                if (answer.claims.some(c => !c.evidenceIds.length || c.evidenceIds.some(id => !answer.citations.some(s => s.id === id))))
                    throw Error('UNSUPPORTED');
                result.knowledge = knowledgeSchema.parse(answer);
                result.trace.push({ tool: 'search_knowledge', status: answer.status, elapsedMs: Date.now() - start });
                if (!answer.claims.length && !result.message) {
                    result.message = d.intent === 'change'
                        ? '我还没查到能支持等味或等量替代的可靠依据。告诉我你手边有的两三种饮料，我可以继续比较哪一种更适合这杯。'
                        : answer.status === 'no_evidence'
                            ? '我没有查到与这个问题直接相关的资料。你可以补充酒名、材料或当前操作，我再按具体情况查。'
                            : '查到的资料没有直接支持明确结论。你可以补充当前配方和实际情况，我再缩小范围。';
                }
            }
            catch {
                result.trace.push({ tool: 'search_knowledge', status: 'error', elapsedMs: Date.now() - start });
                result.message = [result.message, '这次资料查询没有完成，你可以重试。'].filter(Boolean).join('\n');
                if (!result.actions.length && !result.recipes.length)
                    result.status = signal.aborted ? 'timeout' : 'unavailable';
            }
        }
        if (!result.message && !result.clarification && !result.knowledge && !result.actions.length && !result.recipes.length)
            clarify('请说说当前这杯遇到的具体问题。');
        return result;
    }
    catch {
        return { ...result, status: signal.aborted ? 'timeout' : 'unavailable', message: '助手暂时未能完成处理，请稍后重试。' };
    }
}
