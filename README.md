# AlcheMix Lab

以材料选酒、调配实验室、经典酒与便利店配方、酒记为主流程的调酒应用。AI 用于理解求助和检索制作知识。

当前代码已接入经典详情、便利店详情和实验室的悬浮助手，支持真实酒单、材料交接及任务隔离。首页保留工作流入口；`/ask` 和原请求协议兼容保留。实现边界及验证证据见 [悬浮助手实现说明](docs/companion-implementation.md)，本地实现不等于生产已部署。

## 本地启动

```bash
npm ci
cp -n .env.example .env.local
npm run dev
```

在本地填写环境配置后访问 http://localhost:3001。不要覆盖已有 `.env.local`，不要提交密钥。数据库迁移、知识入库和真实模型调用是独立操作，见 [后端操作手册](docs/backend-operations.md)。示例模型配置需要按账户实际开通情况填写。

## 文档与验证

从 [文档导航](docs/README.md) 阅读当前状态、产品需求、完整流程、接口和验证计划。

```bash
npm test
npm run typecheck
npm run build
```

这些命令不能替代真实服务、人工答案审查和浏览器验收。`npm run lint` 当前实际执行 TypeScript 检查。开发前遵守 AGENTS.md，涉及 Next.js 代码先读 `node_modules/next/dist/docs/` 对应指南。

### 2026-09-16：问答知识审核

助手现在在手机页面容器内聊天；发现页返回初始首页；问答知识支持 RAG 不足后联网、自动待审、管理员发布。审核入口 `/admin/knowledge`，默认复用 `MINIMAX_API_KEY`，由 MiniMax-M3 执行联网搜索。部署及限制见 [知识闭环说明](docs/knowledge-learning.md)。
