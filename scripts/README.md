# 脚本导航

优先使用 [package.json](../package.json) 中的命令。环境与数据库操作见[操作手册](../docs/backend-operations.md)，验证前提见[验证说明](../docs/verification.md)。

| 分组 | 文件 | 用途 |
| --- | --- | --- |
| 数据与知识 | `database.ts`、`rag.ts` | 迁移状态、迁移部署、知识入库与检查 |
| 当前助手 | `evaluate-agent-next.ts`、`check-agent-next-browser.mjs`、`check-agent-rollout-*.mjs` | SDK 引擎、流式 UI 和正式协议验收 |
| 专项回归 | `check-agent-beer-alternatives.ts`、`check-agent-missing-mixer.ts`、`check-agent-flavor-followup.ts`、`check-agent-material-return-live.mjs` | 候选酒款、缺料、搭配及材料交接 |
| 管理后台 | `check-admin-console.mjs` | 权限、反馈、留存与界面检查 |
| 收藏及移动端 | `check-favorites-local.ts`、`check-recipe-migration.ts`、`check-mobile-fixes.mjs` | 配方身份和 UI 回归 |
| 插画 | `sync-cocktail-illustrations.ts`、`check-cocktail-illustrations.mjs` | 资产映射、覆盖检查和截图 |
| 模型诊断 | `check-deepseek-search.ts`、`check-model-protocol.ts` | 提供商搜索与协议检查 |
| 兼容引擎 | `evaluate-companion.ts`、`evaluate-preparation.ts`、`evaluate-acceptance.ts`、`diagnose-agent.ts`、其余 preparation / companion / conversation 检查 | 旧引擎和共享能力回归，不能代替默认 SDK 验收 |
| 发布辅助 | `release/` | 部署环境同步；不是普通启动步骤 |

部分脚本直接连接真实服务、创建测试账号、写库或调用付费模型。执行前阅读脚本的环境变量与目标地址；不要批量执行整个目录。生成报告通常写入 `artifacts/`，默认不纳入新的 Git 提交。
