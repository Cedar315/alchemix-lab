# AI SDK 独立助手原型

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

后续：用户试用后明确要求上线，正式切换与回退记录见 [2026-09-24 发布说明](agent-streaming-release-2026-09-24.md)。以下保留原型阶段结论及失败记录。

2026-09-24。分支：`experiment/ai-sdk-agent`。阶段结论：基础设施原型已接通，行为验收未通过，不能替换正式浮窗。

## 试用

- 本地入口：`http://localhost:3003/ask/experimental`，需要原有账号登录。
- 原版：`/ask`，正式页面浮窗继续使用 `/api/agent`。
- `.env.local` 已开启 `AGENT_EXPERIMENT_ENABLED=true`；`.env.example` 默认关闭。页面与 API 都检查开关，无需迁移数据库。
- 继续读取现有 `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL` 及 RAG 配置。没有新增凭据体系。
- 新入口刷新后清空对话；没有自动长期记忆。页面背景可以在入口中填写。

## 实现边界

锁定 `ai@7.0.113`、`@ai-sdk/react@4.0.116`、`@ai-sdk/deepseek@3.0.52`。Zod 更新到兼容的 3.25.76；原有 Zod 3 代码保持兼容。

按照 [AI SDK 消息接口](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)、[DeepSeek 适配器](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek) 和 [Vercel Chatbot 路由](https://github.com/vercel/chatbot/blob/main/app/%28chat%29/api/chat/route.ts) 的方式使用 `useChat`、`DefaultChatTransport`、`streamText`、`toUIMessageStream`。没有引入 Chatbot 的 Auth.js、Neon 或 Blob。

一个主模型自主选择六个工具，最多五次模型步骤，最后一步只允许回答；45 秒请求超时、关闭自动模型重试、不开思考模式。没有关键词业务分流、规划模型、复核模型、句子过滤器或多 Agent。

| 工具 | 复用与限制 |
| --- | --- |
| `get_recipe` | `workflow-catalog` 的真实 ID、配方背景、页面链接；不存在的配方返回未找到。 |
| `find_recipes` | 原有材料匹配与缺一种材料匹配；材料种类匹配不表示数量、冰与器具齐备。 |
| `search_knowledge` | 直接调用 RAG `retrieve`，返回文档、来源及适用范围，不调用旧回答生成链。 |
| `search_web` | DeepSeek 服务端搜索与正文读取，沿用来源域名校验、查询脱敏；不入库或发布。 |
| `calculate_adjustment` | 当前仅做液体相加与容量比较；数值需附用户原话，区分估计与未知。未计冰占空间，不推断风味。 |
| `preview_lab_change` | 生成材料用量预览；点击确认后使用原实验室 transfer 协议，有旧草稿则二次确认。 |

沿用 Supabase/Prisma 登录、Postgres 额度租约和 `recordTurn` 日志；日志 surface 为 `agent-experimental`。流结束或断开时释放租约，不在开始返回 HTTP 流时释放。未登录请求实测返回 401。

短期上下文目前是有序用户/助手消息和页面背景，没有 adjustment/rescue 等 pending 分支。SDK 工具状态在界面保留；跨轮发送给模型的历史仅保留文字，防止客户端伪造工具结果被当作服务端证据。工具结果的服务端持久化、可验证重放以及结构化事实/纠正快照尚未实现，这是正式迁移前的工作，不应把当前原型视为最终状态层。

## 验证与已知失败

- 现有测试：193 项通过。
- 新工具测试：6 项，覆盖未知量、伪造引用数值、估计值、溢出、真实 ID 和工具范围。
- TypeScript 与 Next.js production build 通过。
- 浏览器模拟 SDK 流：消息、工具结果、真实配方链接、预览不自动应用、390px 宽度、新对话清空通过。截图：`artifacts/agent-next/mobile.png`。浏览器检查使用模拟登录和模型输出，不能代替登录后的真实端到端验收。
- 真实 DeepSeek 新旧对照：三类共七轮输入，保存完整回答、工具入参/结果、首字时间、总耗时和 usage。首轮新入口未带配方页背景，后续已修正脚本，使两边使用同一份页面背景并重跑。不同运行不得混成一个稳定成功率。

首轮记录：`artifacts/evaluations/agent-next-2026-09-24T13-22-20-304Z.json`。

相同页面背景复测：`artifacts/evaluations/agent-next-2026-09-24T13-27-18-653Z.json`。传输和工具调用能完成，但补救任务仍未通过用户约束与计算边界验收。

观察到的新版本优势：能给出酒库真实候选和继续制作步骤；一般指导不被空检索强制终止。旧版本在材料找酒中重复询问分类，在替换/补救中多次因资料不足停止。

仍然失败的行为（作为语义验收案例，不能改成固定句子拦截）：

1. 把“冰大概占一半”当成精确排水体积；计算工具返回 `needs_input` 后自行作出精确容量结论。
2. 用户说“不想加更多液体”，仍建议加柠檬汁，甚至声称酸不算补液。必须尊重约束，不能换个说法绕过。
3. 首轮补入用户未说拥有的糖浆，并重复问已经明确的酒名。
4. 首轮把自我评述输出为正文；SDK 隐藏 reasoning 部分无法阻止模型把它写进普通 text。

工具执行成功不等于回答质量通过。脚本退出码目前只反映新版本调用/传输错误；行为质量需阅读记录按事实正确性、约束遵守、任务推进和重复追问评估。

## 重跑

```sh
npm run test:agent:next
npm run eval:agent:next -- --compare
npm run typecheck
npm run build
```

对照会调用真实 DeepSeek/检索，产生费用，旧引擎仍可能执行其原有待审核知识收集。浏览器检查需独立 Chrome 调试端口 9233，再运行 `node scripts/check-agent-next-browser.mjs`。

下一阶段应先完善可验证的短期事实与工具结果记录，以及计算结果/用户约束的执行边界；保留完整失败对话进行复测。通过三类任务的重复运行后，再迁移浮窗并删除旧对话决策实现。本次没有部署或删除旧代码。
