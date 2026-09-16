# 后端操作手册

更新：2026-09-14。适用于当前本地代码；未声明生产已部署。以下命令按影响分开执行，不要把迁移、入库、付费评估放进普通启动流程。

## 操作总览：用途、前置条件与结果

按当前实现操作。首次配置完成后按需进行迁移、入库和测试；不要默认每次启动都重新写库或调用付费模型。

| 操作／用途 | 前置条件 | 执行方式 | 预期结果 | 失败处理 |
| --- | --- | --- | --- | --- |
| 安装依赖，准备开发 | 项目根目录，锁文件可用 | `npm ci` | 依赖安装及 Prisma client 生成成功 | 检查安装输出与运行环境，不盲目改锁文件 |
| 配置本地服务 | 已有环境文件先保留 | 按下一节填写本地变量 | 数据库、认证和提供商指向预期环境 | 检查变量缺失或示例值，不打印密钥 |
| 查询迁移状态 | 配置可连接目标数据库 | `npm run db:status` | 显示迁移状态或待执行清单 | 区分 pending 与连接错误 |
| 部署迁移 | 目标已核对、pending 已审查、恢复方案明确 | `npm run db:deploy` | 所有待执行迁移应用成功 | 保存脱敏日志，核对迁移历史，不 reset |
| 查看知识索引 | rag_chunks 已部署，服务端有读权限 | `npm run rag:status` | 输出维度、RLS、数量和版本分组 | 缺表查迁移，版本问题按入库流程处理 |
| 更新知识索引 | 条目已审核，嵌入配置有效，确认目标写入 | `npm run rag:ingest` | 事务提交新索引；再查 status 核对 | 核对是否提交和版本，避免盲目重复付费调用 |
| 启动与登录验证 | 本地配置、迁移和所需索引就绪 | `npm run dev`，登录后访问 `/ask` | 当前独立助手可用，业务状态与回答一致 | 根据 HTTP、业务状态和 requestId 排障 |
| 管理员诊断 | 可信管理员身份 | `/admin/rag` 分别检索、问答 | 可查看真实召回和回答依据 | 403先查权限，查询失败查索引／服务 |
| 离线与真实验收 | 依下表区分环境、费用及写入 | 使用第4节相应命令 | 报告说明版本、样本和失败项 | 保存失败案例，不把局部复测当整组通过 |
| 发布／回退 | 配置、迁移、索引及版本已核对 | 按第6节的部署流程 | 工作流及助手抽查符合预期 | 回退时对齐知识、配置和索引 |

本表是执行导航；配置、脚本影响和排障细节以下文为准。
## 1. 环境准备

从项目根目录执行 `npm ci`，复制 `.env.example` 为 `.env.local`（已有文件不要覆盖），填写配置。不要在终端、截图或问题单打印真实连接串与密钥。

| 配置 | 用途 |
| --- | --- |
| DATABASE_URL | 应用数据库连接；按托管环境配置连接池 |
| DIRECT_URL | Prisma 迁移直连；需对应同一目标数据库 |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | 浏览器认证公共配置 |
| MINIMAX_API_KEY / MINIMAX_API_URL / MINIMAX_MODEL | 服务端生成模型，按实际账户填写 |
| RAG_EMBEDDING_API_KEY / RAG_EMBEDDING_URL / RAG_EMBEDDING_MODEL | 服务端嵌入，支持 1024 维 |
| RAG_MIN_SIMILARITY | 默认实验阈值 0.5，范围 0–1 |
| ADMIN_EMAILS | 可选管理员邮箱列表；优先可信 app_metadata.role |
| AI_REQUESTS_PER_MINUTE / AI_REQUESTS_PER_DAY / AI_CONCURRENT_REQUESTS | 默认 6 / 60 / 1，正整数 |
| APP_URL | 本地通常 http://localhost:3001 |

服务端密钥不能加 NEXT_PUBLIC_ 前缀。项目的部分 CLI（database、evaluate）按开发模式加载 Next 环境文件；rag CLI 按 NODE_ENV 判断。生产操作优先由部署环境显式注入变量，并确认没有意外读取本地配置。Prisma 直接命令不等于自动读取 `.env.local`。

## 2. 数据库检查与迁移

```bash
npm run db:status
```

只读检查；有待执行迁移时退出非零不一定是连接故障。检查目标环境、备份／恢复方案、全部 pending migration 内容，再在预期数据库执行：

```bash
npm run db:deploy
```

此命令部署所有待执行迁移，不只 RAG。生产流水线已经注入正确配置时可用 `npm run db:migrate:deploy`。已有库若无迁移基线或报告 drift，先核对历史，不能直接 reset、db push 或伪造已应用状态。

确认 pgvector、rag_chunks、ai_request_leases 及 RLS／服务端权限存在。配额缺表会拒绝 AI 请求，不会自动跳过。迁移失败先保存脱敏错误与迁移状态，评估前向修复或备份恢复；没有通用的一键回滚命令。

## 3. 入库与服务验证

```bash
npm run rag:status
npm run rag:ingest
npm run dev
```

ingest 会写索引并产生嵌入费用。先在测试环境校验知识 schema 与来源，入库后核对数量、dataset_version、embedding_profile。管理员登录后可访问 `/admin/rag` 查看检索与问答；权限来自服务端身份，不是在客户端填管理员标志。

普通用户登录后访问 `/ask` 测试当前助手；新浮窗在两类详情和实验室内测试，接口版本为2。发送问题后检查 HTTP 与业务 status、引用和 requestId。不要仅凭页面出现文字认定模型成功。

## 4. 验证命令与影响

| 命令 | 影响／前置条件 |
| --- | --- |
| npm test | 离线测试；包含历史 Agent 和当前制作助手 |
| npm run test:agent / npm run test:rag | 单独离线套件 |
| npm run typecheck / npm run build | 类型／生产构建；构建需要项目所需配置 |
| npm run test:rag:live / npm run eval:rag | 真实数据库和模型，有费用 |
| npm run eval:agent | 悬浮助手 v2 的5条真实冒烟，有费用；报告文件包含时间戳 |
| npm run eval:agent:preparation | 兼容 v1 制作助手真实评估，有费用；会覆盖旧同名报告 |
| npm run eval:agent:legacy | 历史 Agent 评估，不作为当前验收 |
| npm run test:budget:live | 写入临时数据库用户与租约并清理，不创建 Supabase 登录账号 |
| npm run test:browser | 需运行站点及 Chrome CDP 9222；浏览器问答部分用 fixtures |

v2 浏览器脚本默认访问 3003，可设置 BROWSER_TEST_ORIGIN；使用 `npm run start -- --port 3003` 启动对应预览。兼容 v1 浏览器脚本为 `npm run test:browser:preparation`，默认3001。仅在本机测试 Chrome 调试端口；需要独立浏览器配置目录。浏览器 fixtures 通过不证明真实登录与真实模型正确，必须与真实服务报告分开解读。保存报告时附提交版本、模型、配置版本和测试日期，避免后续运行覆盖唯一证据。

生产预览使用 `npm run build` 后 `npm run start`，默认 3001；与开发服务避免端口冲突。

## 5. 排障

| 现象 | 检查／处理 |
| --- | --- |
| 401 / 403 | 登录 cookie、Supabase 配置；管理员可信元数据或白名单 |
| 400 / 413 / 415 | 请求 schema、字符上限、JSON Content-Type |
| 429 | 共享滚动配额与并发租约；等待窗口恢复，勿无限重试 |
| INDEX_NOT_READY | 当前知识版本、嵌入配置、数据库索引一致后重新入库 |
| no_evidence | 先查召回与适用范围；不是一律降低阈值 |
| insufficient_evidence | 问题要求超出资料，补充证据或保留限制 |
| HTTP 200 但 unavailable / timeout | 仍是业务失败；按 requestId 查工具耗时与错误码 |
| INVALID_PROTOCOL | 模型输出不符 schema；查看脱敏日志并加回归样本 |
| 数据库或提供商 503 | 连接／权限／账户模型配置；保留输入供用户重试 |
| 入库超时 | 大批量用 CLI；核对事务是否提交，再决定重跑 |

当前日志不能完整统计跨 RAG 的所有 token 成本，也没有任务完成率仪表盘。记录失败类型，不把技术失败归为用户不满意。

## 6. 发布与回退

先通过离线、类型构建、真实小样本、人工引用审查和登录浏览器验收；再确认目标迁移、索引及配置一致。发布后抽查 requestId、错误率、延迟和功能跳转。

应用回退若涉及知识文件或嵌入模型，必须恢复匹配索引。保留原有工作流可用路径；新助手异常时应可关闭入口，不阻断选酒或实验室。入口开关属于待实现发布能力，当前不能宣称已有。

## 知识审核操作

2026-09-15 新增 `/admin/knowledge` 与 `/api/admin/knowledge`。配置、迁移前置条件、发布/撤回/合并和失败处理见[知识收集与发布](knowledge-learning.md)。已于本轮应用知识审核迁移；应用尚未部署生产，搜索密钥尚未配置。

`npm run test:knowledge` 执行离线知识闭环检查；`npm run test:knowledge:live` 使用当前数据库和向量服务，在事务中验证发布与撤回并回滚测试记录，不留下正式知识。后者需可用数据库/嵌入服务，会产生一次向量调用。
