import type { PageContext } from '../../src/lib/agent/companion-contract';

export type AcceptanceTurn = {
    question: string;
    outcome: 'answer' | 'clarify' | 'action' | 'cancel' | 'out_of_scope' | 'limited';
    intent?: string;
    clarification?: string;
    evidence?: string[];
    queryIncludes?: string[];
    forbidden?: string;
    forbiddenEvidence?: string[];
    requireUncertainty?: boolean;
    action?: string;
    noSearch?: boolean;
};
export type AcceptanceCase = { id: string; topic: string; page?: [Exclude<PageContext['kind'], 'lab'>, string]; turns: AcceptanceTurn[] };
// Written before the live baseline. These are authored realistic scenarios, not production user logs.
export const acceptanceCases: AcceptanceCase[] = [
    { id: 'A01', topic: '气泡摇和', turns: [{ question: '做嗨棒时，威士忌和苏打水能一起放进摇酒壶吗？', outcome: 'answer', evidence: ['carbonated-shaking'] }] },
    { id: 'A02', topic: '重复用冰', turns: [{ question: '刚调完一杯，摇酒壶剩下的冰能接着调下一杯吗？', outcome: 'answer', evidence: ['reuse-ice'] }] },
    { id: 'A03', topic: '薄荷苦味', turns: [{ question: '为什么莫吉托的薄荷不能用力碾碎？', outcome: 'answer', evidence: ['mint-muddling'] }] },
    { id: 'A04', topic: '蜂蜜混合', turns: [{ question: '蜂蜜遇到冷的酒很难混匀，一般怎么处理？', outcome: 'answer', evidence: ['honey-mixing'] }] },
    { id: 'A05', topic: '双重过滤', turns: [{ question: '双重过滤要用哪两种工具，具体怎么操作？', outcome: 'answer', evidence: ['double-strain'] }] },
    { id: 'A06', topic: '干摇', turns: [{ question: '含蛋白的鸡尾酒，干摇和普通加冰摇有什么区别？', outcome: 'answer', evidence: ['dry-shake', 'reverse-dry-shake'] }] },
    { id: 'A07', topic: '酒精判断', turns: [{ question: '一杯酒喝起来像果汁，能据此判断酒精含量很低吗？', outcome: 'answer', evidence: ['alcohol-content'] }] },
    { id: 'A08', topic: '经典配方', page: ['classic', 'negroni'], turns: [{ question: '经典内格罗尼需要另外加柠檬汁或糖浆吗？', outcome: 'answer', evidence: ['classic-negroni'] }] },
    { id: 'A09', topic: '盐口可选', turns: [{ question: '玛格丽特不做盐口，还符合 IBA 配方吗？', outcome: 'answer', evidence: ['classic-margarita'] }] },
    { id: 'A10', topic: '精确换算边界', turns: [{ question: '没有糖浆密度和品牌资料，能把20毫升1:1糖浆精确换算成2:1糖浆的毫升数吗？请准确到小数点后两位。', outcome: 'limited', forbidden: '\\d+\\.\\d{2}\\s*(?:毫升|ml)|两倍|翻倍' }] },
    { id: 'A11', topic: '品牌知识缺口', turns: [{ question: '新出的“云岚零号”果味饮料，可以保证按同样毫升数替代君度，而且味道完全一样吗？', outcome: 'limited', forbidden: '可以保证|完全一样|等量替换即可' }] },
    { id: 'A12', topic: '缺冰', page: ['convenience', 'cv-beer-lemon-tea'], turns: [{ question: '没有冰块怎么办，会影响这杯口感吗？', outcome: 'answer', queryIncludes: ['冰块'], forbidden: '配方里没有列出.*冰' }] },
    { id: 'A13', topic: '明确替换', page: ['convenience', 'cv-beer-lemon-tea'], turns: [{ question: '把柠檬茶换成柠檬汁是什么味道？', outcome: 'answer', queryIncludes: ['柠檬茶', '柠檬汁'], action: 'prefill', forbiddenEvidence: ['citrus-recipe-choice'] }] },
    { id: 'A14', topic: '缺料连续追问', turns: [
        { question: '这杯材料不齐，怎么办？', outcome: 'clarify', clarification: '缺少哪', noSearch: true },
        { question: '橙味利口酒', outcome: 'action', noSearch: true },
    ] },
    { id: 'A15', topic: '故障多轮上下文', turns: [
        { question: '我这杯已经混好了，分层了怎么办？', outcome: 'clarify', clarification: '实际用了', noSearch: true },
        { question: '金酒、牛奶、柠檬汁', outcome: 'clarify', clarification: '怎么调', noSearch: true },
        { question: '先把牛奶和柠檬汁混合，再倒入金酒搅拌', outcome: 'answer', queryIncludes: ['金酒', '牛奶', '柠檬汁', '分层'], evidence: ['milk-curdling'], requireUncertainty: true, forbidden: '肯定是|一定是|继续摇就能恢复' },
    ] },
    { id: 'A16', topic: '已知事实不重问', turns: [{ question: '我用了牛奶、柠檬汁和金酒，先把牛奶和柠檬汁混合，再倒入金酒搅拌，出现絮状结块了，可能是什么原因？', outcome: 'answer', queryIncludes: ['牛奶', '柠檬汁'], evidence: ['milk-curdling'], requireUncertainty: true, forbidden: '结块原因是|改变混合顺序|不易结块的植物奶' }] },
    { id: 'A17', topic: '技法短路范围', turns: [{ question: '我用了金酒和蜂蜜，摇了10秒还是混不开，怎么办？', outcome: 'answer', evidence: ['honey-mixing'], forbidden: '奶蛋白|乳饮' }] },
    { id: 'A18', topic: '故障追问中换话题', turns: [
        { question: '这杯调完太甜了怎么办？', outcome: 'clarify', noSearch: true },
        { question: '先不说这杯了，双重过滤怎么做？', outcome: 'answer', evidence: ['double-strain'] },
    ] },
    { id: 'A19', topic: '取消任务', turns: [
        { question: '我这杯分层了怎么办？', outcome: 'clarify', noSearch: true },
        { question: '取消', outcome: 'cancel', noSearch: true },
    ] },
    { id: 'A20', topic: '孤立数字', turns: [{ question: '30', outcome: 'clarify', noSearch: true }] },
    { id: 'A21', topic: '指定酒单', turns: [{ question: '打开威士忌嗨棒的酒单', outcome: 'action', action: 'recipe:whisky-highball', noSearch: true }] },
    { id: 'A22', topic: '功能导航', turns: [{ question: '制作步骤在哪里？', outcome: 'action', action: 'locate:recipe', noSearch: true }] },
    { id: 'A23', topic: '风味探索', turns: [{ question: '伏特加和橙汁配起来是什么味道？', outcome: 'action', action: 'prefill', noSearch: true }] },
    { id: 'A24', topic: '推荐与知识混合', turns: [{ question: '我有伏特加和橙汁，能做什么酒？另外，苏打水可以放进摇酒壶里摇吗？', outcome: 'answer', evidence: ['carbonated-shaking'] }] },
    { id: 'A25', topic: '导航与知识混合', turns: [{ question: '打开玛格丽特的酒单，另外解释一下干摇是什么意思。', outcome: 'answer', action: 'recipe:margarita', evidence: ['dry-shake'] }] },
    { id: 'A26', topic: '超出职责', turns: [{ question: '帮我写一个 Python 快速排序函数。', outcome: 'out_of_scope', noSearch: true }] },
];
