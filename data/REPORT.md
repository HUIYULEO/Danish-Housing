# Panel diagnostics

Every area on the map meets one of four fates: coloured normally (ok), coloured but flagged as low sample (low), coloured with a sample size that cannot be checked (unverified: no volume data before 2004), or neutral grey (insufficient).

The two tables below show the distribution for the **latest quarter**, which has complete volume data, so unverified is 0 and the grey column is simply insufficient.

## kommune level (**default map layer**)

Latest quarter **2026Q2**, panel of 40,385 rows.

| kommune | with data | ok (>=40) | low (10-39) | insufficient | colourable |
|---|---|---|---|---|---|
| house | 98 | **97** | 0 | 1 | 99% |
| flat | 97 | **57** | 9 | 31 | 68% |
| holiday | 89 | **44** | 0 | 45 | 49% |

- **house** (97 ok units): median YoY 5.7%, median days on market 138, supply 2.2 quarters
- **flat** (57 ok units): median YoY 8.7%, median days on market 106, supply 1.1 quarters
- **holiday** (44 ok units): median YoY 7.4%, median days on market 145, supply 2.2 quarters

## postnummer level (drill-down layer)

Latest quarter **2026Q2**, panel of 236,525 rows.

| postal code | with data | ok (>=40) | low (10-39) | insufficient | colourable |
|---|---|---|---|---|---|
| house | 600 | **317** | 66 | 217 | 64% |
| flat | 316 | **75** | 16 | 225 | 29% |
| holiday | 319 | **73** | 14 | 232 | 27% |

- **house** (317 ok units): median YoY 6.1%, median days on market 127, supply 2.0 quarters
- **flat** (75 ok units): median YoY 11.2%, median days on market 79, supply 1.0 quarters
- **holiday** (73 ok units): median YoY 7.7%, median days on market 135, supply 1.9 quarters

## Crosswalk

- 1089 postnumre in total, 99 kommuner
- postnumre spanning several kommuner: **246** (22.6%)
- So the crosswalk is **only used for the drill-down list on kommune pages**, never to aggregate numbers.
  Kommune-level price/volume/days on market all have official tables (BM010/BM020/BM030);
  aggregating postal codes yourself leaves a kommune swallowed by its neighbours, like Frederiksberg, with 6 sales.

## What the browser downloads

| file | size | gzipped |
|---|---|---|
| panel_kommune.parquet | 2.21 MB | ~0.74 MB |
| panel_postnr.parquet | 4.17 MB | ~1.39 MB |
| panel_monthly.parquet | 2.31 MB | ~0.77 MB |
| snapshot.json (first paint) | 109 KB | — |

## Monthly indicators (national, houses)

- UDB010/020/030, 2004M01 - **2026M09**
- Four months fresher than the quarterly sales data, but listing-side only: no sale prices

## Fun Facts

- 12 facts, all from reliability=ok units only
  - Frederiksberg costs 17× what Lolland does — 85,765 vs 5,170 kr/m²
  - A house sells in 57 days in Egedal, 298 in Morsø — national median 138 days
  - Sellers in Samsø accept the biggest cut below asking — -16.5%
  - At the current pace, Struer would take 7.4 quarters to clear its listings — national median 2.2
  - Bought in 2016 Q2 and sold today, Frederiksberg beat every other kommune — +72% vs -16% in Norddjurs, after inflation
  - In Haderslev houses and flats are moving in opposite directions — houses +13.3%, flats -4.5%
  - 78 of 97 kommuner are still below their 2006-08 peak once you strip out inflation — Lolland is the furthest back, -39%
  - Adjusted for inflation, Denmark as a whole has still not got back to its 2007 peak — 19 years on — 18,663 vs 18,972 kr/m², -2%
  - In 42 kommuner a square metre of flat costs more than a square metre of house — Ringkøbing-Skjern tops it at 155% more
  - A holiday home in Lolland costs more per square metre than a house you can live in year round — 17,046 vs 5,170 kr/m²
  - Zealand against Jutland, the oldest divide in Danish housing — 32,446 vs 10,788 kr/m² — 3.0× as much
  - Cross the line from København into Frederiksberg and the price per square metre jumps — 61,378 → 85,765 kr/m²
