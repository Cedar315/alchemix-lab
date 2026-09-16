import { RagError } from '../knowledge/rag/core';
export function failure(error: unknown, aborted = false) {
  const code = aborted || (error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)) ? 'TIMEOUT'
    : error instanceof RagError ? error.code
    : error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError') ? 'INVALID_MODEL_OUTPUT' : 'PROVIDER_ERROR';
  const messages: Record<string,string> = {
    INDEX_NOT_READY:'知识库正在更新，暂时无法检索，请稍后重试。',
    TIMEOUT:'这次回复等得有点久，请再试一次。已确认的材料会保留。',
    NOT_CONFIGURED:'助手的模型配置尚未完成，请联系管理员。',
    INVALID_MODEL_OUTPUT:'助手这次返回的内容格式有误，请再试一次。已确认的材料会保留。',
    PROVIDER_ERROR:'暂时连接不上模型服务，请稍后重试。已确认的材料会保留。',
  };
  return { code, message: messages[code] || messages.PROVIDER_ERROR };
}
