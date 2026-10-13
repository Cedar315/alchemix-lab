# 数据库与数据契约

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

更新：2026-09-14。实际字段以 [Prisma schema](../../prisma/schema.prisma) 和 [迁移目录](../../prisma/migrations) 为准；模型存在不等于所有页面已接入云端存储。

## 1. 当前数据模块

| 模块 | Prisma 模型示例 | 职责 |
| --- | --- | --- |
| 账号与偏好 | User、UserPreference | 应用身份与偏好 |
| 材料与商品 | Ingredient、Product、ProductIngredient、DataSource、FlavorProfile | 材料、品牌商品、来源和风味信息 |
| 配方体系 | Cocktail、CocktailIngredient、CustomizedRecipe、CustomizedRecipeItem | 母版及定制内容 |
| 经典变体 | ClassicCocktail、ClassicCocktailVariant、VariantIngredient、RemixTag | 经典配方及变体 |
| 通用配方 | Recipe、RecipeIngredient、Tag、RecipeTag、ClassicRecipeVariant | 另一组配方身份与关联 |
| 规则与输出 | SafetyRule、LabPairingRule、CocktailTemplate、RecipeOutput | 现有工作流规则与结果 |
| 用户行为 | DrinkLog、UserSavedRecipe、AnalyticsEvent、UserFeedbackFlavorAdjustment | 酒记、收藏、事件、反馈 |
| 知识索引 | RagChunk | 来源条目、版本、向量 |

数据库同时存在多组配方模型和本地数据源。不能把不同表中的同名字符串当成唯一身份，也不能假设全部页面使用同一张 Recipe 表。当前仍有本地状态及历史种子数据，接入助手前逐项审计材料、比例、分类与链接；生成式种子不能自动标记为权威配方。

### 数据服务的用户场景

| 用户场景 | 数据依据 | 使用策略 | 展示要求 | 异常与验收 |
| --- | --- | --- | --- | --- |
| 查找可做的酒 | 现有材料、配方及匹配结果 | 复用业务规则并保留来源身份 | 真实酒名、匹配理由、缺料事实 | 无法确认身份不造卡；A05–A07 |
| 打开具体酒单 | 配方来源、ID、路由映射 | 校验目标存在 | 与推荐一致的详情 | 名称相同不代表身份相同；A07 |
| 将材料带入实验室 | 用户选择或明确输入 | 不把缺失用量自动补齐 | 展示所带材料，覆盖前确认 | 编辑值不等于实际操作；A03、A04 |
| 当前酒缺料或故障 | 配方要求与用户确认事实 | 两类事实分开，检索对应条件 | 保留当前酒，解释适用范围 | 不继承另一杯的缺料；A08、A14、A20 |
| 查看回答依据 | 知识条目、来源、版本 | 引用与生成结果关联 | 可核对的来源 | 版本不匹配按技术错误处理；A15、A16 |
| 使用助手后记录一杯 | 用户主动进入原记录功能 | 仍由原业务处理写入 | 不把聊天内容自动存为酒记 | A18 |

页面助手使用共享目录和临时会话；2026-09-15 知识闭环新增 knowledge_candidates 与 knowledge_reviews，迁移和发布规则见[知识收集与发布](knowledge-learning.md)。
## 2. 配方读取：当前适配与后续统一契约

当前已抽取 explore-catalog.ts 并复用首页 matchDrinks；来源与详情由代码映射解析。下面是后续完整数据治理契约，尚未逐字段实现：source、sourceId、canonicalKey、category、displayName、ingredients、detailTarget、version、reviewStatus。字段名称可在实现中固定，但以下约束不变：

- 来源与 ID 联合唯一；显示名称仅用于展示与别名检索。
- 材料数量、单位、必需／可选项来自配方数据，不让模型补齐。
- 匹配和排序复用已有业务逻辑，不能另建 Agent 专用六杯列表。
- 详情目标由应用路由映射生成；缺有效详情、材料不完整或未通过必要审核的条目不得承诺“可直接制作”。
- 替换配方需注明差异，不能覆盖原始经典记录。

当前“页面 → 数据源 → 匹配函数 → 配方 ID → 详情路由”映射见 [实现说明](companion-implementation.md)；生产上线前仍需配方内容审核。具体统一到哪组表不在本轮擅自决定。

## 3. 知识与配额表

RagChunk 使用 PostgreSQL pgvector 的 1024 维向量，并保存 dataset_version、embedding_profile。通过原生 SQL 完成向量查询；当前为精确余弦检索，没有 ANN 索引。索引必须与当前知识文件和嵌入配置匹配，详见 [RAG](rag-setup.md)。

`public.ai_request_leases` 由 [独立迁移](../../prisma/migrations/20260912010000_add_ai_request_limits/migration.sql) 创建，不是 Prisma 模型。字段为 request_id、user_id、started_at、lease_until、finished_at；user_id 外键级联删除。事务锁保证同一用户申请配额的原子性。

这两类后台表不应作为浏览器直连接口。租约表启用 RLS 并撤销 anon/authenticated 权限；服务端连接需要适当权限。当前租约清理在该用户再次申请时删除其两天前记录，不是全库定时清理任务。

## 4. 用户事实与存储边界

配方值、实验室编辑值、实际制作值必须分开。酒记应保留当时的配方快照，避免后续配方变化改写历史。查看、搜索、收藏和实际喝过分别建模，不能把点击直接当成口味喜好。

悬浮助手的任务状态仅保存在当前页面内存中，尚无 Agent 长期记忆或库存表。不得自动把对话写成 DrinkLog、扣减库存或更新偏好。未来如需持久化，应先确定用户授权、保留时间、删除机制和最少字段，再增加迁移。

旧文档建议的 search_logs、lab_experiment_logs、user_interaction_logs、user_taste_profiles 并非全部已实现表；现阶段优先评估现有 AnalyticsEvent 是否够用，避免重复建设。
