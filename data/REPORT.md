# 面板诊断

地图上每个区域四种命运：正常上色（ok）、上色但标注低样本（low）、上色但样本量无从查证（unverified，2004 年以前没有成交量数据）、中性灰（insufficient）。

下面两张表是**最新季度**的分布，那个季度成交量数据齐全，所以 unverified 是 0，灰色那一列就是 insufficient。

## kommune 级（**地图默认层**）

最新季度 **2026Q1**，面板 40,101 行。

| kommune | 有数据 | ok (>=40) | low (10-39) | insufficient | 可上色 |
|---|---|---|---|---|---|
| house | 98 | **97** | 0 | 1 | 99% |
| flat | 98 | **56** | 8 | 34 | 65% |
| holiday | 87 | **44** | 1 | 42 | 52% |

- **house**（97 个 ok 单元）：YoY 中位数 5.2%，挂牌天数中位数 138 天，去化 2.5 季度
- **flat**（56 个 ok 单元）：YoY 中位数 6.8%，挂牌天数中位数 100 天，去化 1.3 季度
- **holiday**（44 个 ok 单元）：YoY 中位数 4.1%，挂牌天数中位数 148 天，去化 3.1 季度

## postnummer 级（下钻层）

最新季度 **2026Q1**，面板 235,287 行。

| 邮编 | 有数据 | ok (>=40) | low (10-39) | insufficient | 可上色 |
|---|---|---|---|---|---|
| house | 599 | **317** | 61 | 221 | 63% |
| flat | 316 | **77** | 18 | 221 | 30% |
| holiday | 297 | **71** | 19 | 207 | 30% |

- **house**（317 个 ok 单元）：YoY 中位数 5.6%，挂牌天数中位数 128 天，去化 2.3 季度
- **flat**（77 个 ok 单元）：YoY 中位数 10.1%，挂牌天数中位数 84 天，去化 0.9 季度
- **holiday**（71 个 ok 单元）：YoY 中位数 6.3%，挂牌天数中位数 136 天，去化 2.5 季度

## 浏览器要下载的东西

| 文件 | 大小 | gzip 后 |
|---|---|---|
| panel_kommune.parquet | 1.79 MB | ~0.60 MB |
| panel_monthly.parquet | 2.29 MB | ~0.76 MB |
| snapshot.json（首屏） | 84 KB | — |

## 月度指标（全国，独栋）

- UDB010/020/030，2004M01 - **2026M07**
- 比季度成交数据新四个月，但只有挂牌侧的量，没有成交价

## Fun Facts

- 12 条，全部只用 reliability=ok 的单元
  - Frederiksberg costs 17× what Lolland does — 88,282 vs 5,120 kr/m²
  - A house sells in 60 days in Egedal, 326 in Morsø — national median 138 days
  - Sellers in Samsø accept the biggest cut below asking — -26.4%
  - At the current pace, Struer would take 8.0 quarters to clear its listings — national median 2.5
  - Bought in 2016 Q1 and sold today, Frederiksberg beat every other kommune — +77% vs -15% in Morsø, after inflation
  - In Frederikshavn houses and flats are moving in opposite directions — houses +7.6%, flats -9.9%
  - 81 of 97 kommuner are still below their 2006-08 peak once you strip out inflation — Vordingborg is the furthest back, -40%
  - Adjusted for inflation, Denmark as a whole has still not got back to its 2007 peak — 19 years on — 18,255 vs 18,972 kr/m², -4%
  - In 38 kommuner a square metre of flat costs more than a square metre of house — Ringkøbing-Skjern tops it at 155% more
  - A holiday home in Lolland costs more per square metre than a house you can live in year round — 16,790 vs 5,120 kr/m²
  - Zealand against Jutland, the oldest divide in Danish housing — 31,459 vs 10,727 kr/m² — 2.9× as much
  - Cross the line from København into Frederiksberg and the price per square metre jumps — 59,282 → 88,282 kr/m²
