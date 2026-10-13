# AlcheMix Lab

面向家庭调饮新手的 AI 调酒应用：从现有材料找到配方，在实验室调整组合，通过流式助手处理缺料、搭配和制作问题，并用管理后台观察使用过程与评测结果。

[项目文档](docs/README.md) · [架构设计](docs/architecture.md) · [项目复盘](docs/project-notes.md) · [本地运行](docs/backend-operations.md)

## 核心功能

| 场景 | 当前实现 |
| --- | --- |
| 不知道喝什么 | 按材料找酒、心情探索、随机盲盒、经典酒和便利店组合 |
| 想调整配方 | 实验室编辑材料与用量，助手生成需用户确认的试配预览 |
| 缺料或制作遇到问题 | DeepSeek + AI SDK 流式对话，查询真实酒单、知识检索和受限联网 |
| 保存体验 | 登录、收藏、酒记与配方身份关联 |
| 验证 AI 产品 | 管理后台查看任务反馈、工具执行、RAG 证据、运行记录与人工评测 |

## 技术与设计

- **应用：** Next.js App Router、React、TypeScript、Tailwind CSS。
- **AI：** AI SDK 驱动单模型工具循环，六个业务工具；结构化回答经过校验后展示。
- **数据：** Supabase Auth、Prisma、PostgreSQL / pgvector，独立的向量嵌入服务。
- **边界：** 服务端鉴权与共享配额、可信配方 ID、材料来源校验、实验室操作由用户确认。
- **验证：** 离线回归、类型检查、生产构建，以及独立的浏览器和真实服务评测脚本。

当前默认助手位于 `src/lib/agent-next/`。`src/lib/agent/` 同时包含共享业务能力和兼容引擎，仍被引用；不能把整个目录当作重复代码删除。旧 Vite 原型已归入 `legacy/`。

## 本地启动

使用 Node.js 22.12+ 和 npm，准备 PostgreSQL（启用 pgvector）及 Supabase 项目。

```bash
npm ci
cp -n .env.example .env.local
# 在 .env.local 填写自己的服务配置
npm run dev
```

开发地址：<http://localhost:3003>。首次运行的数据库迁移、数据初始化、知识入库和管理员配置见[操作手册](docs/backend-operations.md)。完整 AI 功能需要有效模型与嵌入配置；仓库不包含密钥。

```bash
npm test
npm run typecheck
npm run build
npm run start
```

生产预览端口为 `3001`。`npm run lint` 当前是类型检查的兼容别名，并非独立 ESLint 检查。最近一次本地验证见[验证说明](docs/verification.md)。

## 仓库结构

```text
src/app/          页面、API 与管理后台
src/components/   产品界面与助手交互
src/lib/          Agent、检索、业务规则、认证与指标
prisma/           数据模型、种子与按时间排列的迁移
public/           运行时静态资源与酒单插画
scripts/          数据维护、评测与发布辅助脚本
docs/             当前文档；archive/ 保存历史决策与验收
legacy/           不参与当前构建的早期 Vite 原型
artifacts/        本地评测产物；历史已跟踪证据保留
```

## 项目边界

这是具备完整产品流程的项目实现。工具调用成功不等于建议正确；有效引用不等于结论完全被证据支持。当前没有长期用户记忆，也没有可支撑转化率、留存提升或降本比例的对照实验。后台会明确区分反馈覆盖、任务结果与技术执行状态。

文档以当前工作区实现为准；历史报告仅证明对应版本与样本。部署记录保存在历史目录，本次整理不代表线上版本已更新。
