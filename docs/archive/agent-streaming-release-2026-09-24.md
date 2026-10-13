# 流式助手正式切换 · 2026-09-24

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

用户在试用后明确要求替代旧版上线。本次将 AI SDK + DeepSeek 设为正式入口默认核心，保留旧引擎作为回退。此决定不表示原型中发现的语义失败已经全部修复。

## 切换范围

- 配方页、实验室浮窗使用 `StreamingConversation`，保留原浮窗样式、展开/收起、键盘焦点和原配方卡片。
- `/ask` 使用同一套流式对话组件；`/ask/legacy` 保留原完整聊天页。
- `/api/agent` 接收 SDK 消息并流式回复；没有 `messages` 字段的旧请求继续交给旧协议处理，兼容已经打开的页面。
- 试验入口仍受 `AGENT_EXPERIMENT_ENABLED` 控制；正式入口不依赖该开关。
- 配方页背景直接传入。页面背景变化时销毁旧对话并中断请求，避免旧预览在新页面应用。收起浮窗则保留对话与草稿。
- 实验室变更继续使用原 transfer 协议，只能由用户点击应用；有旧草稿时再次确认。旧消息预览在新一轮对话后失效。
- 流中携带 requestId，接入原反馈和运营日志。权限、额度及服务端密钥保持原有体系。
- Markdown 支持列表和表格；正文中的模型链接和图片不直接跳转/加载。配方卡片只使用站内 ID 解析出的入口，资料链接只来自工具证据。

## 验证

- 现有测试 193 项通过，新工具测试 6 项通过；TypeScript 和 Next production build 通过。
- 临时测试账号实际完成登录、两轮 DeepSeek 流式工具对话、SDK 工具/metadata 历史回传、额度租约释放、日志写入、旧 JSON 请求兼容。匿名 401、伪造 system 历史 400。账号和测试数据自动清理。
- 14 项浏览器检查通过：SDK 消息流、工具结果、原配方卡片、预览不自动应用、移动端宽度、新对话、当前配方背景、收起保留聊天、Markdown、旧草稿确认、429 重试不重复用户消息、停止不接收迟到回复、导航隔离、完整聊天页。
- 浏览器使用模拟模型输出；真实 API 测试单独进行。截图：`artifacts/agent-next/production-floating-mobile.png`。
- 语义复测记录：`artifacts/evaluations/agent-next-2026-09-24T13-38-22-201Z.json`。容量工具条件不足时现在会说明限制，但仍可能建议未确认材料、重复追问，或把少量苦精描述成不增加液体。未将这些失败隐藏成通过，也未加入句子拦截。

## 发布与回退

- 正式域名：`https://alchemix-lab.vercel.app`。
- 切换前部署：`https://alchemix-f1am4uptt-p-ei-xuan.vercel.app`，ID `dpl_CKqcY3PD9SsgQnq38tCtFTirasLy`。
- 已上线部署：`https://alchemix-om51rtpdu-p-ei-xuan.vercel.app`，ID `dpl_F2m4yEVsz11tfpqdvA7L5a3ZRUa8`。先使用 `vercel deploy --prod --skip-domain --yes` 构建，通过受保护候选部署的真实登录、两轮流式工具对话、额度释放和日志验证后，已成功 promote 到正式域名。
- 2026-09-24 13:52 UTC：正式域名 `/ask` 返回 200 且确认是新流式页面；玛格丽特配方页返回 200。
- 正式域名发布后真实验证全部通过：匿名 401、非法 system 历史 400、登录后 SDK 流与工具结果、携带 metadata/工具历史的第二轮、租约释放、日志写入、旧 JSON 客户端兼容。临时身份及测试数据已清理。
- 可以将 `ASSISTANT_RUNTIME=legacy` 后重新部署，恢复浮窗与 `/ask` 的旧核心；SDK API 仍兼容已经打开的新页面。
- 也可以用 Vercel 回退到上述切换前部署，恢复整个旧版本。本次没有执行数据库迁移。

```sh
npm run test:agent:next
node --import tsx scripts/check-agent-rollout-live.mjs
node scripts/check-agent-rollout-browser.mjs
```

真实检查可用 `AGENT_TEST_ORIGIN` 指定发布域名。需现有 Supabase 测试管理凭据，会创建并清理临时身份；真实模型调用产生费用。浏览器检查需 Chrome 调试端口 9233，可用 `BROWSER_TEST_ORIGIN` 切换地址。

受 Vercel 部署保护的候选域名另设 `AGENT_TEST_VERCEL=true`，检查脚本通过已有 Vercel CLI 授权通道访问，避免把平台的部署保护 401 误判为应用登录故障。不输出临时账号凭据、Cookie 或平台密钥。
