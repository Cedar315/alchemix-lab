# AI 服务设计：现状与目标契约

更新：2026-09-14。当前行为依据本地代码；v2 已接入悬浮交互，v1 兼容保留。

## 1. 兼容 v1 运行链路

`/ask` → `POST /api/agent` → 登录与共享配额 → `runPreparation` → 意图识别／工具循环 → RAG → 结构化返回。

主要代码：[Agent](../src/lib/agent/preparation.ts)、[模型适配](../src/lib/agent/preparation-provider.ts)、[API](../src/app/api/agent/route.ts)、[RAG](../src/lib/knowledge/rag/service.ts)。历史 `core.ts` 等逻辑及旧评估仍在仓库，不代表生产路由使用它们。

### 产品场景与后端职责（v1 与 v2 对照）

| 产品场景 | 兼容 v1 | 当前 v2 处理与展示 | 不可用时处理 |
| --- | --- | --- | --- |
| 用户问制作知识 | Agent 调 RAG；独立 Ask 也可检索 | 生成有依据的回答，必要时澄清 | 区分证据不足和请求失败 |
| 用户问制作问题 | 当前 Agent 工具循环读取文本背景与知识 | 结构化当前酒、实际事实，提供适用解释 | 缺事实先问，不用原配方充当实际量 |
| 用户找功能 | 当前固定 handoff | 页面能力校验后返回定位／跳转动作 | 不生成任意链接 |
| 用户查已有配方 | 当前引导首页，recipes 为空 | 复用匹配，返回真实候选和具体酒单 | 零候选说明，不虚构 |
| 用户带材料进实验室 | 当前没有完整交接 | 返回受控预填动作，前端确认覆盖 | 目标／材料无效不执行 |
| 管理员维护知识 | Admin ingest/retrieve/ask 及 CLI | 校验版本、观察检索和回答依据 | 脱敏错误与 requestId 用于定位 |

展示以 [回复规范](agent-response-guidelines.md) 为准；v2 使用独立 schema，旧请求继续按下述兼容协议处理。
## 2. 兼容接口

| 接口 | 权限 | 输入 | 用途 |
| --- | --- | --- | --- |
| POST /api/agent | 登录 | question 1–1000 字符；context ≤2000；history ≤12 条，每条 ≤2000 | 当前制作助手 |
| POST /api/ask | 登录 | question 1–1000；context ≤2000；history ≤6 条，每条 ≤2000 | 独立 RAG 问答 |
| POST /api/admin/rag | 管理员 | action=ingest/retrieve/ask；非 ingest 需 question；context ≤2000；topK 1–5 | 知识维护和诊断 |

均要求 JSON。Agent、Ask、Admin 请求文本上限分别为 24000、18000、16000 字符；这是读取后的字符检查，不能宣传成流式字节防护。history 元素含 role=user/assistant 和 content，输入采用严格 schema。

兼容 v1 Agent 输入示例：

```json
{
  "question": "这杯应该怎么加冰？",
  "context": "当前配方：用户所选酒及原始材料",
  "history": []
}
```

兼容 v1 Agent 返回包含 `status、message、clarification、knowledge、calculations、handoff、trace、model、intent、recipes、requestId`，部分错误含 errorCode。v1 的 recipes 恒为空；推荐请求 handoff 到首页。固定目的地为 `/?tab=ASSISTANT`、`/?tab=LAB`、`/?tab=INSPIRATION`、`/?tab=MY`，v1 不支持三杯详情或材料预填；v2 见下文。

不能只判断 HTTP 200：业务 status 可能为 answered、needs_info、handoff、cancelled、insufficient_evidence、limit、timeout 或 unavailable 等。RAG answer 状态为 answered、insufficient_evidence、no_evidence。客户端必须依据业务结果呈现，不把超时当成功。

## 3. 当前运行保护

- Supabase `auth.getUser` 确认身份；管理员由可信 app_metadata.role 或 ADMIN_EMAILS 判定。
- `/api/agent` 与 `/api/ask` 共用 PostgreSQL 配额：默认滚动一分钟 6 次、滚动 24 小时 60 次、并发 1。失败请求也计数；数据库不可用时拒绝执行。
- 共享租约 70 秒，结束释放；代理内存限流只是补充，不能跨实例累计。Admin 不共用这套用户租约。
- Agent/Ask 共享 45 秒请求截止时间，路由 maxDuration 为 60 秒；Agent 单次模型调用 15 秒，RAG 单次提供商请求 20 秒。
- v1 工具决策最多 6 步，重复相同动作受控；意图协议解析失败最多修复重试一次，不进行无限循环。
- v1 容量计算要求本轮用户明确提供“容量 X ml、已有 Y ml、拟加 Z ml”的证据。结果只比较液体体积，不含冰，也不是口味或饮用安全保证。

HTTP 常见结果：401 未登录、403 无权限、400 参数错误、413 过长、415 内容类型错误、429 配额限制、503 服务不可用。具体以各 route 实现为准。

## 4. 悬浮助手 v2 接口（已实现）

同一 `POST /api/agent` 根据 `version: 2` 分流；缺少 version 时保持 v1。登录、共享配额、请求字符上限和45秒截止时间保持共用，无新增数据库迁移。

| 字段 | 约束与含义 |
| --- | --- |
| version | 固定2 |
| taskId、contextVersion | UUID任务ID、非负整数背景版本；响应回传，用于阻止迟到结果和旧动作 |
| question | 1–1000字符 |
| page | kind=classic/convenience/lab；recipeId、name、ingredients、note；严格校验 |
| page.ingredients | 最多30项；name为1–100字符；amount可省略，提供时为正数且≤10000 |
| history | 最多12条，每条role=user/assistant，content≤2000；取消前历史不再发送 |
| pending | null或category澄清状态，保存待分类的材料；不代表长期库存 |

服务端按真实目录重新解析配方背景；页面文本不能授权工具或写入。v2 一次意图识别，协议失败最多修复一次；明确取消和类别按钮回答可直接处理。明确酒单、搭配和库存列表有受控规则校正模型路由，仍使用同一业务目录。需要知识时最多一次 RAG 调用。

返回 `status、message、clarification、recipes、actions、knowledge、pending、taskId、contextVersion、trace、model、requestId`；usage仅服务端日志使用。status为answered、needs_info、handoff、no_results、cancelled、out_of_scope、unavailable或timeout；客户端还需检查knowledge的证据状态。

动作限为 navigate（固定目的地）、recipe（类别和真实ID）、locate（已注册能力）、prefill（材料）。模型不能提供任意URL或DOM选择器。客户端点击时再次校验任务版本及目标；预填已有编辑须明确确认。具体源码契约：[companion-contract.ts](../src/lib/agent/companion-contract.ts)。

v2 没有复制 v1 容量计算器；当前主要处理交接和依据检索。更细的结构化实际操作字段和完整成本埋点属于后续改进，不能宣称已完成。

## 5. 日志与退役接口

当前日志有 requestId、耗时、状态、模型、usage 和工具轨迹；Agent 的 usage 不保证覆盖嵌套 RAG 全部调用，因此尚不能直接得到完整任务成本。后续补充 taskId、入口、意图结果、候选数、动作点击与落地结果，避免默认记录完整对话、密钥及用户材料隐私。

`/api/assistant`、`/api/generate-tip`、`/api/ai/name-recipe`、`/api/ai/explain-taste`、`/api/ai/modify-classic`、`/api/ai/substitute-ingredient` 当前返回 410；不要再按旧设计调用。其他业务 API 不因这些接口退役而一并视为失效。

## 联网与审核接口修订（2026-09-15）

`POST /api/agent` v2 的知识依赖改为 `searchAndCollect`，v1 保持原 RAG。类别追问 `pending` 可带 `similarTo` 页面快照，用于相似酒推荐。新增管理员 GET/POST `/api/admin/knowledge`，精确参数与状态见[知识闭环](knowledge-learning.md)。
