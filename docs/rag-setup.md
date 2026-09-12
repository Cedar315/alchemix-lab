# RAG 后台与测试台

实现日期：2026-09-12。当前已完成代码和离线测试，尚未完成真实模型、数据库的端到端验证。现有用户推荐页面和旧问答接口不变，Agent 尚未接入。

## 已实现

- `/admin/rag`：管理员测试台，可入库、只检索、检索并回答。`/admin` 已加入口。
- `POST /api/admin/rag`：复用已有 `requireAdmin`，无匿名调用与数据库直连权限暴露。
- 12 条知识按条目入库，答案与适用边界共同生成向量；保留来源与核查日期。
- 百炼兼容 embeddings API，模型默认 `text-embedding-v4`，固定 1024 维，按 10 条分批入库。
- Supabase/Postgres pgvector 精确余弦检索，加关键词/别名匹配加权。当前为小型知识集，不需要近似索引。
- MiniMax 根据证据生成逐条结论，每条带证据 ID；服务器仅解析真实检索来源，拒绝伪造 ID 或回答内自造 URL。
- 无匹配不调用回答模型；证据不足单独显示。引用校验能保证来源 ID 合法，不能自动证明结论完全忠实，仍需人工评估。
- 内容版本和向量配置签名防止新旧索引混用；向量全部成功后，事务替换知识索引。失败保留旧索引。
- 参数校验、模型超时、错误降级、耗时、request ID、模型用量展示。未保存问题/回答到数据库，也尚无批量评估和人工评分持久化。

## 配置

将下面值写入本地 `.env.local` 或部署环境。不要提交真实密钥。

```dotenv
MINIMAX_API_KEY=你的密钥
MINIMAX_API_URL=你账户对应的完整聊天接口HTTPS地址
MINIMAX_MODEL=你账户已开通的文本模型
RAG_EMBEDDING_API_KEY=你的百炼密钥
RAG_EMBEDDING_URL=你地域对应的完整HTTPS向量接口地址，以/embeddings结尾
RAG_EMBEDDING_MODEL=text-embedding-v4
RAG_MIN_SIMILARITY=0.5
```

`MINIMAX_*` 与现有功能共用，修改前确认它们也使用相同模型。MiniMax 新接口不依赖旧代码的 `response_format`，使用 JSON 提示与严格响应校验。密钥、账户地域、endpoint 必须一致。

0.5 只是启动阈值，不是准确率保证。先在开发集调整，再在独立测试集报告结果。

管理员认证沿用 `ADMIN_EMAILS` 或可信 `app_metadata.role=admin`。用户自己可编辑的元数据不能授予管理员权限。

## 数据库

新增迁移：`prisma/migrations/20260912000000_add_rag_chunks/migration.sql`。

迁移创建 `rag_chunks` 和 `extensions.vector(1024)`，开启 RLS、不开放浏览器策略。服务端数据库账号需要具备访问该表的权限，沿用本项目既有服务端连接方式。若 vector 扩展位于其他 schema，迁移会明确失败；先审查数据库配置，不自动搬动其他业务的扩展。

在确认 `DATABASE_URL`/`DIRECT_URL` 指向目标开发数据库并审查所有待执行迁移后执行：

```sh
npm run db:migrate:deploy
```

此命令会执行所有待处理迁移，不仅是 RAG 迁移。当前没有替你执行远程数据库迁移，也没有修改线上数据库。

## 使用

1. 完成配置和迁移，重新启动本地服务。
2. 以管理员登录，打开 `/admin/rag`。
3. 点击“将当前知识入库 / 更新索引”（会调用真实向量服务、产生服务商费用）。
4. 先选“只测试检索”，检查正确资料是否出现。
5. 再选“检索并回答”，核对每个结论及来源。
6. 更新知识、embedding endpoint 或模型后需重新入库。改变维度必须同步迁移和代码，不能混用旧向量。

同一接口的请求格式：

```json
{"action":"ingest"}
```

```json
{"action":"retrieve","question":"换了糖浆为什么太甜？","topK":3}
```

```json
{"action":"ask","question":"为什么这杯太甜？","context":"按配方用了2:1糖浆","topK":3}
```

## 测试与现有限制

```sh
npm run test:rag
npm run typecheck
```

离线测试用明确的测试替身，不调用收费模型，覆盖：知识结构、请求边界、检索过滤、无命中不生成、引用校验、上下文传递、向量顺序/维度和供应商错误。

真实入库、数据库权限、中文向量质量、MiniMax JSON 输出稳定性、管理员浏览器操作仍需配置服务后验证；离线通过不能替代这些验证。

测试用例起点：糖浆浓度、橙味利口酒、气泡摇和、无关问题、知识没有覆盖的具体替代比例、要求编造来源、一次问多个不相关问题。人工判断引用是否支持结论，不把相似度当作正确概率。

后续 Agent 直接复用 `retrieve` / `ask`，无需重复建知识库。扩充到较大知识集时再做后台批量入库任务、检索索引优化与评估记录表。

## 接口依据

- MiniMax 文本生成：https://platform.minimax.io/docs/api-reference/text-post
- 百炼向量接口：https://help.aliyun.com/en/model-studio/text-embedding-synchronous-api
- Supabase pgvector：https://supabase.com/docs/guides/ai/vector-columns
