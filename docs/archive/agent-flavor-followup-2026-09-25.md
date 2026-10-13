# 搭配建议与实验室入口

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

## 后续修正：点击入口带入默认材料

用户反馈纯跳转到空实验室不符合旧版体验。搭配场景改用现有 `preview_lab_change` 准备当前讨论材料，amount 可省略；点击该轮入口与预览确认按钮均使用同一 transfer 流程。实验室复用 `buildReferenceExperiment` 的材料库默认参考量，保持可编辑、未知材料待确认、已有草稿替换确认与旧预览失效保护。纯导航仍可不带材料。

真实 DeepSeek 两轮已验证啤酒、柠檬汁以及补充蜂蜜的材料集合与缺省用量；移动端浏览器验证入口触发替换确认、实际加载两项材料且用量大于零。类型检查、10 项工具测试通过。此前仅跳转的约定由此修正；下文保留首次上线记录。

材料带入修复部署：`https://alchemix-5bbi6gzrr-p-ei-xuan.vercel.app`（`dpl_GyTeFPiFe49q8uz7uN7dVwwnKvhu`）。生产构建、候选部署真实账号的材料预览/连续对话/额度/日志/旧客户端兼容验证通过，临时数据已清理。回退点为下文首次上线版本。

恢复老版的连续体验：先回答搭配口味，随后自然追问其他材料，并提供「去调配实验室」按钮。已经说明没有其他材料时不重复询问。复用原有实验室地址，保留六工具架构，无新增关键词路由。

模型提供注册地址后，共享聊天组件将其渲染为按钮，浮窗和完整聊天页均支持。未知地址不变成可点击操作；跳转不写入材料、不覆盖草稿。实际带入材料仍走独立预览与确认。

验证：

- 类型检查、生产构建、9 项工具测试通过。
- 浏览器 15 项回归通过，含真实路由跳转、无 transfer 写入、草稿保留；模型响应使用流式夹具。
- 真实 DeepSeek 连续两轮：截图原话「我柠檬汁和啤酒做会是什么味道」给出口味建议、其他材料追问和入口；「还有蜂蜜，没有别的材料了」继续原组合，没有重新询问全套材料；均未调用预览工具。结果保存在 `artifacts/evaluations/flavor-followup.json`。
- 这次验证针对对话推进和入口，不代表模型所有调配建议均经过事实核验。

复测：`node --import tsx scripts/check-agent-flavor-followup.ts`；浏览器运行 `node scripts/check-agent-rollout-browser.mjs`；真实接口使用 `AGENT_TEST_CASE=flavor` 运行 `scripts/check-agent-rollout-live.mjs`。

已发布并 promote：`https://alchemix-on8j8373e-p-ei-xuan.vercel.app`（`dpl_6eUuWXcrhRMdc7yQaq2CmCR6JU7r`）。候选部署真实接口测试通过，包含入口、两轮上下文、鉴权、额度释放、日志与旧客户端兼容；临时测试账号已清理。前版回退点：`https://alchemix-dxt0qn0zc-p-ei-xuan.vercel.app`。
