"""
Danish housing ETL  (v2, corrected against the data as measured on 2026-08-29)
=====================================================

Run it through dk_housing_etl.py (`npm run etl`), in **your own terminal**:
sandboxed shells sit behind an outbound allowlist and cannot reach
api.statbank.dk.

Data sources (verified, no API key needed):
    Finans Danmark Boligmarkedsstatistik   https://api.statbank.dk/v1/s20/
    Danmarks Statistik                     https://api.statbank.dk/v1/
    URL:  {base}data/{TABLE}/BULK?lang=en&valuePresentation=Code&DIM=*&...

What the data actually looks like; the code already handles all of it:

  BM011  postnummer price kr/m2   1992Q1-2026Q1  605 postal codes
         Houses: 74% populated over the last 5 years; 283 postal codes
         have a complete 20-quarter series
         Flats: 422 of 592 postal codes have **never had data**; only
         meaningful in cities
         63% of all cells in the table are '..'

  BM031  postnummer days on market   2004Q1-2026Q1
         >>> TRAP: 28% of the "valid" values are 0. A house cannot sell in
         >>> 0 days. 0 = no sale that quarter: a missing value disguised as
         >>> data. It must be treated as missing.
         >>> After the fix, true coverage for houses is about 71%, not 99%
         True distribution (houses): p10=81 days, median 150, p90=288 days

  BM021  postnummer sales volume + for sale at period end  2004Q1-2026Q1
         SALG and ULTIMO both have 99.7% coverage, almost nothing missing
         >>> This is the denominator for the sample-size threshold, exactly
         >>> what PRD §12 needs
         >>> 2026Q1 houses: the median postal code had only 10 sales; 295 of
         >>> 599 had fewer than 10
         >>> So a single-quarter threshold would wipe out half the map; it
         >>> has to be a rolling 4 quarters

  BM010  kommune-level prices  115 areas, houses 99.4% coverage, 113/115
         with a complete series
         >>> Correction: kommune-level prices are **free** (it is the DST
         >>> side that charges)
         >>> The whole table is only 1.1 MB

  BM020 / BM030  kommune-level sales volume / days on market (new in v3)
         >>> BM011/BM021/BM031 have kommune-level twins, BM010/BM020/BM030,
         >>> with identical dimensions.
         >>> Without them the PRD's default kommune map has neither
         >>> sample-size tiers nor days on market, and postal-code volumes
         >>> would have to be forced through the crosswalk. But 22.6% of
         >>> postal codes span several kommuner; assigning each to its
         >>> "first kommune" leaves Frederiksberg with 6 sales and 7 kommuner
         >>> at zero.
         >>> When the official source publishes kommune-level numbers, do
         >>> not build your own. The crosswalk is only for the drill-down list.
"""
