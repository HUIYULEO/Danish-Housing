# dk-housing

丹麦房地产市场可视化。Real Estate Market Intelligence，不是房源搜索或估值产品。

规格看 `docs/PRD-v0.2.md`。数据坑看 `README.md`。ETL 是 `dk_housing_etl.py`。

## 开工前必读的四件事

1. **ETL 要在本机终端跑**，不要在任何沙箱里跑。api.statbank.dk 在 Cowork 的
   云容器和桌面 VM 里都够不到（出站白名单）。本机 Python 网络是通的。

2. **BM031 的 0 是伪装的缺失**，不是"0 天卖掉"。28% 的有效值是 0。
   ETL 里已经处理，改动那段代码前先看懂为什么。

3. **样本量门槛建在滚动 4 季度上**，不是单季度。单季度邮编成交量中位数只有 10 笔，
   建在单季度上会砍掉一半地图。三档：ok >=40 / low 10-39 / insufficient <10。

4. **灰色是常态不是异常。**数据不足的区域画中性灰，配色方案要为此留位置。
   任何时候都不要为了地图好看而显示低样本量算出来的百分比。

## 架构

Next.js + TypeScript + MapLibre GL + Observable Plot，
数据用 DuckDB WASM 查静态 Parquet。**不要 PostgreSQL，不要 FastAPI**，
全量数据只有几 MB，整包进浏览器。唯一的服务端是 LLM 调用的 API route。

## 默认值

- 默认地图：kommune 级、独栋/联排、成交价 kr/m²、同比
- 时间切换：1Q / 4Q / 3Y / 5Y / 10Y（没有月度价格数据）
- 公寓是独立的城市视图，不是地图上的第三个筛选项
- 增长率一律用滚动 4 季度均价算，不用单季度点对点

## 语言

界面英语，地名保留丹麦语原文（København 不写成 Copenhagen）。
