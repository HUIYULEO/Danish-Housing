import facts from "../../public/data/facts.json";
import { SUMMARY_QUARTER } from "@/lib/summaries";
import { pageUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * llms.txt: a plain-text description of the site for language models.
 * An informal convention, cheap to provide. The findings come from
 * facts.json, so they follow the data on every refresh.
 */
export function GET() {
  const found = (facts as { facts: { label: string; value: string }[] }).facts
    .map((f) => `- ${f.label}: ${f.value}`)
    .join("\n");

  const body = `# Danish Housing

> Thirty-four years of Danish house prices, selling times, transaction volume and supply, for every kommune and postal district, every quarter since 1992. A data visualisation, not a valuation, a forecast or advice.

Latest quarter: ${SUMMARY_QUARTER}. All figures are official statistics from Finans Danmark (Boligmarkedsstatistikken) and Danmarks Statistik; nothing is scraped, estimated or modelled. Prices are realised sale prices in kroner per square metre, averaged over the trailing four quarters. Areas with fewer than 10 sales in four quarters show no number.

## Pages

- [Map](${pageUrl("/")}): interactive map by landsdel, region, kommune or postal district
- [All areas](${pageUrl("/areas/")}): one table with the latest price, growth and selling time for every area, linking to each area page
- [Data & methods](${pageUrl("/methods/")}): sources, definitions, sample-size rules and known limits
- Area pages: ${pageUrl("/area/")}<kommune code>/ and ${pageUrl("/area/postnr/")}<postal code>/, each stating its latest figures in plain text

## Findings, ${SUMMARY_QUARTER}

${found}

## Data files

- [Kommune panel (Parquet)](${pageUrl("/data/panel_kommune.parquet")})
- [Postal district panel (Parquet)](${pageUrl("/data/panel_postnr.parquet")})
- [Latest-quarter summaries (JSON)](${pageUrl("/data/summaries.json")})
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
