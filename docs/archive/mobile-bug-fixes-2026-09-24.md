# 移动端 Bug 与 Agent 会话修复报告

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

状态：用户明确确认后，生产迁移已成功执行，Vercel 生产部署 READY，正式域名 https://alchemix-lab.vercel.app 。部署 ID：dpl_Ao5ptzsW2atvCLMEzUbpd5sW3ecf。原有未提交的后台/RAG 工作已保留，没有重设计 UI。

## 1. 根因与修复

### 调酒助手及澄清续接

已确认：通用 L3 clarification 分支没有可靠建立 pending；同页上下文更新会清除 pending；下一轮短回答因此可能再次分类或单独检索。部分 catch 只返回通用错误，缺少真实原因。这些是代码缺陷，但不能据此断言它们就是用户当次生产请求失败的唯一原因。

现在 clarification 保存原问题、awaitingField、slots、配方作用域。L2 优先续接短回答，合并原问题和用户事实；取消、导航、新问题有独立处理。服务端按规范 ID 重读配方，包含名称、材料、用量、完整要求及 method。同页收起重开保留会话；刷新开始新会话并显示提示；切换酒谱隔离状态。失败保留重试，日志记录 requestId、阶段、HTTP/业务错误码和脱敏错误原因。

“我烧酒倒多了怎么办”现在进入已有的用量调整流程，先展示当前配方并询问实际用量，不把标称配方当成已倒入量。补充用量后进入可编辑实验参考；不记得用量时不计算。参考调整并非经过实验验证的最佳补救比例。

实测本机现有 MiniMax-M2.5 配置：原 900 token 和 1600 token 都返回 HTTP 200、tool_calls，因此保留原 900 token，未凭猜测增大额度。Vercel Production 变量清单有 MINIMAX_API_KEY、MINIMAX_API_URL、MINIMAX_MODEL；没有导出生产密钥。近 24 小时错误日志查询无可用记录，原生产失败的精确提供商原因尚未证实。完整检索重放另发现：烧酒补救问题可能因本地证据弱、联网来源过滤而无依据，这不是 API Key 失败。

### 搜索重复

已确认：人工精选和生成配方只按 ID 去重；种子数据还包含同配方不同后缀记录。名称不是身份。

新增标准材料别名、core ingredient key、测量配方 canonical key、旧 ID 映射。便利店展示合并相同核心组合；有详细用量的酒谱按类型、材料、用量、单位、做法区分，保留真正不同的比例/做法。搜索返回前去重；旧链接与助手均解析规范 ID。

迁移软合并数据库配方，保留旧 ID 与快照，设置 canonical_recipe_id、隐藏重复展示，迁移收藏和酒记引用。种子导入使用 canonical key，取消先删后重建酒谱的行为。隔离测试库装入当前 801 条种子后，得到 197 个规范配方、604 条别名；这不是生产库执行结果。

### 收藏不同步

已确认：记录弹窗的收藏只是 local state，只有保存酒记时才存入酒记布尔字段；个人收藏读取另一张表。原收藏 API 每次新建 recipe output，userId + outputId 唯一约束不能防止重复收藏；部分入口没等请求成功就显示成功。

现在收藏独立调用 API；服务器以 userId + recipeKey 唯一保存，并用事务锁处理并发重复点击。成功后广播刷新，取消收藏同样同步；失败显示错误。规范 recipeId 与输出记录 id 分开。前端不再自动导入无账号归属的旧收藏缓存，并避免旧查询覆盖最新状态。

### 评价时机

评价移至最后一个可评价答复：空闲 60 秒或明确结束时显示；输入中、请求中、澄清和失败时不显示。当前任务提交评价后不再重复展示。手机浏览器以受控计时器验证，不需真实等待 60 秒。

## 2. 本轮文件及用途

| 文件 | 修改 |
|---|---|
| src/lib/agent/companion-contract.ts | method、通用 pending 协议 |
| src/lib/agent/companion.ts | clarification 写回、合并任务、错误诊断、结束语 |
| src/lib/agent/intent-funnel.ts | L2 续接和新任务优先级 |
| src/lib/agent/consultation.ts | 澄清事实与制作排障衔接 |
| src/lib/agent/adjustment.ts | 倒多场景、实际量澄清、不确定与新问题处理 |
| src/lib/agent/workflow-catalog.ts | 旧 ID 解析和服务端配方做法 |
| src/lib/agent/diagnostics.ts | 脱敏真实错误记录 |
| src/lib/agent/preparation-provider.ts | 非流式协议、HTTP/业务错误信息 |
| src/lib/knowledge/rag/providers.ts | 连接错误日志和业务错误码 |
| src/components/assistant/AssistantProvider.tsx | 会话保存、刷新提示、延迟评价 |
| src/components/assistant/DeferredTaskFeedback.tsx | 空闲计时、输入隐藏、任务去重 |
| src/components/assistant/TaskFeedback.tsx | 提交成功通知 |
| src/app/ask/page.tsx | 延迟评价、新对话更新任务 ID |
| src/lib/recipes/identity.ts | 材料、配方、收藏身份规则 |
| src/lib/recipes/canonical.ts | 种子和便利店旧 ID 统一 |
| src/lib/recipes/favorites-store.ts | 事务收藏持久化与并发唯一性 |
| src/lib/recipes/favorites-client.ts | 收藏 API 与刷新事件 |
| src/lib/data/explore-catalog.ts | 展示去重、旧链接兼容 |
| src/app/api/inspiration/recipes/route.ts | 搜索结果去重 |
| src/app/api/saved-cocktails/route.ts | 规范身份、持久化、校验错误 |
| src/components/DrinkLog.tsx | 独立收藏、服务器状态、取消与错误 |
| src/App.tsx | 收藏刷新、等待 API、移除自动缓存导入 |
| src/components/AssistantScreen.tsx | 稳定收藏 ID、去重、等待成功 |
| src/components/InspirationScreen.tsx | 旧链接兼容、改良配方收藏等待成功 |
| src/components/LabScreen.tsx | 收藏成功后才显示成功 |
| src/types.ts | SavedCocktail.recipeId |
| prisma/schema.prisma | 收藏身份、规范配方与别名模型 |
| prisma/migrations/20260923130000_recipe_favorite_identity/migration.sql | 原子迁移、引用归并、唯一索引 |
| prisma/seed.ts、prisma/seed-inspiration.ts | 规范身份导入、保留旧记录 |
| src/lib/agent/conversation-repair.test.ts | 多轮澄清、短答案、取消、新任务、倒多回归 |
| src/lib/recipes/identity.test.ts | 双语材料、比例差异、旧 ID、重复收藏身份 |
| scripts/check-favorites-local.ts | 隔离数据库迁移与收藏生命周期 |
| scripts/check-recipe-migration.ts | 仅允许隔离本地地址的迁移演练 |
| scripts/check-mobile-fixes.mjs | 手机界面会话、评价与收藏测试 |
| scripts/check-model-protocol.ts、scripts/diagnose-agent.ts | 提供商协议及指定问题重放 |
| package.json | 纳入配方身份测试 |

## 3. 数据库、配置与发布

需要 migration；新增 user_saved_recipes.recipe_key 和 UNIQUE(user_id,recipe_key)，保留原 output FK；新增 recipes.canonical_key 唯一索引、canonical_recipe_id 自关联和 recipe_aliases。默认 legacy key 只为发布切换期兼容旧服务，正常写入必须走规范身份函数。

没有新增运行必需环境变量，不需要添加新的 Vercel 密钥。LOCAL_TEST_DATABASE_URL、DIAGNOSTIC_QUESTION、DIAGNOSTIC_RECIPE 仅为测试参数。

生产迁移会更新配方发布状态、收藏和酒记引用，并删除重复的收藏关联；不删除 recipe output、旧酒谱或酒记快照。自动审批曾拒绝生产事务演练；用户随后明确确认上线流程，现已成功执行迁移并部署。

获得生产迁移/发布批准后执行：

```sh
node --import tsx scripts/database.ts deploy
npx prisma generate
npm run typecheck
npm run lint
npm run build
vercel --prod
```

现在无需用户手动操作。执行后仍需真实账号线上验收。

## 4. 验证及手工验收

- typecheck、lint、生产 build 已通过。项目 lint 实际是 tsc --noEmit，不包含 ESLint。
- 完整测试 179 项通过；Vercel 云端生产构建通过。
- 本地 PostgreSQL：迁移签名与 JS 一致、收藏引用合并、酒记引用迁移且快照保留、五个并发收藏只产生一个 output、重连持久化、用户隔离、取消收藏均通过。
- 390px 浏览器：同页收起/重开、规范配方上下文、空闲评价、输入隐藏、已评价去重、刷新提示、独立收藏及取消通过。此处 HTTP 为受控测试响应，数据库另行真实测试，不冒称生产端到端验收。

手工验收：

1. 打开青柠气泡烧酒→助手→“我烧酒倒多了怎么办”：显示本杯配方，询问实际量；回复具体 ml 或“不确定”，不出现通用处理失败。
2. 澄清问“怎么操作”后收起重开，回复“搅拌”：继续原问题；问新问题或取消不被当旧 slot；刷新显示新会话提示。
3. 搜索“橙汁”：相同伏特加橙汁不重复；旧 cv-vodka-orange-juice 链接能打开；不同真实比例/做法保留。
4. 记录这一杯→收藏→直接关闭（不保存酒记）→我的收藏酒单：存在；刷新及重新登录仍存在；取消后两处同步。
5. 收到答复后不立即出现评价；空闲 60 秒或明确结束才出现；开始输入隐藏；澄清/错误不显示。

## 5. 未解决或需观察的相关风险

- 原线上失败未拿到对应 requestId/provider 日志，不能声称已查明唯一生产根因；新日志用于定位再次发生的故障。
- RAG 对部分补救场景仍缺证据，不能保证所有问题都有完整建议。未放宽可信来源规则。
- 旧酒记保存仍有独立的乐观保存/缓存导入逻辑，本轮收藏已与之解耦，未扩大改写酒记功能。
- 便利店摘要只有核心材料，没有完整配比时按组合归一；未来新增真正不同的同材料变体必须提供完整配比身份。
- 跨刷新会话恢复本轮明确不实现。/ask 是已有旧版独立流程，本轮主要修复酒谱详情的 v2 同页会话。

## 后续：材料名误识别修复

用户截图中的“我加了”来自实际用量解析仅接受材料在数字前，误将句子前缀作为材料。`adjustment.ts` 现在支持“我加了烧酒60ml”和“我加了60ml烧酒”，无材料名称的数字继续澄清；`material-identity.ts` 阻止动词片段进入材料映射。新增双向语序、多个材料、无名称用量和实际 prefill 回归。相关测试 76 项通过，typecheck/lint/build 均通过。无需数据库迁移或配置修改。
