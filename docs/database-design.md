# AlcheMix Lab 数据库设计文档

## 这个文档是做什么的？

这份文档用来说明 **AlcheMix Lab 的数据应该怎么存**。  
它回答的是数据库和后端层面的问题：

- 需要哪些表？
- 每张表存什么？
- 配料、酒类、配方、用户记录之间是什么关系？
- 哪些数据是事实数据，哪些数据是用户行为数据？
- 后续 Supabase + Prisma 应该怎么扩展？

如果你要改数据库、写 Prisma schema、设计 API、做 Supabase 表结构，就看这份文档。

---

## 1. 数据库设计原则

AlcheMix Lab 的数据库分成四类数据：

1. **事实数据**
   - 配料
   - 酒类
   - 饮料
   - 果汁
   - ABV
   - 糖分
   - pH
   - 风味标签

2. **配方数据**
   - 经典鸡尾酒
   - 便利店特调
   - 系统推荐配方
   - 后续 AI 候选草稿
   - 用户定制配方

3. **用户数据**
   - 用户账号
   - 用户偏好
   - 收藏
   - 已喝记录
   - 调酒日历

4. **反馈和推荐数据**
   - 口味评分
   - 搜索行为
   - 点击行为
   - 实验材料记录
   - 口味画像

---

## 2. 核心数据模块

### 2.1 用户模块

#### `users`

存用户基础信息。

字段建议：

- `id`
- `email`
- `nickname`
- `avatar_url`
- `created_at`
- `updated_at`

用途：

- 登录注册
- 区分不同用户的酒记
- 绑定收藏和口味画像

#### `user_preferences`

存用户主动设置的偏好。

字段建议：

- `user_id`
- `sweetness_preference`
- `bitterness_tolerance`
- `alcohol_tolerance`
- `acidity_preference`
- `disliked_ingredients`
- `favorite_ingredients`
- `preferred_flavor_tags`

用途：

- 用户明确说“不喝奶”“不想要咖啡因”“不喜欢苦”，就存在这里
- 推荐时优先避开用户不喜欢的东西

---

### 2.2 配料数据库

#### `ingredients`

存抽象配料，例如：

- 金酒
- 伏特加
- 苏打水
- 橙汁
- 养乐多
- 乌龙茶
- 椰奶饮料

字段建议：

- `id`
- `slug`
- `name_zh`
- `name_en`
- `aliases`
- `type`
- `category`
- `sub_category`
- `abv`
- `sweetness`
- `acidity`
- `bitterness`
- `carbonation`
- `viscosity`
- `sugar_g_per_100ml`
- `ph_range`
- `ingredients`
- `flavor_tags`
- `suitable_with`
- `avoid_with`
- `recommended_volume_ml`
- `confidence`
- `source_note`

用途：

- Lab 添加材料
- 搜索材料
- 推荐配方
- 风味分析
- 规则计算上下文
- 后续 AI 辅助时的受控上下文

#### `products`

存具体品牌商品，例如：

- 三得利乌龙茶
- 元气森林白桃气泡水
- 养乐多
- 水溶 C100
- 椰树牌椰汁

字段建议：

- `brand`
- `name`
- `barcode`
- `image_url`
- `abv`
- `sugar_content_per_100ml`
- `caffeine_content_per_100ml`
- `ingredient_list_text`
- `common_store_type`

用途：

- 便利店真实饮料库
- 未来扫码 / OCR / 品牌搜索
- 让用户搜“椰树牌椰汁”时能匹配到“椰奶饮料 / Coconut Milk Drink”

#### `flavor_profiles`

存风味维度。

字段建议：

- `sweetness`
- `sourness`
- `bitterness`
- `alcohol_strength`
- `freshness`
- `fruitiness`
- `tea_level`
- `dairy_level`
- `herbal_level`
- `body`
- `aroma_tags`
- `flavor_tags`

用途：

- 计算两种材料是否适合
- 计算口味画像
- 推荐相似配方

---

### 2.3 配方模块

#### `cocktails`

存经典鸡尾酒母版，例如：

- Negroni
- Margarita
- Mojito
- Gin Tonic
- Singapore Sling

用途：

- 经典鸡尾酒知识库
- 经典酒改良器
- Inspiration 经典鸡尾酒列表

#### `cocktail_ingredients`

存经典鸡尾酒的材料和比例。

字段建议：

- `cocktail_id`
- `ingredient_id`
- `amount_ml`
- `unit`
- `role`
- `note`
- `order`

用途：

- 展示原始配方
- 改良时知道哪一项是基酒、甜味、苦味、酸味

#### `customized_recipes`

存用户生成或定制过的配方。

字段建议：

- `base_cocktail_id`
- `user_id`
- `name_zh`
- `name_en`
- `selected_goals`
- `description`
- `bitterness_before`
- `bitterness_after`
- `sweetness_before`
- `sweetness_after`
- `alcohol_before`
- `alcohol_after`

用途：

- 存经典改良结果
- 存系统推荐或用户定制结果
- 后续可存通过审核的 AI 候选结果
- 方便后续复用和收藏

---

### 2.4 已喝记录 / 调酒日记

#### `drink_logs`

这是用户真实反馈最重要的表。

字段建议：

- `id`
- `user_id`
- `recipe_id`
- `recipe_name`
- `recipe_snapshot`
- `drink_date`
- `drink_time`
- `rating`
- `taste_scores`
- `note`
- `is_finished`
- `is_favorite`
- `is_starred`
- `mood_tags`
- `image_url`
- `source_page`
- `created_at`
- `updated_at`

用途：

- 调酒日历
- 最近喝过
- 我的收藏
- 高分酒
- 口味画像
- 推荐算法训练数据

`recipe_snapshot` 很重要，因为配方未来可能改名或调整比例，但用户当时喝到的版本必须保留下来。

---

### 2.5 搜索和行为记录

#### `search_logs`

建议后续新增，用于记录用户搜索。

字段建议：

- `user_id`
- `query`
- `matched_type`
- `matched_id`
- `source_page`
- `created_at`

用途：

- 判断用户最近对什么感兴趣
- 更新口味画像的弱信号

注意：

- 搜索只代表兴趣，不代表喜欢
- 搜索信号权重要低于已喝记录
- 搜索记录需要时间衰减，最近搜索更重要

#### `lab_experiment_logs`

建议后续新增，用于记录用户在 Lab 中做过的实验。

字段建议：

- `user_id`
- `ingredients_snapshot`
- `mix_method`
- `estimated_profile`
- `created_at`

用途：

- 分析用户常用材料
- 计算口味画像
- 推荐更贴合用户手边材料的配方

#### `user_interaction_logs`

建议后续新增，用于记录点击、查看、打开详情等行为。

字段建议：

- `user_id`
- `target_type`
- `target_id`
- `action`
- `source_page`
- `created_at`

`action` 示例：

- `view_recipe`
- `click_card`
- `open_detail`
- `open_drink_log`
- `save_recipe`

用途：

- 分析用户对哪些酒卡感兴趣
- 给推荐算法提供点击信号
- 区分“看过”与“真正喝过”

#### `user_taste_profiles`

建议后续新增，用于缓存用户口味画像。

字段建议：

- `user_id`
- `scores`
- `favorite_ingredients`
- `favorite_base_spirits`
- `avoid_tags`
- `source_summary`
- `updated_at`

`scores` 示例：

```json
{
  "sweetness": 62,
  "acidity": 70,
  "alcoholIntensity": 35,
  "bitterness": 18,
  "freshness": 86,
  "fruitiness": 78,
  "creaminess": 20,
  "carbonation": 74,
  "herbal": 44,
  "smoothness": 80
}
```

用途：

- My 页面展示口味画像
- Assistant 推荐酒卡排序
- Inspiration 酒卡个性化排序
- 解释“为什么推荐这杯”

口味画像可以由后端定时计算，也可以在用户保存 drink_log 后即时更新。

---

## 2.6 当前代码状态和后续数据库目标

当前代码中已经有：

- 本地 `drinkLogs`
- `DrinkLogButton`
- `DrinkLogModal`
- My 页面调酒日历
- 最近喝过
- 我的收藏
- Prisma `DrinkLog` 扩展字段
- `/api/drink-logs` 相关 Route

但当前前端仍以 localStorage 为主，Supabase 写入还没有正式启用。

后续数据库目标：

1. Supabase Auth 真登录
2. `drink_logs` 真实写入 PostgreSQL
3. 新增 `search_logs`
4. 新增 `lab_experiment_logs`
5. 新增 `user_interaction_logs`
6. 新增 `user_taste_profiles`
7. 用这些数据驱动推荐算法

---

## 3. 推荐索引

为了让查询更快，建议加这些索引：

- `ingredients.slug`
- `ingredients.name_zh`
- `ingredients.name_en`
- `ingredients.category`
- `products.barcode`
- `products.name`
- `drink_logs.user_id`
- `drink_logs.drink_date`
- `drink_logs.recipe_id`
- `customized_recipes.user_id`

---

## 4. 数据库、规则算法和后续 AI 的边界

数据库负责事实：

- 材料
- ABV
- 糖分
- pH
- 配料表
- 风味标签
- 用户记录

当前 MVP 主要由本地数据库和规则算法负责：

- 材料搜索
- 配方匹配
- 风味分析
- Shake / Stir 和材料冲突提醒
- 口味画像计算
- 推荐排序

后续 AI 只负责辅助：

- 生成候选配方草稿
- 辅助风味解释
- 辅助命名
- 本地没有材料时生成候选补全建议

AI 不应该直接写数据库。  
所有写入都应该通过 Next.js API Route 或 Server Action 完成；AI 候选资料进入管理台审核后，才允许成为正式事实数据。
