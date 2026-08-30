# Danish Housing Market Intelligence

丹麦房地产市场可视化。规格见 `docs/PRD-v0.2.md`，方法论页面在 `/methods`。

数据管线跑通了，地图站也起来了。下面是**在写代码过程中发现的、和 PRD/README v1
不一致的事实**，看代码之前先看这几条。

---

## 1. kommune 级有官方的成交量和挂牌天数表，别再拿邮编去凑

`BM011 / BM021 / BM031`（postnummer）各有一张 kommune 级的孪生表：

| postnummer | kommune | 内容 |
|---|---|---|
| BM011 | **BM010** | 价格 kr/m² |
| BM021 | **BM020** | 成交量 + 期末在售 |
| BM031 | **BM030** | 挂牌天数 |

维度结构完全一致，所以 ETL 里两级走同一段代码。

**这件事为什么重要：**PRD 默认的地图层是 kommune，而样本量门槛的分母是成交量。
原来的 ETL 只拉了 postnummer 的成交量，那 kommune 地图就只能靠 crosswalk 把邮编
聚合上去 —— 而 22.6% 的邮编跨多个 kommune。实测按"第一个 kommune"分配的后果：
Frederiksberg 只剩 6 笔成交，另外 7 个 kommune 直接挂零。

官方给了 kommune 级的数就不要自己凑。crosswalk 现在只用来做 kommune 页的下钻列表。

## 2. 可信度是四档，不是三档

PRD §5 写的三档是在只看最新季度的前提下写的。但**价格从 1992 年就有，
成交量 2004 年才开始**。拿三档去套 1992–2003，那十二年会整片变灰 ——
而灰色的含义是"我们知道那里成交太少"，可我们并不知道，我们只是没有那个数。

| 档 | 滚动 4 季度成交 | 处理 |
|---|---|---|
| `ok` | ≥ 40 | 正常上色，可上排行榜 |
| `low` | 10–39 | 上色 + 标注，排除出排行榜 |
| `unverified` | **未发布**（2004 年以前） | 上色 + 标注，排除出排行榜 |
| `insufficient` | < 10，或没有价格 | 中性灰 + 斜线，不显示任何数字 |

加上 `unverified` 之后，1992 年至今每个季度都有 96–98 个 kommune 能上色，
时间轴整条可用；2004 年以前排行榜正确地空着，并说明原因。

## 3. 最新季度各档有多少个（这决定了地图能涂满多少）

`data/REPORT.md` 每次跑 ETL 都会重算。2026Q1：

**kommune 级（地图默认层）**

| | 有数据 | ok | low | 灰 | 可上色 |
|---|---|---|---|---|---|
| 独栋/联排 | 98 | **97** | 0 | 1 | **99%** |
| 公寓 | 98 | 56 | 8 | 34 | 65% |
| 度假屋 | 87 | 44 | 1 | 42 | 52% |

唯一灰掉的独栋 kommune 是 **Læsø**（滚动 4 季度 25 笔）。

**postnummer 级（下钻层，尚未接入界面）**

| | 有数据 | ok | low | 灰 | 可上色 |
|---|---|---|---|---|---|
| 独栋/联排 | 599 | **317** | 61 | 221 | 63% |
| 公寓 | 316 | 77 | 18 | 221 | 30% |
| 度假屋 | 297 | 71 | 19 | 207 | 30% |

PRD 规则一（kommune 是默认，postnummer 是下钻）被数据完全证实：
kommune 独栋 99% 能涂满，邮编只有 63%。

## 4. 三个行政层级都是官方直接给的，不是我们聚合的

BM010/020/030 的 OMR20 维度里同时含四层：

| 层 | 编码 | 个数 |
|---|---|---|
| 全国 | `00` | 1 |
| landsdel | `01`-`11` | 11 |
| region | `081`-`085` | 5 |
| kommune | 3 位非 0 开头 | 98 |

所以地图上的 Landsdele / Regioner / Kommuner 三个层级，数字全部来自官方自己的行，
**没有任何一处是我们把下级加总上去的**。这很重要，因为邮编和 kommune 不是嵌套关系，
自己加总会跨界重复计数。

几何来自 DAWA 的 `/regioner` 和 `/landsdele`，ETL 里按名字对齐到 DST 的编码。
只有一个特例：DST 叫 `Landsdel København by`，DAWA 叫 `Byen København`，
写死在 `LANDSDEL_ALIAS` 里。**不要按 NUTS3 编号对齐** ——
DST 的 09/10 是 Østjylland/Vestjylland，DAWA 的 DK041/DK042 顺序正好相反。

landsdel 这一层就是"西兰岛 vs 日德兰"能看出来的那一层：
2026Q1 西兰岛中位数是日德兰的 2.9 倍（31,459 vs 10,727 kr/m²）。

## 5. 两个时钟：季度成交，月度挂牌

"季度是不是最小颗粒度"——**成交价是，挂牌侧不是**。

| | 频率 | 最新 | 内容 |
|---|---|---|---|
| BM010/020/030 | 季度 | 2026Q1 | 成交价、成交量、成交周期 |
| UDB010/020/030 | **月度** | **2026M07** | 在售套数、要价、已挂天数 |

月度那三张表也是 kommune 级的，所以地图上给了个频率开关。
两点必须说清楚，界面上也写了：

1. 挂牌侧不是成交侧的高频版本。**在售存量的要价系统性高于成交价** ——
   贵的房子挂得久，便宜的卖得快，堆在存量里的就是没卖掉那批。
   实测 UDB020 单位是 **kr/m²**（Lolland 7,301 / Frederiksberg 114,346）。
2. 月度模式下排行榜是空的，因为那些榜单排的是成交价的变化。
   界面上直接说明原因，而不是显示一堆空卡片。

## 6. 其它保留下来的坑

- **BM030/BM031 的 0 是伪装的缺失**，不是"0 天卖掉"。两级都要处理，ETL 里已经处理。
- **公寓在 kommune 级没有 PRD 担心的那么稀**。PRD 规则二说公寓要做成独立城市视图，
  依据是"422 个邮编从来没有公寓数据"—— 那是**邮编级**的事实。kommune 级公寓
  64/98 能上色，所以现在公寓是地图上的一个正常切换项。等接了邮编下钻，
  独立城市视图的必要性才会真正出现。
- **CPI 比房价晚一个季度发布。** PRIS113 到 2025Q4，房价到 2026Q1，
  缺的那个季度按最后一个已知值前推，少算约半个百分点的通胀。

---

## 怎么跑

**ETL 要在本机终端跑，不要在沙箱里跑。** Cowork 的云容器和桌面 VM 都有出站白名单，
够不到 api.statbank.dk；本机 Python 网络是通的。

```bash
pip install requests pandas pyarrow
python dk_housing_etl.py          # 加 --skip-geo 可跳过 200 MB 边界下载
npm install
npm run simplify                  # DAWA 原图 -> public/geo，简化到 500KB 以内
npm run dev
```

ETL 产出：

| 位置 | 内容 |
|---|---|
| `data/panel_kommune.parquet` | kommune 面板，1992Q1–2026Q1，含四档可信度 |
| `data/panel_postnr.parquet` | postnummer 面板，同上 |
| `data/REPORT.md` | 覆盖率诊断，上面第 3 节那两张表 |
| `data/{kommuner,postnumre}.geojson` | DAWA 原始边界，共 200 MB，不进仓库 |
| `public/data/*.parquet` | 浏览器用的副本，float32 + zstd |
| `public/data/snapshot.json` | 首屏切片，含名义和实际两套价格 |
| `public/data/monthly.json` | 全国月度挂牌指标，到 2026M07 |
| `public/data/facts.json` | 7 条 Fun Facts |
| `public/data/postnr_by_kommune.json` | kommune -> 邮编，展示用 |
| `public/data/version.json` | 内容哈希，用来给 Parquet 的 URL 定版 |
| `public/geo/*.geojson` | 简化后的边界，439 KB / 332 KB |

## 架构

Next.js 16 + TypeScript + MapLibre GL，数据用 DuckDB WASM 查静态 Parquet。
没有 PostgreSQL，没有 FastAPI，全站静态。

两个值得知道的实现选择：

**DuckDB 是懒加载的。** 它本体 gzip 后 7 MB，比它要查的 1.4 MB 数据还大五倍。
首屏读 `snapshot.json`（69 KB）在服务端就把最新季度渲染好，打开就是一张涂满的地图；
DuckDB 在后台加载，加载完时间轴和排行榜才解锁。反过来做的话，
第一屏要等 7 MB，PRD §16 的第一条成功标准就没了。

**Parquet 的 URL 带内容哈希**（`?v=`，来自 `version.json`）。
数据季度更新，Parquet 值得长缓存；但 URL 不变的话浏览器会拿着上一季的 Parquet
配这一季的 snapshot，地图和时间轴就会讲两个不同的故事。

## 已经做完的

- kommune 地图：六个指标、三种房产类型、1992–2026 全时间轴、播放
- **名义 / 实际（CPI 平减）切换**。1995 年全国 4,121 kr/m²，换算成今天的钱是
  7,432 —— 三十年名义涨 232%，实际只涨 84%。差别大到不做不行
- **时间轴默认只铺近十年**，137 个季度铺满时滑块一格不到 3px，
  想停在具体季度靠运气。要看全史按 "Since 1992"
- **顶部轮播条**：月度挂牌数据（比地图新四个月）+ 7 条 Fun Facts，
  每条都带来源标签，不让人把要价当成交价
- 悬浮和详情卡片显示 kommune 下的邮政编码
- 固定值域配色（不随季度重算，所以拖时间轴能看出 2009 和 2021 的区别）
- 价格和成交量走对数色阶（右偏的比例量，线性铺开会把 70 个 kommune 挤进最暗两档）
- 灰色 + 斜线纹理的数据不足态，图例里和色阶并列
- 六个 Market Movers 榜单，全部只取 `ok`，卡片带绝对价位和成交笔数
- 点选区域的详情卡片 + 价格 sparkline，数据不足的区域也有内容
- Data & methods 页，覆盖率数字从 snapshot 现算
- 移动端布局（地图 → 控制条 → 时间轴 → 榜单纵向流）
- **区域详情页** `/area/<code>`，114 个（98 kommune + 11 landsdel + 5 region）
  全部静态预生成。价格对比全国、季度成交量、挂牌天数三张 Observable Plot 图，
  名义/实际切换，没有数据的房产类型直接不显示。
  数据不足的区域**也有页面**并写清楚原因（PRD §9），不 404
- 亮/暗主题（Auto / Light / Dark），地图配色跟着走

## 冻结的

**postnummer 相关代码整体冻结。** ETL 照常产出 `data/panel_postnr.parquet`，
覆盖率照常进 REPORT.md，但：

- 不导出到 `public/data`（省 4.1 MB 仓库 + 托管）
- 不注册成 DuckDB 视图
- `lib/queries.ts` 的 `postnrIn()` 标了 frozen，上面写着解冻要动的三个地方

邮编号本身还在用：地图悬浮提示和区域详情页都会列出 kommune 下的邮编。

## 还没做的
- **公寓独立城市视图**（PRD 规则二）。见上面第 4 节，kommune 级暂时不需要。
- **Area Detail 独立页、OG image**（PRD §9 §12）。Fun Facts 已经在轮播条里，
  但还没有可分享的独立卡片页。
- **NLQ**（PRD §10，本来就是 stretch）。`lib/queries.ts` 已经是参数化模板层，
  LLM 接进来只需要填参数，不生成 SQL。

## 部署

全站是静态的，没有服务端。两种发法：

```bash
npm run build          # Node / Vercel 托管，headers() 生效
npm run build:static   # 纯静态导出到 out/
```

### GitHub Pages

**可以上，已经实测过。** 仓库 Settings → Pages → Source 选 "GitHub Actions"，
推 main 就会自动发，workflow 在 `.github/workflows/pages.yml`。

一开始以为上不了，因为 DuckDB WASM 加了 `Cross-Origin-Opener-Policy` 和
`Cross-Origin-Embedder-Policy`，而静态托管设不了响应头。**实测发现根本不需要**：
那两个头是 SharedArrayBuffer（coi bundle）才要的，我们用的 eh bundle 只要求
浏览器支持 wasm exception handling，和跨源隔离无关。在不带任何自定义头的
静态服务器上验证过：`crossOriginIsolated === false`，DuckDB 照样起来，
排行榜照样出数。那两个头已经从 next.config 里删掉了。

项目站点挂在 `/<repo>/` 下面，所以要带 basePath：

```bash
BASE_PATH=/dk-housing npm run build:static
```

`lib/paths.ts` 负责给运行时那些 `/data` `/geo` `/duckdb` 的路径补前缀 ——
**不要在组件里手写以 `/` 开头的资源路径**，Next 的 basePath 管不到 fetch。
用户站点（`<user>.github.io`）或自定义域名不用设。

### 体积和带宽

| | 大小 |
|---|---|
| `out/` 总计 | 86 MB |
| 其中 DuckDB wasm | 75 MB（mvp + eh 两个 bundle） |
| 数据（Parquet + JSON） | 8 MB |
| 边界 | 968 KB |
| Next 产物 | 1.9 MB |

Pages 的站点上限是 1 GB，86 MB 没问题。要留意的是**带宽**。实测传输量：

| 资源 | 原始 | 传输（gzip） |
|---|---|---|
| duckdb-eh.wasm | 34.0 MB | **6.9 MB** |
| panel_kommune.parquet | 1.71 MB | 1.73 MB（压不动） |
| panel_monthly.parquet | 2.19 MB | 2.22 MB（压不动） |
| kommuner.geojson | 0.42 MB | 85 KB |
| snapshot.json | 82 KB | 11 KB |

**Parquet 已经是 zstd 压过的，再 gzip 一遍不会更小**，反而多几 KB 头部 ——
别指望托管方的压缩能帮上忙。

一个冷访客实际大概 8-9 MB：首屏是 HTML + JS + snapshot + 边界（不到 1 MB，
地图这时已经画出来了），然后后台拉 6.9 MB 的引擎，最后按需拉几百 KB 的
Parquet row group。mvp bundle（41 MB）只有不支持 wasm exception handling 的
老浏览器才会下，现代浏览器一个字节都不碰，所以它只占托管空间不占带宽。

Pages 的软上限是 100 GB/月，按 9 MB 折算约一万次冷访问。真要放量，
换 Cloudflare Pages（不限带宽）更省心。

Parquet 不会整包下载：DuckDB 走 HTTP Range 按需拉 row group，
GitHub Pages 背后的 Fastly 支持 Range（实测本地静态服务器返回 206 正常）。

### 仓库里放什么

- `public/data`、`public/geo`（约 9 MB）**提交进仓库**。数据是季度更新的，
  CI 里不跑 ETL —— 没必要每次推代码都去拉 20 MB。
- `public/duckdb`（77 MB）**不提交**，`npm install` 的 postinstall 会
  从 node_modules 确定性地复制过来。
- `data/*.geojson`（DAWA 原图，两三百 MB）不提交。

数据更新的流程：本机 `npm run etl && npm run simplify`，然后把 `public/` 下的产物
一起提交，推上去 CI 自动发。

### 其它平台

Cloudflare Pages / Netlify / S3+CloudFront 都一样：build 命令
`npm run build:static`，产物目录 `out`，不需要 basePath。
Vercel 用 `npm run build` 就行，那边 `headers()` 会生效，缓存策略更好。

## 归档

PRD、评审、数据源核查都在 Claude Project "Denmarkreal estate market intelligent"。
