# 实验室材料带入与返回聊天

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

本次确认：搭配建议同轮显示「带入材料，进入酒精实验室」，预放当前讨论材料；优先采用本次建议比例的具体毫升数，否则采用材料库默认量。目标页面左上角显示「← 返回聊天」，恢复聊天记录、草稿和阅读位置，并保留实验室编辑。

修复原因及实现：

- 原入口依赖可选工具调用和 Markdown 链接，模型只回答文字时会漏入口。现在主 Agent 的同一次回复通过 AI SDK `Output.object` 同时输出正文和实验室操作，经校验后通过 SDK data part 交给界面。仍是一个主 Agent，没有增加复核模型或关键词路由。原六工具保留，工具结果和卡片继续走 SDK 流。
- 不信任生成的材料来源：材料须对应用户原话中的名称，或本轮真实配方工具返回的材料；不允许背景原配方或模型自荐配料冒充用户选择。来源校验不等于语义完美，否定和纠正仍由主模型理解并通过多轮案例检验。
- 页面 context 原先作为组件 key，材料或页面变化会销毁对话。现使用布局内存保存本轮消息、草稿、任务 ID、账号和滚动位置，跨页面重建时恢复；不写长期记忆。账号切换清空旧会话；完整 /ask 页面返回其原地址，浮窗返回则在目标页重开。
- 返回按钮只在聊天操作的目标页出现，并预留顶部空间。它不执行实验室写入。只有最新有效回复的材料按钮可以带入；已有草稿先确认替换。
- 实验室 transfer 增加可选 `view: materials`，本次入口打开可编辑材料列表，不自动切换结果页；保留旧版 transfer 默认行为。材料用量可直接编辑。

验证：类型检查、生产构建、15 项工具与协议测试；17 项移动浏览器回归（模拟模型流）；真实 DeepSeek 浏览器完整流程「金酒配可乐是什么味道 → 材料入口 → 两项材料与具体毫升数实际显示 → 修改金酒用量 → 返回聊天 → 草稿、阅读位置和编辑保留」。截图 `artifacts/agent-next/material-return-live.png`。真实酒单查询、连续工具对话、额度释放、日志和旧接口兼容均通过。测试临时身份与测试数据清理完成。

复测命令：

```sh
npm run test:agent:next
node scripts/check-agent-rollout-browser.mjs
node --import tsx scripts/check-agent-material-return-live.mjs
node --import tsx scripts/check-agent-flavor-followup.ts
AGENT_TEST_CASE=beer node --import tsx scripts/check-agent-rollout-live.mjs
```

会话仅在本次页面会话内保存；整页刷新或关闭标签页后不保证恢复。未知材料仍由实验室提示确认，不能伪造材料档案。

兼容性边界：扩展实测捕获过 DeepSeek 非法引号 JSON 和空白输出；不修补生成句子，不执行不完整动作。SDK 校验失败通过原重试入口显式报告，错误分支有测试覆盖。降低采样随机性并明确完整 JSON 合约后继续复测。

后续定位：UI 历史为纯文字，发送到 JSON 模式时没有恢复相同的回复封装。现在历史助手文字重新封装成 JSON（历史 lab 置 none，不信任客户端动作）；五轮真实 DeepSeek 验收通过：啤酒柠檬汁 → 蜂蜜 → 金酒可乐 1:3 → 去掉可乐换苏打水 → 取消。结果保存于 `artifacts/evaluations/flavor-followup.json`。这不构成模型永不出错的保证，仍保留显式失败与重试路径。

已上线：`https://alchemix-mdxbq6wkw-p-ei-xuan.vercel.app`（`dpl_DbvHdHnyU2v9maAT251SpTCbefFL`），正式域名 inspect 已核对。候选部署真实接口校验通过。正式域名真实移动浏览器验收通过：截图原话生成金酒45ml、可乐135ml；点击后材料与用量实际显示，金酒改为35ml后返回聊天仍保留，原聊天草稿与阅读位置恢复。临时账号和测试数据已清理。回退点：`https://alchemix-5bbi6gzrr-p-ei-xuan.vercel.app`。
