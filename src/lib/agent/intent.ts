// A narrow execution guard for explicit technique questions. Other intents remain
// model-routed; this does not generate an answer or classify all conversation.
export function isIceAmountQuestion(question: string) {
  return /(?:多少|几块|几颗|多大|满杯).{0,10}冰|冰.{0,12}(?:多少|几块|几颗|多大|满杯)|(?:加冰|放冰|冰量).{0,8}(?:怎么|如何|不懂|不知道)/.test(question);
}
export function needsKnowledgeFirst(question: string) {
  return isIceAmountQuestion(question) || /(?:怎么|如何|为什么|能不能|可以|能).{0,16}(?:摇|搅|过滤|分层|混匀|捣|干摇)|(?:摇|搅|过滤|分层|混匀|捣).{0,16}(?:怎么|如何|为什么|可以吗|行吗)/.test(question);
}

export function requestsRecommendation(question: string) {
  return /推荐|选.{0,4}(?:杯|酒)|换一杯|(?:能|可以)做什么|(?:能|可以)调什么|做哪杯|找.{0,4}(?:酒|配方)/.test(question);
}
