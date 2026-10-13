# 验证说明

核对日期：2026-10-14。本次在 Node.js 24.21.0 的现有工作区执行；不是远端 GitHub 或线上部署的验收。

## 最近本地结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npm test` | 217 项通过，0 失败 | 包含默认 SDK 助手、兼容助手、RAG、后台、材料和配方身份测试 |
| `npm run typecheck` | 通过 | TypeScript 静态检查 |
| `npm run build` | 通过 | Next.js 生产构建完成，生成 59 个静态页面 |

默认测试命令显式包含全部 `src/lib/**/*.test.ts` 文件。新增测试文件时同步 `package.json`，避免只维护专项命令导致默认回归遗漏。

## 验证层次

| 层次 | 入口 | 前提与影响 |
| --- | --- | --- |
| 离线 | `npm test`；专项 `test:agent:next`、`test:admin`、`test:rag` | 不代表真实服务或答案质量通过 |
| 当前流式 UI | `node scripts/check-agent-rollout-browser.mjs` | 本地站点和 Chrome CDP 9233；使用模拟模型输出 |
| 当前 Agent 真实评测 | `npm run eval:agent:next` | 模型与检索凭据，可能产生费用；需人工审查语义质量 |
| 登录与流式 API | `node --import tsx scripts/check-agent-rollout-live.mjs` | 目标站点、测试管理凭据；创建并清理测试身份，调用真实模型 |
| 后台端到端 | `npm run test:admin:live` | 站点 3003、Chrome CDP 9223、Supabase 管理凭据 |
| RAG 真实评测 | `npm run eval:rag` | 数据库、知识索引和模型配置，产生外部调用 |

旧 `eval:agent`、`eval:agent:acceptance`、`test:browser` 等脚本用于兼容链路，不能替代当前 SDK 路径验收。本次整理没有重新运行浏览器、数据库写入和付费模型检查。

## 证据管理

`artifacts/` 是脚本生成的本地产物目录。已有 Git 跟踪的历史证据继续保留；新增运行产物默认忽略，避免将多轮临时输出和未脱敏数据直接提交。插画生成提示词作为资产来源记录单独保留。

发布评测结果时记录版本、日期、模型、样本及未通过项。历史报告入口见[档案](archive/README.md)。自动断言通过、真实模型调用完成、人工判断正确和用户任务完成是不同结论，不合并成一个“准确率”。
