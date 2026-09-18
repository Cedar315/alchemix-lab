import type { CompanionInput, Decision, PageContext } from './companion-contract';
import { ingredientKey, mentionedMaterials, verifiedMaterials } from './workflow-catalog';

type Pending = Extract<CompanionInput['pending'], { kind: 'substitution' | 'troubleshoot' }>;
const emptyDecision: Decision = { intent: 'change', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any', capability: 'none', question: '', knowledgeQuestion: '' };
const missingWords = /没有|没了|缺少|缺料|不齐|用完|喝完|缺(?:哪|一种|点)|替代|替换|换成/;
export const missingRequest = (text: string) => missingWords.test(text) && !/为什么|原理|能做什么|其他酒|别的酒|哪里|在哪|有没有/.test(text);
export const actualProblem = (text: string) => /太甜|太酸|太苦|太淡|酒味太重|分层|混不开|结块/.test(text) && /这杯|我|已经|调完|做完|刚|还是|了|怎么办/.test(text);
const isShortAnswer = (text: string) => text.length <= 160 && !/[？?]|为什么|怎么|如何|打开|查看|换个|另外|什么味|能做什么|能做哪|推荐|取消|不用了|谢谢|不是|说错|其实|我想|帮我|告诉我|改聊|聊聊|想看|想听/.test(text);
export function alternativeAnswer(text: string) {
    const cleaned = text.trim().replace(/^不选(?:这些)?(?:了)?[，,\s]*/, '');
    if (!isShortAnswer(cleaned)) return [];
    const names = materialList(cleaned);
    return names.length && names.every(name => mentionedMaterials(name).length || /(?:汁|奶|水|茶|酒|糖浆|汽水|可乐|雪碧)$/.test(name)) ? names : [];
}

// Only use the latest explicit prompt as a compatibility bridge for an older client.
export function consultationPending(input: CompanionInput): Pending | null {
    if (input.pending && (input.pending.kind === 'substitution' || input.pending.kind === 'troubleshoot')) return input.pending;
    if (input.pending) return null;
    const previous = [...input.history].reverse().find(h => h.role === 'assistant')?.content ?? '';
    const question = [...input.history].reverse().find(h => h.role === 'user')?.content ?? '';
    if (/缺少哪|缺哪|哪一种材料/.test(previous))
        return { kind: 'substitution', stage: 'missing', question, missingMaterial: '', materials: [], materialsKnown: false };
    if (/你手边有哪些/.test(previous) && missingRequest(question))
        return { kind: 'substitution', stage: 'available', question, missingMaterial: missingMaterial(question), materials: [], materialsKnown: false };
    return null;
}

export function consultationDecision(input: CompanionInput): Decision | null {
    const pending = consultationPending(input);
    const short = isShortAnswer(input.question);
    const names = materialList(input.question);
    const knownNames = names.length > 0 && names.every(name => mentionedMaterials(name).some(known => ingredientKey(known) === ingredientKey(name)) || ['君度', '柠檬', '青柠'].includes(name) || /(?:汁|奶|水|茶|酒|糖浆|汽水|可乐|雪碧)$/.test(name));
    const explicitNone = /^(?:都|什么|其他|别的)?(?:没有|没了|没有了|没有其他材料)[。！!]*$/.test(input.question.trim());
    const actualStep = pending?.kind === 'troubleshoot' && pending.stage === 'steps' && /搅|摇|混|倒|按.*配方|不知道|不记得/.test(input.question);
    if (pending && short && (knownNames || explicitNone || actualStep))
        return { ...emptyDecision, intent: pending.kind === 'substitution' ? 'change' : 'troubleshoot', dialogueAct: /不是|说错|其实/.test(input.question) ? 'correction' : 'answer' };
    const missing = missingMaterial(input.question);
    const knownMissing = missing && input.page.ingredients.some(i => ingredientKey(i.name).includes(ingredientKey(missing)) || ingredientKey(missing).includes(ingredientKey(i.name)));
    if (missingRequest(input.question) && (knownMissing || /材料|缺料/.test(input.question)) && !/不是|说错|其实/.test(input.question)) return { ...emptyDecision };
    return null;
}

function cleanMaterial(value: string) {
    return value.replace(/^(?:我|这杯|现在|已经|只|还|也|是|用的|用|缺少|缺|没有)+/, '').replace(/(?:已经|都)?(?:没了|没有了|没有|用完了?|喝完了?).*$/, '').replace(/[了。！？?!]+$/, '').trim();
}
function missingMaterial(text: string): string {
    const before = text.match(/(?:没有|缺少|缺了|缺)([^，。；！？?]+?)(?=怎么办|可以|能用|能换|换什么|用什么|了|，|。|；|！|？|\?|$)/)?.[1];
    const after = text.match(/(?:^|[，。；])([^，。；！？?]+?)(?:没了|没有了|用完了?|喝完了?)/)?.[1];
    const found = cleanMaterial(before ?? after ?? '');
    return found && found.length <= 100 && !/材料|什么|哪种|这个|那个|东西/.test(found) ? found : '';
}
function proposedReplacement(text: string): string {
    const afterPause = text.match(/[，,；;]\s*(?:可以)?(?:用|换成)?([^，,。；;！？?]{1,40}?)(?:可以吗|能用吗|行吗|能替代吗|能换吗|可不可以)/)?.[1];
    const afterVerb = text.match(/(?:可以|能)?(?:用|换成)([^，,。；;！？?]{1,40}?)(?:吗|替代|代替|换)/)?.[1];
    const candidate = (afterPause ?? afterVerb ?? '').trim();
    return candidate && !/什么|哪些|怎么|材料|配方|手边/.test(candidate) ? candidate : '';
}

function materialList(text: string) {
    return text.replace(/^(?:我手边|手边|现在|我|还|只|有|是|剩下|剩|可用的材料|材料)+(?:有|是)?/, '')
        .split(/[、，,；;\n]|\s+(?=[\u4e00-\u9fff])|以及|还有|和/).map(s => s.trim().replace(/[。！!]+$/, ''))
        .filter(s => s && s.length <= 100 && !/没有|没了|不用|不是|用完|喝完|不知道|不清楚|怎么办|可以|能否|先|再|替换|替代/.test(s));
}
function stock(text: string): { known: boolean; materials: string[] } {
    if (/^(?:都|什么|其他|别的)?(?:没有|没了|没有了|没有其他材料)[。！!]*$/.test(text.trim())) return { known: true, materials: [] };
    const declared = text.match(/(?:我手边有|手边有|我有|还有|只有|只剩|材料有|材料是|可用材料是)([^。！？?]+)/)?.[1];
    return { known: declared !== undefined, materials: declared ? materialList(declared) : [] };
}
function quoted(value: string | undefined, text: string) { return value && text.includes(value) ? value : ''; }

export type Consultation = {
    kind: 'substitution' | 'troubleshoot';
    clarification: string;
    pending: Pending | null;
    question: string;
    missingMaterial?: string;
    proposedReplacement?: string;
    openAlternatives?: boolean;
    materials: string[];
    actualMaterials?: string;
    actualSteps?: string;
};

export function resolveConsultation(input: CompanionInput, d: Decision, page: PageContext): Consultation | null {
    const previous = consultationPending(input);
    const continuing = previous && ['answer', 'correction', 'feedback'].includes(d.dialogueAct);
    const pending = continuing ? previous : null;
    const text = input.question;
    const userText = [...input.history.filter(h => h.role === 'user').map(h => h.content), text].join('\n');
    const question = pending?.question || text;
    if (d.intent === 'change' && (pending?.kind === 'substitution' || missingRequest(text) || d.facts?.missingMaterial)) {
        const saved = pending?.kind === 'substitution' ? pending : null;
        let missing = quoted(d.facts?.missingMaterial, text) || missingMaterial(text) || quoted(d.facts?.missingMaterial, userText) || saved?.missingMaterial || '';
        if (saved?.stage === 'missing' && isShortAnswer(text)) missing = missingMaterial(text) || cleanMaterial(text);
        const current = stock(text);
        let known = current.known || saved?.materialsKnown || false;
        let materials = current.known ? current.materials : saved?.materials ?? [];
        if (saved?.stage === 'available' && isShortAnswer(text) && !missingRequest(text)) {
            known = true;
            materials = current.known ? current.materials : materialList(text);
        }
        // Explicit availability in the recent user context can avoid repeating the inventory question.
        if (!known) {
            const declared = [...input.history].reverse().filter(h => h.role === 'user').map(h => stock(h.content)).find(s => s.known);
            if (declared) { known = true; materials = declared.materials; }
        }
        if (d.facts?.availableMaterialsKnown) {
            const verified = verifiedMaterials(d.materials, input);
            if (verified.length) { known = true; materials = verified; }
        }
        materials = materials.filter(name => ingredientKey(name) !== ingredientKey(missing));
        const state = { kind: 'substitution' as const, stage: missing ? 'available' as const : 'missing' as const, question, missingMaterial: missing, materials: materials.slice(0, 30), materialsKnown: known };
        if (!missing) return { kind: state.kind, clarification: '这杯缺少哪一种材料？', pending: state, question, materials };
        const inRecipe = page.ingredients.some(i => ingredientKey(i.name).includes(ingredientKey(missing)) || ingredientKey(missing).includes(ingredientKey(i.name)));
        if (!inRecipe && page.ingredients.length && !/调整这杯|加过|另外加|实际用了|另一份配方/.test(userText))
            return { kind: state.kind, clarification: `当前${page.name}的配方里没有列出“${missing}”。你是在调整这杯，还是指另一份配方？`, pending: null, question, materials };
        const earlierProposal = saved?.question ? proposedReplacement(saved.question) : '';
        const proposed = proposedReplacement(text) || (saved?.stage === 'available' && isShortAnswer(text) && materials.length === 1 && ingredientKey(materials[0]) === ingredientKey(earlierProposal) ? earlierProposal : '');
        if (proposed && ingredientKey(proposed) !== ingredientKey(missing))
            return { kind: state.kind, clarification: '', pending: null, question: `${page.name}的配方缺少${missing}；用户询问${proposed}能否作为替代，但没有确认具体产品或库存。${question} 请根据资料说明能否用于这杯、风味和质地差异、适用条件与限制；不要把不同材料视为同一种，也不要凭空给出等量比例。`, materials: [], missingMaterial: missing, proposedReplacement: proposed };
        if (!known) return { kind: state.kind, clarification: '', pending: null, question: `${page.name}缺少${missing}；请查找保留当前主要材料、避开${missing}的其他真实酒款。${question}`, materials: [], missingMaterial: missing, openAlternatives: true };
        const availability = /不知道|不清楚|不记得/.test(text) ? '用户暂不清楚手边有哪些材料' : `用户手边${materials.length ? '有' + materials.join('、') : '没有其他可用材料'}`;
        return { kind: state.kind, clarification: '', pending: null, question: `${page.name}缺少${missing}；${availability}。${question} 请说明适用替代选项、风味差异和限制；没有合适选项时直接说明。`, materials, missingMaterial: missing };
    }
    if (d.intent !== 'troubleshoot') return null;
    const saved = pending?.kind === 'troubleshoot' ? pending : null;
    const clauses = text.split(/[，。；]/);
    let actualMaterials = quoted(d.facts?.actualMaterials, userText) || saved?.actualMaterials || '';
    let actualSteps = quoted(d.facts?.actualSteps, userText) || saved?.actualSteps || '';
    const used = clauses.filter(c => /用了|用的是|实际用|加了|倒了|加入|按.*配方|把.+(?:倒|混|搅)/.test(c));
    if (used.length) actualMaterials = used.join('，');
    const steps = clauses.filter(c => /摇了|摇匀|搅拌|搅了|混合|混在一起|先.+再|按.*配方.*(?:做|操作)|倒入/.test(c));
    if (steps.length) actualSteps = steps.join('，');
    if (saved && isShortAnswer(text)) {
        if (saved.stage === 'materials') actualMaterials = text;
        else actualSteps = text;
    }
    const state = { kind: 'troubleshoot' as const, stage: actualMaterials ? 'steps' as const : 'materials' as const, question, actualMaterials: actualMaterials.slice(0, 1000), actualSteps: actualSteps.slice(0, 1000) };
    if (!actualMaterials) return { kind: state.kind, clarification: '这杯实际用了哪些材料？', pending: state, question, materials: [] };
    if (!actualSteps) return { kind: state.kind, clarification: '你刚才是怎么调这杯的？', pending: state, question, materials: [], actualMaterials };
    return { kind: state.kind, clarification: '', pending: null, question: `${page.name}：${question}。用户实际使用：${actualMaterials}；实际操作：${actualSteps}。请先解释可能原因，再给适用的补救建议和限制。`, materials: [], actualMaterials, actualSteps };
}
