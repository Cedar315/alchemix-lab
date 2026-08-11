# AlcheMix Lab 后续 AI 辅助层设计文档

## 这个文档是做什么的？

这份文档说明 **如果后续接入 AI，AI 应该怎么作为辅助能力进入 AlcheMix Lab**。

注意：当前 MVP **没有 AI Agent**，也不把 AI 作为主流程。  
当前版本主要依赖：

- 本地 Ingredient Database
- 本地 Inspiration 酒单
- 本地问题库
- 规则分析
- 推荐算法
- 用户酒记和口味画像

AI 只作为后续能力预留，用来处理“本地库覆盖不到”或“需要自然语言解释”的部分。

---

## 1. 当前产品真实状态

当前 AlcheMix Lab 不是 AI Agent 产品。

已经实现或正在实现的是：

- Assistant 工具型首页
- Lab 本地材料分析
- Inspiration 本地酒单探索
- Drink Log 已喝记录
- My 调酒日历和口味画像
- Admin 管理台雏形
- 本地数据库优先的搜索和推荐思路

当前还没有完成：

- MiniMax / OpenAI 真实接入
- AI 自动生成配方主流程
- AI 自动补全数据库
- AI Agent 多步工具调用
- AI 直接写 Supabase

所以对外表达时，应使用：

> 数据库优先、规则算法驱动、后续可接 AI 辅助的便利店调酒决策助手。

不要说：

> AI Agent 调酒助手。

---

## 2. AI 在后续版本里的定位

原则：

> 本地数据库优先，AI 只做候选草稿和解释辅助。

AI 可以做：

- 本地没有饮料资料时，生成候选资料
- 根据本地材料和规则，辅助生成候选配方
- 把风味逻辑解释成小白能懂的话
- 给用户自定义酒起名字
- 辅助经典鸡尾酒改良说明

AI 不应该做：

- 直接判断事实数据
- 直接写数据库
- 代替用户评分
- 生成高风险饮酒建议
- 绕过本地数据库搜索
- 作为首页聊天 Agent 承担主流程

---

## 3. 规则算法和 AI 的分工

### 规则算法负责稳定计算

当前 MVP 优先使用规则和本地数据完成这些任务：

- 根据用户材料匹配已有配方
- 根据配料属性计算酸甜苦、气泡、酒感
- 判断 Shake / Stir 是否合适
- 提醒气泡饮料不要 Shake
- 提醒奶类和高酸材料可能分层或凝结
- 提醒咖啡因和酒精叠加
- 根据 drink_logs 计算口味画像
- 根据口味画像给酒卡排序

### 后续 AI 负责候选生成和解释

AI 适合做开放表达任务：

- 生成候选配方草稿
- 解释为什么这杯会好喝
- 把专业风味逻辑翻译成新手建议
- 给自定义酒命名
- 生成待审核的饮料资料草稿

### 不允许混淆

- 推荐算法不依赖 AI 才能运行
- AI 输出必须经过后端校验
- AI 不能替代用户真实评分
- AI 不能直接写 Supabase
- AI 候选资料必须进入管理台审核

---

## 4. 后续 AI 调用流程

如果未来接入 AI，推荐流程如下：

```text
用户选择材料 / 输入需求
        ↓
Next.js API Route 接收请求
        ↓
Zod 校验请求参数
        ↓
本地数据库查询材料、风味、禁忌、配对规则
        ↓
规则引擎先生成基础结论
        ↓
仅在需要时调用 AI
        ↓
Zod 校验 AI 返回 JSON
        ↓
安全规则二次检查
        ↓
返回前端候选结果
        ↓
如需入库，进入 Admin 审核队列
```

关键点：

- AI 只能基于受控数据库上下文生成
- 输出必须是 JSON
- 返回前必须过 Zod
- 安全规则必须由后端代码兜底
- AI 不直接写数据库

---

## 5. 可选 API 设计

这些接口是后续规划，不是当前 MVP 必须项。

### `POST /api/ai/generate-recipe`

用途：  
在本地库没有合适配方时，生成 1-3 个候选配方草稿。

### `POST /api/ai/modify-classic`

用途：  
辅助解释经典鸡尾酒如何改成更适合新手或便利店材料的版本。

### `POST /api/ai/explain-taste`

用途：  
把 Lab 或配方结果解释成小白能读懂的建议。

### `POST /api/ai/substitute-ingredient`

用途：  
当用户缺少某个材料时，生成候选替代材料建议。

### `POST /api/ai/name-recipe`

用途：  
给用户自定义实验结果起名字。

---

## 6. AI 输出结构要求

AI 必须输出结构化 JSON，不要输出 Markdown。

推荐结构：

```ts
{
  nameZh: string,
  nameEn: string,
  description: string,
  ingredients: [
    {
      name: string,
      amountMl: number,
      unit: "ml",
      note?: string
    }
  ],
  ratio: string,
  steps: string[],
  flavorProfile: {
    sweetness: number,
    acidity: number,
    bitterness: number,
    freshness: number,
    alcoholIntensity: number,
    fruitiness?: number,
    smoothness?: number
  },
  estimatedAbv: string,
  tags: string[],
  beginnerAdvice: string,
  safetyNotes: string[],
  confidence: "high" | "medium" | "estimated"
}
```

---

## 7. 安全规则

后续即使接 AI，也必须保留代码层安全校验：

1. **碳酸饮料不要 Shake**  
   汽水、苏打水、汤力水、可乐、啤酒应最后加入，轻轻搅拌。

2. **奶类和高酸要提醒**  
   奶、乳酸饮料和大量柠檬 / 青柠 / 西柚混合时，可能分层或凝结。

3. **咖啡因 + 酒精要提醒**  
   功能饮料、咖啡和高度酒叠加时必须提示风险。

4. **高酒精度要限制推荐量**  
   高 ABV 配方要降低推荐注入量，并提示适量饮用。

5. **AI 不确定事实不能直接入库**  
   标记为 `estimated`，进入 Admin 审核队列。

---

## 8. MiniMax / OpenAI 接入原则

如果后续接入 MiniMax / OpenAI：

不允许：

- 前端直接调用模型 API
- 模型直接连接 Supabase
- AI 直接写数据库
- AI 绕过本地库优先原则

允许：

- Next.js API Route 调模型
- API Route 校验模型结果
- API Route 返回候选结果
- 管理台审核后写入数据库

---

## 9. 下一步建议

当前优先级不是接 AI，而是先补齐本地闭环：

1. 完善本地配料库和酒单库
2. 完善 Lab 风味分析和安全提醒
3. 完善记录一杯和口味画像
4. 完善推荐算法
5. 完善 Admin 管理台审核流
6. 最后再把 AI 作为 fallback 接入

面试时推荐表述：

> 当前 MVP 不是 AI Agent，而是一个数据库优先、规则算法驱动的调酒决策产品。AI 被设计为后续辅助层，用于候选补全和解释生成，并且必须经过后端校验和管理台审核。
