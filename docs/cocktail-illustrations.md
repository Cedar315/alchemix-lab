# 酒单手绘插画

风格依据：用户确认的玛格丽特示例。白底、细炭笔轮廓、柔和水彩酒液、玻璃高光，完整杯体居中，无文字或品牌标识。使用内置 imagegen 逐张生成；未使用付费 API 脚本或外部图片抓取。

## 范围与图片对应

- 浏览酒单包含 286 款经典酒及经典模板组合、339 款便利店组合，共 625 款。
- 70 款具名经典酒分别生成插画；经典选择器额外提供的戴克里也单独配图。
- 216 款经典模板组合按 24 种调制结构共用示意插画；威士忌／白兰地的嗨棒与古典式使用琥珀色版本。
- 便利店组合主要按 28 种饮料外观共用示意插画，另外为西柚啤酒、番茄啤酒和青柠烧酒苏打生成独立图片。
- 组合配方的图片用于呈现杯型和主要饮料质感，不保证每种品牌、基酒颜色、实际比例与成品完全一致。后续可以为任意酒款增加独立图片。
- 实验室页面及实验室记录不在本次范围内。

## 文件与维护

- 图片：`public/images/cocktails/illustrated/`，保留原始 PNG。
- 运行时映射：`src/lib/data/cocktail-illustrations.json`，记录酒款 ID、图片文件名及 dedicated/shared 类型。
- 查询与旧 ID 别名：`src/lib/data/cocktail-illustrations.ts`。
- 展示组件：`src/components/CocktailIllustration.tsx`，使用 Next Image 按需优化和懒加载，完整展示杯体；未知酒款保留线描后备图。
- 覆盖报告：`artifacts/cocktail-illustrations/coverage.json`。
- 全部图片预览：`artifacts/cocktail-illustrations/review.html`。
- 生成提示词与来源记录：`artifacts/cocktail-illustrations/prompts.json`。

```sh
node --import tsx scripts/sync-cocktail-illustrations.ts --check
npm run typecheck
```

同步脚本只注册已存在的图片，并报告未覆盖酒款；`--check` 在有遗漏时返回非零退出码。添加独立酒款图片时，更新同步脚本的对应规则，再运行同步脚本，避免手工修改生成的 JSON 后被覆盖。

浏览器检查使用本机开发服务器与 9231 端口的独立无界面 Chrome，检查手机端图片加载、横向溢出并保存截图：

```sh
node scripts/check-cocktail-illustrations.mjs
node scripts/check-cocktail-illustrations.mjs --gallery
```

## 生成规范

每张图使用已批准的玛格丽特作为风格参考，仅借鉴线条、水彩与玻璃质感。提示词明确单杯主体、杯型、酒液颜色、冰块及装饰，统一要求完整杯体、方形画布、白色留白，禁止 UI、文字、标识、手和场景杂物。具体提示词以 `prompts.json` 为准。

## 本次验证

- 625／625 款浏览酒单已覆盖，73 款使用独立插画、552 款使用共享示意插画；另补齐经典选择器中的戴克里，共 126 张图片。
- TypeScript 类型检查通过，所有酒单图片路径及经典选择器旧 ID 均已检查。
- 手机端酒单、玛格丽特详情、亚历山大详情、椰香朗姆详情的加载与横向溢出检查通过；酒卡图片区统一为 4:3。
- 126 张图片均完成浏览器解码及分组总览检查。截图保存为 `gallery-1.png` 至 `gallery-6.png`，手机预览保存为 `mobile-*.png`。
