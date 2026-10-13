# 缺料后的酒单推荐恢复

> 历史记录：保留当时的设计、结果及限制，不代表当前实现。当前版本见 [文档导航](../README.md)。

问题：用户在西柚啤酒页面问“我没有西柚汽水了 啤酒还能做什么”，新助手先询问全部库存、给通用搭配，没有展示原有酒单卡片。

根因：新 `find_recipes` 只封装完整材料匹配和“至少已有两种材料、只缺一种”的近似匹配，未封装旧酒库按单一基酒查其他酒单的能力；主模型也未把选酒查询作为此类需求的必要数据来源。

修复：

- `findRecipeCandidates` 复用原有 `spiritMixerRecipes`，单一已知材料也可查候选；完整匹配优先，最多三款，保留真实 ID 和原配方卡片。
- 明确排除的材料先从可用材料移除，再过滤全部候选。类别限制不因候选不足放宽。
- 工具区分 `materials_matched` 与 `needs_materials`；后者在卡片标注“还需准备或确认”，不把未知库存当成已齐备。
- 模型自行选择工具的架构保持不变；明确选酒与缺料换酒需要查真实酒库，不增加关键词路由或回复过滤。
- 将 `findRecipe` 中不变的 ID 标准化移出数组循环，避免批量查候选时重复计算。该案例本地工具测试从约 3 秒降到约 26 毫秒；这是本地测量，不是线上延迟保证。

验证：

- 新工具测试 9 项、原配方身份测试 4 项通过；类型检查及生产构建通过。
- 截图原话真实 DeepSeek 连续三次（含无页面背景）均查询酒库，返回番茄啤酒、啤酒柠檬茶、啤酒乌龙茶，排除西柚汽水并列出其他所需材料。
- `artifacts/evaluations/beer-alternatives.json` 保存完整结果。
- 浏览器使用真实工具输出作为流式夹具，断言三张原配方卡片及“还需准备或确认”提示，原 14 项浏览器回归通过。

已上线：`https://alchemix-dxt0qn0zc-p-ei-xuan.vercel.app`（`dpl_HH8zFdMxvvXNb42Kf1ayptxewRkH`）已成功 promote 到正式域名。前版回退点：`https://alchemix-om51rtpdu-p-ei-xuan.vercel.app`。

候选部署真实账号验证通过：截图原话返回三款真实啤酒候选、均排除西柚汽水且标为还需材料；选择番茄啤酒后的第二轮对话、SDK metadata、额度释放、运营日志、旧客户端兼容均通过。临时账号和测试数据已清理。卡片截图：`artifacts/agent-next/beer-alternatives-mobile.png`。

复测命令：

```sh
npm run test:agent:next
node --import tsx scripts/check-agent-beer-alternatives.ts
BEER_ALTERNATIVES=true node scripts/check-agent-rollout-browser.mjs
AGENT_TEST_CASE=beer AGENT_TEST_ORIGIN=https://alchemix-lab.vercel.app node --import tsx scripts/check-agent-rollout-live.mjs
```
