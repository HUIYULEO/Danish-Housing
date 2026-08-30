# Danish Real Estate Market Intelligence

## MVP PRD v0.2

> v0.1 是在不知道数据长什么样的情况下写的。v0.2 是在全量拉过一遍数据之后重写的。
> 变的不是产品野心，是让产品建立在实际能拿到的东西上。
> 实测依据见 `docs/probe-results.md`，评审意见见 `docs/prd-v0.1-review.md`。

---

## 1. 项目定位

一个面向普通用户的数据驱动型房地产市场观察平台。

不做房源搜索、不做估值、不做投资建议。只回答一个问题：

**"丹麦房地产市场最近发生了什么？"**

把公开数据变成趋势、区域差异、排行榜、结构性事实和基于数据的解释。

一句话：**See what is happening in Danish real estate.**

## 2. 核心用户

对丹麦房地产市场感兴趣的普通人、房屋持有者、潜在买家、数据和经济爱好者。

不是第一阶段目标：机构投资者、中介、银行、专业估值人员。

## 3. 核心体验

打开就有东西看，不需要先搜索。

**Explore → Discover → Compare → Ask → Understand**

---

## 4. 数据基础（v0.2 新增，这一节决定了后面所有设计）

### 4.1 数据源

Finans Danmark Boligmarkedsstatistik 与 Danmarks Statistik 共用一个 API host，免 key：

```
Finans Danmark        https://api.statbank.dk/v1/s20/
Danmarks Statistik    https://api.statbank.dk/v1/
{base}data/{TABLE}/BULK?lang=en&valuePresentation=Code&DIM=*&...
```

| 表 | 粒度 | 时间跨度 | 内容 |
|---|---|---|---|
| BM010 | kommune (115) | 1992Q1-2026Q1 季度 | 价格 kr/m²，三种口径 |
| BM011 | postnummer (605) | 1992Q1-2026Q1 季度 | 价格 kr/m²，三种口径 |
| BM021 | postnummer (605) | 2004Q1-2026Q1 季度 | 成交量 + 期末在售 |
| BM031 | postnummer (604) | 2004Q1-2026Q1 季度 | 挂牌天数 |
| UDB030 | kommune (116) | 2004M01-2026M07 **月度** | 供给与在售天数 |

三种价格口径（挂牌价 / 下架价 / 成交价）是免费送的产品素材，相减就是议价空间。

### 4.2 数据密度（最近 5 年实测）

| | 独栋/联排 | 公寓 | 度假屋 |
|---|---|---|---|
| BM011 postnummer 有效格子 | 74% | 31% | 31% |
| 完整 20 季度序列的邮编 | 283 / 604 | 59 / 592 | 51 / 601 |
| 从无数据的邮编 | 36 | 422 | 442 |
| BM010 kommune 有效格子 | **99.4%** | 78% | 66% |

### 4.3 三条由数据决定的产品规则

**规则一：kommune 是默认，postnummer 是下钻。**
kommune 能被完整涂满，第一眼不会出现一半灰色。283 个有完整序列的邮编足够撑起
哥本哈根、奥胡斯、欧登塞、奥尔堡这些真正有故事的地方。

**规则二：公寓是独立的城市视图，不是地图上的第三个筛选项。**
422 个邮编从来没有公寓数据。这不是数据缺陷，是丹麦乡下没有公寓楼。
把公寓做成缩放到约 100 个城市单元的独立模式，比在全国地图上撒一堆洞诚实得多。

**规则三：BM031 里的 0 必须当缺失处理。**
28.2% 的"有效"挂牌天数是 0，那是当季无成交。不处理的话每个乡村邮编都会显示
"0 天售出"，liggetid 地图上最冷的地方会变成全国最火的市场。

---

## 5. 数据质量硬规则（v0.1 §12 的可执行版本）

BM021 提供每个单元每季度的实际成交笔数，99.7% 完整，这是样本量的分母。

实测：2026Q1 独栋，邮编成交量中位数只有 10 笔，599 个里 295 个不足 10 笔。
所以门槛必须建在**滚动 4 季度**上，不是单季度。

| 档位 | 滚动 4 季度成交笔数 | 处理 |
|---|---|---|
| `ok` | ≥ 40 | 正常显示，可上排行榜 |
| `low` | 10 - 39 | 显示数值但标注 "Low sample · N sales"，**排除出排行榜** |
| `insufficient` | < 10，或价格缺失 | 地图画中性灰，tooltip 写 "Insufficient data"，不显示任何百分比 |

补充规则：

- 所有增长率用**滚动 4 季度均价**计算，不用单季度点对点
- 排行榜是"我们认为值得看的东西"，不该混入我们自己都不信的数字。低样本单元直接排除，不是显示后加标注
- 官方数据里被压制的格子是 `..`，解析时必须单独处理，不能静默变成 0

---

## 6. 首页

### 6.1 Market Map

默认：**kommune 级，独栋/联排，成交价 kr/m²，同比变化。**

时间切换（季度是数据的真实频率，v0.1 的月度切换不存在）：

**1Q / 4Q / 3Y / 5Y / 10Y**

时间轴支持拖动和 play/replay。数据整包在浏览器里，拖动是本地毫秒级，不走网络。

指标切换：

| 指标 | 来源 | 备注 |
|---|---|---|
| Price kr/m² | BM010 / BM011 | 默认 |
| Price growth | 同上，滚动 4Q 同比 | |
| **Days on market** | BM031 | v0.2 新增，见 §6.2 |
| Transaction volume | BM021 SALG | |
| **Quarters of supply** | BM021 ULTIMO / SALG | v0.2 新增 |
| Asking vs realised gap | BM011 三种口径相减 | 议价空间 |

房产类型：House（默认）/ Flat（切换到城市视图）/ Holiday home（切换到海岸视图）。

真实价格切换：用 DST 的 CPI 平减，提供 nominal / real terms 开关。
时间轴上标注关键节点（2022 年利率环境变化、2024 年房产税改革生效），标注前核对具体日期。

### 6.2 为什么 Days on market 是一级指标

**价格是滞后的，成交周期是领先的。**市场转冷时挂牌天数先涨，价格几个月后才跌。

同类产品几乎都只画价格。这是最容易做出差异化的一个点，而且数据免费、粒度到邮编。

实测分布（独栋，剔除伪 0 之后）：p10 = 81 天，中位数 150 天，p90 = 288 天，最大 1110 天。
一栋丹麦独栋房子中位数要卖五个月，这个数字本身就是好内容。

### 6.3 月度市场温度条

UDB030 是月度的，更新比 BM 系列还新两个月。

首页顶部放一条窄的月度指示条（全国供给量、在售天数），底下的价格地图仍然是季度。
这样既拿到了"最近"的观感，又不谎称价格有月度数据。

---

## 7. Market Movers

设 `g(t)` 为某单元在 t 季度的同比增长率，用滚动 4 季度均价计算。
所有榜单只包含 `reliability = ok` 的单元。

| 榜单 | 定义 |
|---|---|
| Fastest Rising | `g(latest)` 最大的 N 个 |
| Fastest Falling | `g(latest)` 最小的 N 个 |
| Accelerating | `g(latest) - g(latest-4)` 最大，**且** `g(latest) > 0` |
| Cooling | `g(latest) - g(latest-4)` 最小，**且** `g(latest) > 0` |
| **Heating up** | 挂牌天数同比下降最多（v0.2 新增，领先指标） |
| **Stalling** | 挂牌天数同比上升最多（v0.2 新增） |

Cooling 的 `g(latest) > 0` 约束很重要，否则会和 Fastest Falling 重复。

**基数效应处理：**Accelerating 榜上从低位反弹的地区会天然占优。
卡片上必须同时显示绝对价位，让用户看到"从 12,000 涨到 14,000"还是"从 45,000 涨到 52,000"。

每张卡片包含：区域名、当前值、变化幅度、滚动 4 季度成交笔数、一条 sparkline。

---

## 8. Fun Facts（重写）

v0.1 里的"最近一个月最高成交价""最大成交折价"需要单套成交记录。
免费官方数据全是聚合值，单套数据只能靠抓 Boliga / Boligsiden，那会引入一个随时会坏、
法律上也说不清的依赖。移出 MVP。

改成**区域层面的结构性事实**，全部由现有数据算得出来：

- 挂牌价与成交价差距最大的区域（BM011 三种口径直接相减）
- 相邻区域之间 kr/m² 落差最大的那条"边界线"
- 房子卖得最快 / 最慢的区域，以及全国中位数 150 天这个基准
- 同一个 kommune 内部，公寓和独栋走势相反的地方
- 十年前买入、今天卖出，回报最高和最低的区域
- 库存去化最慢的区域（在售 / 成交）
- 全丹麦最贵和最便宜的 kommune，以及两者的倍数

每条 Fun Fact 是一张可分享的卡片，带 OG image。

---

## 9. Area Detail

点击进入。kommune 和 postnummer 用同一套模板。

- **基本信息**：当前 kr/m²、滚动 4 季度成交笔数、挂牌天数、去化季数、可信度标记
- **趋势**：价格、成交量、挂牌天数、议价空间，全部支持 nominal / real 切换
- **对比**：全国、所在 region、相邻区域
- **房产类型**：独栋 / 公寓 / 度假屋，没有数据的类型直接不显示，不显示空图表
- **下钻**：kommune 页列出其下方有足够数据的 postnummer

数据不足的区域也要有页面，页面上诚实地写清楚为什么没数据（成交量太少），
而不是 404 或者显示一堆空白图表。

---

## 10. AI / 自然语言

不是聊天机器人，是数据分析入口。

流程：`自然语言 → 意图解析 → 参数化查询 → 统计计算 → 可视化 → 文字解释`

**v1 不放开自由 SQL 生成。**改成让 LLM 填充一组固定的参数化查询模板：

```
{ metric, geography_set, time_window, property_type, sort, limit }
```

理由：可测试、不会生成错误的统计口径、延迟低、不可能注入。
等模板覆盖不住的问题多起来了，再考虑放开。

"AI 输出必须基于实际数据"这条原则靠架构保证，不靠 prompt：
LLM 只能看到查询返回的数字，并且强制在回答里引用具体数值和时间窗口。
样本量不足时，AI 必须说"数据不足"而不是给一个数字。

---

## 11. 技术架构（大幅简化）

算一下数据量：

```
BM011  605 × 137 × 3 × 3   ≈ 75 万格
BM021  605 × 89  × 3 × 2   ≈ 32 万格
BM031  604 × 89  × 3       ≈ 16 万格
BM010  115 × 137 × 3 × 3   ≈ 14 万格
```

清洗成一张宽面板之后压 Parquet，几 MB。

**整包塞进浏览器，用 DuckDB WASM 直接查。**

后果：

- v1 **不需要 PostgreSQL**
- v1 **不需要 FastAPI**
- 部署就是一个静态 Next.js 站点加几个 Parquet 文件
- 筛选、排序、时间轴拖动全是本地毫秒级，动画会非常顺
- 托管成本接近零

唯一需要服务端的是 LLM 调用，Next.js API route 就够。

```
Frontend   Next.js + TypeScript + MapLibre GL + Observable Plot
Data       DuckDB WASM + Parquet（静态资源）
ETL        Python，本机或 GitHub Actions 定时，季度更新
AI         Next.js API route + 参数化查询模板
部署        Vercel
```

**注意 ETL 跑的位置：**Cowork 的云容器和桌面沙箱都有出站白名单，够不到 api.statbank.dk。
ETL 要在本机终端或 GitHub Actions 里跑。

边界数据来自 DAWA（`api.dataforsyningen.dk`），上线前用 mapshaper 简化到 500KB 以内。

---

## 12. UI / UX 原则

避免：大量表格、复杂筛选器、房源卡片、中介广告、信息密度过高的 dashboard。

重点：大地图、清晰的数字、时间轴、少量但重要的图表、排名、动态变化、数据故事、探索感。

参考方向：Financial Times Visuals、Bloomberg Graphics、Our World in Data、纽约联储房价地图。

**v0.2 补充：**

- **语言**：英语为主，保留丹麦语地名原文（København 不写成 Copenhagen）
- **移动端**：核心是一张大地图，而分享链接一多半会在手机上打开。地图必须有可用的移动端形态，
  排行榜和 Fun Facts 在窄屏下降级成纵向流
- **灰色是一等公民**：数据不足的区域画中性灰是常态而不是异常状态，配色方案要为此留位置
- **Data & Methods 页面**：数据来源、口径、样本量规则、已知局限。
  对一个靠可信度立足的产品这不是可选项，也是让项目显得专业最便宜的一件事
- **数据署名**：DST 和 Finans Danmark 都有引用规范，照做
- **分享**：每个区域页和每条 Fun Fact 生成 OG image（Vercel OG）

---

## 13. 不做什么

AVM、房价预测、买房推荐、投资建议、房源搜索、中介功能、用户账户、社交功能、
3D 地图、实时数据、BBR 单房屋分析、**任何依赖抓取 Boliga / Boligsiden 的功能**。

---

## 14. Market Events（第二阶段）

自动寻找值得关注的变化，生成 "Things worth watching"：

Price acceleration、Price reversal、Transaction spike、**Supply shock**、Regional divergence。

Supply shock 原计划第二阶段，实际上 BM021 的 ULTIMO 第一阶段就能做。

每个事件包含：What happened、Where、When、Supporting data、Historical comparison。

---

## 15. 一周 MVP（调整后）

| Day | 内容 |
|---|---|
| 1-2 | 数据管线：四张表 + 伪 0 处理 + 滚动指标 + 可信度分级 + Parquet + 边界简化 |
| 3 | kommune 地图 + 时间轴 + 指标切换 + 灰色状态 |
| 4 | Market Movers + Rankings |
| 5 | Area Detail + Fun Facts |
| 6 | UI 打磨 + 移动端 + Data & Methods 页 |
| 7 | 部署 + 埋点。**NLQ 作为 stretch** |

把 NLQ 往后放的理由：§16 的三个成功标准没有一条依赖 AI。
地图不好看的话 AI 救不了它；地图好看的话 AI 只是锦上添花。
一个粗糙的 NLQ 反而会拉低整体观感。

---

## 16. 成功标准

不看用户数量。接 Vercel Analytics 或 Plausible，看三个可测量的问题：

1. **10 秒理解**：首屏跳出率 < 50%
2. **主动探索**：第二次交互率（点击第二个区域或切换指标）> 40%
3. **停留**：中位停留时长 > 60 秒

三个都成立，再考虑 Market Events、AI explanations、更多数据源、欧洲其他国家。

---

## 附：v0.1 到 v0.2 的主要变化

| | v0.1 | v0.2 | 原因 |
|---|---|---|---|
| 频率 | 1/3/6/12 个月 | 1Q/4Q/3Y/5Y/10Y | 免费数据没有月度价格 |
| 粒度 | kommune | kommune 主 + postnummer 下钻 | kommune 99.4% 密，postnummer 74% |
| 公寓 | 地图筛选项 | 独立城市视图 | 422 个邮编从无公寓数据 |
| 样本量 | "考虑样本量" | 三档硬规则，滚动 4 季度 | 单季度中位数只有 10 笔 |
| Fun Facts | 单笔交易奇观 | 区域结构性事实 | 单套数据要靠抓取 |
| 一级指标 | 只有价格 | 加入挂牌天数、去化季数 | 免费、密度更高、领先价格 |
| Supply shock | 第二阶段 | 第一阶段 | BM021 ULTIMO 直接有 |
| 架构 | Postgres + FastAPI | DuckDB WASM + Parquet | 数据量只有几 MB |
| NLQ | Day 6 | stretch | 成功标准不依赖它 |
