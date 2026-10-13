# 后端操作手册

核对日期：2026-10-14。配置名称以 [.env.example](../.env.example) 为准，版本以 `package-lock.json` 为准。

## 环境与启动

使用 Node.js 22.12+。执行 `npm ci`（自动生成 Prisma Client），再用 `cp -n .env.example .env.local` 创建配置。已有配置不要覆盖。

| 配置 | 用途 |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | 同一 PostgreSQL 数据库的应用连接与迁移直连 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 登录的公共配置 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL` | 服务端聊天模型；示例模型须在自己的账户可用 |
| `RAG_EMBEDDING_*` | 独立嵌入服务，需匹配 1024 维索引 |
| `KNOWLEDGE_SEARCH_PROVIDER` / `DEEPSEEK_SEARCH_MODEL` | 联网检索；默认 DeepSeek，Tavily 需另配 key |
| `ADMIN_EMAILS` / `TEST_EMAILS` | 服务端管理员及内部测试身份配置 |
| `AI_REQUESTS_PER_MINUTE` / `AI_REQUESTS_PER_DAY` / `AI_CONCURRENT_REQUESTS` | 共享请求配额，默认 6 / 60 / 1 |
| `CRON_SECRET` | 部署环境每日详情清理任务的认证 |
| `APP_URL` | 开发环境 `http://localhost:3003`；部署时填写实际域名 |
| `ASSISTANT_RUNTIME` | 默认 `sdk`；`legacy` 使用兼容界面 |
| `AGENT_EXPERIMENT_ENABLED` | 独立实验入口开关，不控制默认流式助手 |

聊天提供商由当前代码固定使用 DeepSeek，`AI_PROVIDER` 不是可用的供应商切换开关。服务端密钥不得使用 `NEXT_PUBLIC_` 前缀。后台优先使用可信 `app_metadata.role=admin`；不能通过浏览器自行设置管理员身份。

`npm run dev` 在 3003 端口启动。生产预览执行 `npm run build` 后 `npm run start`，端口 3001；相应调整认证回调和 `APP_URL`。

## 数据库与知识初始化

```bash
npm run db:status
# 审查目标库及全部待执行迁移后
npm run db:deploy
```

`db:*` 包装脚本加载项目环境配置。迁移应用全部 pending 项，已有库出现漂移时先核对历史，不使用 reset 解决。数据库需支持 pgvector，服务端连接需具备相应权限。

新测试库按需加载 `prisma/seed.ts` 与 `prisma/seed-inspiration.ts`。这些脚本写入数据；直接 Prisma/tsx 命令不会自动按 Next.js 规则加载 `.env.local`，应由运行环境注入数据库变量。不要把种子初始化放进每次启动或生产构建。

```bash
npm run rag:status
# 嵌入配置及目标确认后，生成并写入知识向量
npm run rag:ingest
```

知识入库会调用嵌入服务并产生费用。入库后核对版本和 embedding profile。管理员在 `/admin/rag` 查看知识，在 `/admin/knowledge` 审核发布，在 `/admin/evaluations` 执行当前 Agent / RAG 测试。

## 验证与排障

命令分类、最近结果和真实测试前提统一见[验证说明](verification.md)。

| 现象 | 检查方向 |
| --- | --- |
| 401 / 403 | 登录 cookie、Supabase 配置及可信管理员身份 |
| 400 / 413 / 415 | 消息格式、大小及 JSON Content-Type |
| 429 | 共享请求配额和并发租约 |
| 索引未就绪 | 知识版本、向量维度、embedding profile 与迁移 |
| 没有足够证据 | 检查知识覆盖和适用范围，不将阈值下降当通用修复 |
| 503 / 超时 | 模型权限、服务配置、数据库连接和请求日志 |

## 发布与回退

发布前完成本地检查，再在目标环境验证登录、模型、检索、权限和材料交接。真实服务需要独立验收，离线通过不代表生产可用。Vercel 配置见 [vercel.json](../vercel.json)。

设置 `ASSISTANT_RUNTIME=legacy` 并重新部署可回退界面；这不会撤销数据库迁移，也不会停止 SDK API 兼容。涉及知识文件或嵌入配置回退时需检查索引匹配。历史部署记录见[流式助手切换记录](archive/agent-streaming-release-2026-09-24.md)，不作为当前线上状态证明。
