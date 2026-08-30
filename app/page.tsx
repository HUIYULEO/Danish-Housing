import Link from "next/link";
import Explorer from "@/components/Explorer";
import snapshot from "../public/data/snapshot.json";
import areas from "../public/data/areas.json";
import monthly from "../public/data/monthly.json";
import facts from "../public/data/facts.json";
import postnrByKommune from "../public/data/postnr_by_kommune.json";
import type { Domains, PanelRow } from "@/lib/metrics";
import type { Facts, Monthly } from "@/components/Ticker";

/**
 * 首屏在服务端就把最新季度的切片渲染好。
 *
 * snapshot.json 只有 67 KB，直接 import 进 bundle，打开就有一张涂满的地图。
 * DuckDB WASM（gzip 后 7 MB）在客户端后台加载，加载完才解锁时间轴和排行榜。
 * 反过来做的话，第一屏要等 7 MB —— PRD §16 的第一条成功标准就没了。
 */

interface Area {
  code: string;
  name: string;
  level: string;
}

export default function Home() {
  // 三层的名字都要，地图可以切到 region / landsdel
  const areaList = (areas as Area[]).filter((a) => a.level !== "country");

  return (
    <div className="shell shell--app">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <div className="masthead__tag">
          See what is happening in Danish real estate
        </div>
        <nav className="masthead__nav">
          <Link href="/methods">Data &amp; methods</Link>
        </nav>
      </header>

      <Explorer
        initialRows={snapshot.rows as PanelRow[]}
        latestQuarter={snapshot.quarter}
        quarters={snapshot.quarters}
        months={snapshot.months}
        domains={snapshot.domains as unknown as Domains}
        domainsMonthly={snapshot.domainsMonthly as unknown as Domains}
        areas={areaList}
        monthly={monthly as Monthly}
        facts={facts as Facts}
        postnrByKommune={postnrByKommune as Record<string, string[]>}
      />
    </div>
  );
}
