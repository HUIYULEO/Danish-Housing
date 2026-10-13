/**
 * Every piece of interface text, in both languages.
 *
 * `da` is typed as `typeof en`, so a string added to one and forgotten in
 * the other is a compile error, not a blank on the Danish site.
 *
 * Danish statistical vocabulary follows Finans Danmark and Danmarks
 * Statistik: liggetid, udbudspris, handler, løbende/faste priser.
 */

import type { Locale } from "./i18n";

const en = {
  tagline: "See what is happening in Danish real estate",
  nav: {
    map: "Map",
    areas: "All areas",
    methods: "Data & methods",
    about: "About",
    /** The link to the other language, written in that language */
    switchTo: "Dansk",
  },

  metrics: {
    price: {
      label: "Price level",
      short: "Price",
      unit: "kr/m²",
      blurb:
        "Realised transaction price per square metre, averaged over the trailing four quarters.",
    },
    growth: {
      label: "Price growth (YoY)",
      short: "Growth",
      unit: "%",
      blurb:
        "Change in the trailing-four-quarter average price against the same period a year earlier.",
    },
    dom: {
      label: "Days on market",
      short: "Days",
      unit: "days",
      blurb:
        "Median time from listing to sale. Prices lag the market; selling time leads it — this moves first when the market turns.",
    },
    volume: {
      label: "Transactions",
      short: "Volume",
      unit: "sales",
      blurb: "Dwellings sold over the trailing four quarters.",
    },
    supply: {
      label: "Quarters of supply",
      short: "Supply",
      unit: "quarters",
      blurb:
        "Homes for sale at quarter end divided by homes sold that quarter — how long the standing stock would take to clear.",
    },
    afford: {
      label: "Years of income",
      short: "Years of income",
      unit: "years",
      blurb:
        "Years of a family's disposable income to buy 100 m² at local prices. " +
        "Both halves are same-year kroner, so this needs no inflation adjustment — " +
        "it is the one measure here the nominal/real switch cannot change.",
    },
    gap: {
      label: "Asking vs realised",
      short: "Gap",
      unit: "%",
      blurb:
        "How far the realised price landed from the initial asking price. Negative means sellers took less than they asked.",
    },
    stock: {
      label: "Homes for sale",
      short: "For sale",
      unit: "homes",
      blurb:
        "Homes standing on the market at the end of the month. Inventory builds before prices move.",
    },
    asking: {
      label: "Asking price",
      short: "Asking",
      unit: "kr/m²",
      blurb:
        "What sellers are asking for homes currently on the market. Higher than realised prices, because expensive homes linger and cheap ones clear.",
    },
    listed: {
      label: "Days listed so far",
      short: "Days listed",
      unit: "days",
      blurb:
        "How long the homes still for sale have been waiting. Not time-to-sale — these are the ones that have not sold.",
    },
  },
  metricsReal: {
    price: {
      label: "Price level, real",
      blurb:
        "Realised price per square metre, averaged over four quarters and " +
        "deflated to today's kroner using the consumer price index.",
    },
    growth: {
      label: "Price growth, real (YoY)",
      blurb:
        "Change in the four-quarter average price against a year earlier, " +
        "after stripping out consumer price inflation.",
    },
  },

  categories: {
    house: { label: "Houses", note: "Detached and terraced", noun: "houses", one: "house" },
    flat: {
      label: "Flats",
      note: "Owner-occupied flats — an urban market",
      noun: "flats",
      one: "flat",
    },
    holiday: {
      label: "Holiday homes",
      note: "Concentrated on the coasts",
      noun: "holiday homes",
      one: "holiday-home",
    },
  },
  levels: {
    landsdel: {
      one: "Landsdel",
      note: "11 areas — the level where Zealand, Funen and Jutland separate",
    },
    region: { one: "Region", note: "5 administrative regions" },
    kommune: { one: "Kommune", note: "98 municipalities" },
    postnr: {
      one: "Postal district",
      note: "605 postal districts — the finest level Finans Danmark publishes",
    },
  },
  reliability: {
    low: "Low sample",
    unverified: "Sample size not published before 2004",
    insufficient: "Insufficient data",
  },
  boards: {
    rising: { title: "Fastest rising", hint: "Biggest year-on-year price gain" },
    falling: { title: "Fastest falling", hint: "Biggest year-on-year price fall" },
    accelerating: { title: "Accelerating", hint: "Growth speeding up, and still positive" },
    cooling: { title: "Cooling", hint: "Growth slowing, but still positive" },
    heating: { title: "Heating up", hint: "Selling faster than a year ago" },
    stalling: { title: "Stalling", hint: "Taking longer to sell than a year ago" },
    stretching: {
      title: "Stretching",
      hint: "Prices pulling away from local incomes fastest",
    },
    easing: {
      title: "Coming back in reach",
      hint: "Local incomes gaining on prices fastest",
    },
  },
  windows: { "1Q": "1Q", "4Q": "4Q", "3Y": "3Y", "5Y": "5Y", "10Y": "10Y" },

  controls: {
    measure: "Measure",
    homes: "Homes",
    kroner: "Kroner",
    nominal: "Nominal",
    nominalTitle: "Prices as they were quoted at the time",
    real: "Inflation-adjusted",
    realTitle: "Deflated to today's kroner using the consumer price index",
    realShort: "Real kroner",
    data: "Data",
    areas: "Areas",
    changeOver: "Change over",
    quarterly: "Quarterly · sold",
    quarterlyTitle: "Realised transaction prices. The only frequency they exist at.",
    monthly: "Monthly · listed",
    monthlyTitle:
      "Listings: stock, asking price, days waiting. Four months fresher, but not sales.",
    monthlyTitlePostnr:
      "Listing statistics stop at kommune level — there is no monthly postal-district table.",
    historyUnavailable: "History unavailable",
  },
  headline: {
    grey: (gray: number, total: number, level: string) =>
      `${gray} of ${total} ${level} are grey: too little data to put a number on.`,
    afford: (quarter: string, year: number) =>
      `Prices are ${quarter}; incomes are ${year}, the latest year Danmarks Statistik has published.`,
  },
  ribbon: {
    price: "All Denmark · price",
    priceReal: "All Denmark · real price",
    yoy: "Year on year",
    medianArea: "median area",
    dom: "Median days on market",
    sales: "Sales, 4 quarters",
    supply: "Quarters of supply",
    asking: "Median asking price",
    forSale: "Homes for sale",
    allAreas: "all areas",
    listed: "Median days listed",
    stockYoy: "Stock vs a year ago",
    shown: (level: string) => `${level} shown`,
    find: "Find an area",
    theme: "Theme",
  },
  map: {
    attribution:
      "Boundaries: DAWA / Styrelsen for Dataforsyning og Infrastruktur · Data: Finans Danmark, Danmarks Statistik",
    aria: (metric: string, level: string, period: string) =>
      `Map of Denmark showing ${metric} by ${level} for ${period}`,
  },
  legend: {
    scale: (metric: string) => `${metric} colour scale`,
    noData: "No data published for this area",
    under: (v: string) => `under ${v}`,
    above: (v: string) => `${v} and above`,
    range: (a: string, b: string) => `${a} to ${b}`,
  },
  timeline: {
    pause: "Pause",
    play: "Play through time",
    playFromStart: "Play from the start",
    quarter: "Quarter",
    span: "Timeline span",
    tenYears: "10Y",
    since: (year: number) => `Since ${year}`,
  },
  ticker: {
    listings: "listings",
    onMarket: "Houses on the market right now",
    asking: "They are asking, on average",
    waiting: "And have been waiting",
    withdrawn: "Taken off the market unsold this month",
    yoy: "y/y",
    worthKnowing: "Worth knowing",
    previous: "Previous",
    next: "Next",
  },
  movers: {
    title: "Market movers",
    monthlyMode: "Monthly listings mode",
    basis: (unit: string, quarter: string) =>
      `${unit} with 40+ sales in the trailing four quarters · ${quarter}`,
    realSuffix: " · real kroner",
    loading: "Loading full history…",
    monthlyBefore:
      "The rankings rank movements in realised prices, which only exist quarterly. Switch back to ",
    monthlyAfter: " to see them. The map is still live — it is showing listings.",
    before2004: (quarter: string) =>
      `Transaction counts start in 2004, so nothing can be ranked in ${quarter} — the map still shows published prices.`,
    none: (unit: string, quarter: string) =>
      `No ${unit.toLowerCase().replace(/r$/, "")} clears the 40-sale bar for this measure in ${quarter}.`,
    now: (years: string) => `now ${years}`,
  },
  card: {
    close: "Close",
    nothingThisMonth: (noun: string) =>
      `Nothing published for ${noun} here this month — no listings on the market, or too few to report.`,
    tooFew: (noun: string, quarter: string, n: string | null) =>
      `Fewer than 10 ${noun} sold here in the four quarters to ${quarter}${
        n ? ` (${n})` : ""
      }. With a sample that thin, a price per square metre would say more about which handful of homes happened to change hands than about the market. We would rather show nothing.`,
    forSale: "Homes for sale",
    asking: "Asking price",
    listed: "Listed so far",
    stockYoy: "Stock vs a year ago",
    price: "Price",
    priceReal: "Price, today's kroner",
    yoy: "Year on year",
    yoyReal: "Year on year, real",
    dom: "Days on market",
    supply: "Quarters of supply",
    sales: "Sales, 4 quarters",
    gap: "Asking vs realised",
    yearsIncome: "Years of income",
    postnrs: "Postal districts",
    lowSample: (n: string) => `Low sample · ${n} — shown, but kept off the rankings`,
    more: (name: string) => `Full history for ${name} →`,
    loading: "Loading history…",
    sparkAria: (from: string, to: string) => `Price from ${from} to ${to}`,
  },
  detail: {
    loadError: "Could not load the history for this area",
    noSeries: (name: string) =>
      `Finans Danmark publishes no price series for ${name}. That is not a gap in this site — it means too few homes change hands here for a square-metre price to be meaningful, so the figure is withheld at source rather than published as a number nobody should trust.`,
    backToMap: "Back to the map",
    greyReason: (name: string) =>
      `, where ${name} is drawn in neutral grey for exactly this reason.`,
    sales: "Sales",
    subPrice: "per m², 4-quarter average",
    subDom: "median, listing to sale",
    subSales: "trailing four quarters",
    subSupply: "stock ÷ sales",
    subGap: "negative = sold under asking",
    subIncome: (year: number | string) => `for 100 m², family income ${year}`,
    chartPrice: "Price against the national average",
    captionPrice: (name: string, real: boolean) =>
      `${name} in colour, all of Denmark dashed in grey. ${
        real ? "Deflated to today's kroner." : "Nominal kroner."
      }`,
    chartAfford: "Years of income to buy 100 m²",
    captionAfford: (name: string) =>
      "Local price per m² × 100, divided by average disposable family income in the same area and year. " +
      `${name} in colour, all of Denmark dashed. ` +
      "Both halves are same-year kroner, so inflation cancels and the nominal/real switch does not apply here.",
    chartSold: "Homes sold each quarter",
    chartDom: "Days on market",
    inside: (name: string) => `Inside ${name}`,
    loadingPostnr: "Loading postal districts…",
    drillNone: (n: number, one: string, quarter: string) =>
      `None of the ${n} postal districts here had enough ${one} sales in the four quarters to ${quarter} to report a price. The kommune total above is still published — it pools all of them.`,
    colPostnr: "Postal district",
    colPrice: "Price",
    colYoy: "Year on year",
    colDays: "Days",
    colSales: "Sales",
    drillNote:
      "Rows marked · have 10-39 sales in the trailing four quarters: shown, but kept off the rankings. Districts with fewer than 10 are left out entirely.",
    drillBelow: (missing: number, total: number) =>
      ` ${missing} of ${total} districts here are below that bar this quarter.`,
    drillOwn:
      " These are each district's own published figures, not the kommune total split up — and about 23% of Danish postal districts straddle a kommune boundary, so they will not add back up to it.",
  },
  search: {
    placeholder: "Search an area or postcode",
    aria: "Search for a kommune, landsdel, region or postal district",
    locked: "Postal districts unlock once the query engine has loaded",
    postnr: "Postnr",
  },
  theme: { light: "Light", auto: "Follow system", dark: "Dark", aria: "Colour theme" },

  summary: {
    tooFew: (name: string) =>
      `Too few homes change hands in ${name} for a square-metre price to be published, so no figure is shown.`,
    price: (quarter: string, noun: string, name: string, price: string, yoy: string | null) =>
      `In ${quarter}, ${noun} in ${name} sold for ${price} on a trailing four-quarter average` +
      (yoy ? `, ${yoy} on a year earlier.` : "."),
    dom: (days: string) => `A sale took ${days} on average.`,
    sales: (n: string, low: boolean) =>
      `${n} changed hands over the four quarters${low ? ", a low sample." : "."}`,
    national: (price: string) => `Houses across Denmark as a whole sold for ${price}.`,
    meta: (
      label: string,
      name: string,
      price: string,
      quarter: string,
      yoy: string | null,
      days: string | null,
    ) =>
      `${label} in ${name}: ${price} in ${quarter}` +
      (yoy ? `, ${yoy} year on year` : "") +
      (days ? `, ${days} to sell` : "") +
      `. Prices, selling times, volume and supply since 1992, from Finans Danmark.`,
    metaNone: (name: string) =>
      `Too few homes sell in ${name} for a square-metre price to be published. Data from Finans Danmark.`,
  },

  pages: {
    siteTitle: "Danish Housing — see what is happening in Danish real estate",
    siteDescription:
      "Quarterly prices, selling times, transaction volume and supply for all 98 Danish kommuner and 605 postal districts since 1992, from Finans Danmark and Danmarks Statistik.",
    areaTitle: (name: string) => `${name} — Danish Housing`,
    areasTitle: "All areas — Danish Housing",
    areasDescription: (quarter: string) =>
      `House prices, year-on-year growth and selling times for every Danish landsdel, region, kommune and postal district, ${quarter}.`,
    areasH1: "All areas",
    areasIntroBefore: "Houses (detached and terraced), ",
    areasIntroAfter:
      ". Prices are realised sale prices per square metre, averaged over the trailing four quarters; growth compares that average with a year earlier. A dash means too few sales for a figure to be published.",
    colArea: "Area",
    colPrice: "Price",
    colYoy: "Year on year",
    colDays: "Days to sell",
    colSales: "Sales, 4 quarters",
    methodsTitle: "Data & methods — Danish Housing",
    methodsDescription:
      "Sources, definitions, sample-size rules and known limits behind the Danish housing map.",
    aboutTitle: "About — Danish Housing",
    aboutDescription:
      "Who built Danish Housing and how: a static site with no backend, querying Parquet in the browser with DuckDB WASM. Source code on GitHub.",
  },
};

export type Messages = typeof en;

const da: Messages = {
  tagline: "Se, hvad der sker på det danske boligmarked",
  nav: {
    map: "Kort",
    areas: "Alle områder",
    methods: "Data og metode",
    about: "Om",
    switchTo: "English",
  },

  metrics: {
    price: {
      label: "Prisniveau",
      short: "Pris",
      unit: "kr./m²",
      blurb:
        "Realiseret handelspris pr. kvadratmeter, som gennemsnit over de seneste fire kvartaler.",
    },
    growth: {
      label: "Prisudvikling (år til år)",
      short: "Udvikling",
      unit: "%",
      blurb:
        "Ændring i gennemsnitsprisen over de seneste fire kvartaler i forhold til samme periode året før.",
    },
    dom: {
      label: "Liggetid",
      short: "Liggetid",
      unit: "dage",
      blurb:
        "Median for antal dage fra udbud til salg. Priserne halter efter markedet, liggetiden går forud – den rykker sig først, når markedet vender.",
    },
    volume: {
      label: "Handler",
      short: "Handler",
      unit: "handler",
      blurb: "Solgte boliger over de seneste fire kvartaler.",
    },
    supply: {
      label: "Udbud målt i kvartalers salg",
      short: "Udbud",
      unit: "kvartaler",
      blurb:
        "Boliger til salg ved kvartalets udgang divideret med kvartalets salg – hvor længe det ville tage at sælge det aktuelle udbud.",
    },
    afford: {
      label: "Antal årsindkomster",
      short: "Årsindkomster",
      unit: "år",
      blurb:
        "Hvor mange års disponibel familieindkomst der skal til for at købe 100 m² til lokale priser. " +
        "Tæller og nævner er kroner fra samme år, så tallet skal ikke inflationskorrigeres – " +
        "det er det eneste mål her, som valget mellem løbende og faste priser ikke påvirker.",
    },
    gap: {
      label: "Udbudspris mod salgspris",
      short: "Afslag",
      unit: "%",
      blurb:
        "Hvor langt salgsprisen endte fra den første udbudspris. Negativt betyder, at sælger fik mindre end forlangt.",
    },
    stock: {
      label: "Boliger til salg",
      short: "Til salg",
      unit: "boliger",
      blurb:
        "Boliger udbudt til salg ved månedens udgang. Udbuddet vokser, før priserne flytter sig.",
    },
    asking: {
      label: "Udbudspris",
      short: "Udbudspris",
      unit: "kr./m²",
      blurb:
        "Hvad sælgerne forlanger for de boliger, der er til salg lige nu. Højere end salgspriserne, fordi dyre boliger bliver liggende, mens billige bliver solgt.",
    },
    listed: {
      label: "Liggetid for udbudte boliger",
      short: "Udbudt i",
      unit: "dage",
      blurb:
        "Hvor længe de boliger, der stadig er til salg, har ventet. Ikke tiden til salg – det er netop dem, der ikke er solgt.",
    },
  },
  metricsReal: {
    price: {
      label: "Prisniveau, faste priser",
      blurb:
        "Realiseret pris pr. kvadratmeter, som gennemsnit over fire kvartaler og " +
        "omregnet til nutidskroner med forbrugerprisindekset.",
    },
    growth: {
      label: "Prisudvikling, faste priser (år til år)",
      blurb:
        "Ændring i gennemsnitsprisen over fire kvartaler i forhold til året før, " +
        "renset for forbrugerprisinflation.",
    },
  },

  categories: {
    house: { label: "Huse", note: "Parcel- og rækkehuse", noun: "huse", one: "hus" },
    flat: {
      label: "Ejerlejligheder",
      note: "Ejerlejligheder – et bymarked",
      noun: "ejerlejligheder",
      one: "ejerlejligheds",
    },
    holiday: {
      label: "Fritidshuse",
      note: "Ligger især ved kysterne",
      noun: "fritidshuse",
      one: "fritidshus",
    },
  },
  levels: {
    landsdel: {
      one: "Landsdel",
      note: "11 områder – niveauet, hvor Sjælland, Fyn og Jylland skilles ad",
    },
    region: { one: "Region", note: "5 regioner" },
    kommune: { one: "Kommune", note: "98 kommuner" },
    postnr: {
      one: "Postnummer",
      note: "605 postnumre – det fineste niveau, Finans Danmark offentliggør",
    },
  },
  reliability: {
    low: "Få handler",
    unverified: "Antal handler ikke offentliggjort før 2004",
    insufficient: "For få data",
  },
  boards: {
    rising: { title: "Stiger mest", hint: "Største prisstigning år til år" },
    falling: { title: "Falder mest", hint: "Største prisfald år til år" },
    accelerating: { title: "Tager fart", hint: "Væksten tiltager og er stadig positiv" },
    cooling: { title: "Bremser op", hint: "Væksten aftager, men er stadig positiv" },
    heating: { title: "Sælger hurtigere", hint: "Kortere liggetid end for et år siden" },
    stalling: { title: "Sælger langsommere", hint: "Længere liggetid end for et år siden" },
    stretching: {
      title: "Sværere at nå",
      hint: "Priserne løber hurtigst fra de lokale indkomster",
    },
    easing: {
      title: "Lettere at nå",
      hint: "De lokale indkomster haler hurtigst ind på priserne",
    },
  },
  windows: { "1Q": "1 kvt.", "4Q": "1 år", "3Y": "3 år", "5Y": "5 år", "10Y": "10 år" },

  controls: {
    measure: "Mål",
    homes: "Boligtype",
    kroner: "Kroner",
    nominal: "Løbende priser",
    nominalTitle: "Priserne, som de var på tidspunktet",
    real: "Faste priser",
    realTitle: "Omregnet til nutidskroner med forbrugerprisindekset",
    realShort: "Faste priser",
    data: "Data",
    areas: "Områder",
    changeOver: "Ændring over",
    quarterly: "Kvartal · solgt",
    quarterlyTitle: "Realiserede handelspriser. De findes kun på kvartalsbasis.",
    monthly: "Måned · udbudt",
    monthlyTitle:
      "Udbud: antal til salg, udbudspris, liggetid. Fire måneder nyere, men ikke salg.",
    monthlyTitlePostnr:
      "Udbudsstatistikken stopper ved kommuneniveau – der findes ingen månedstabel for postnumre.",
    historyUnavailable: "Historikken kunne ikke hentes",
  },
  headline: {
    grey: (gray, total, level) =>
      `${gray} af ${total} ${level} er grå: for få data til at sætte tal på.`,
    afford: (quarter, year) =>
      `Priserne er fra ${quarter}; indkomsterne er fra ${year}, det seneste år Danmarks Statistik har offentliggjort.`,
  },
  ribbon: {
    price: "Hele landet · pris",
    priceReal: "Hele landet · faste priser",
    yoy: "År til år",
    medianArea: "medianområde",
    dom: "Median for liggetid",
    sales: "Handler, 4 kvartaler",
    supply: "Udbud i kvartalers salg",
    asking: "Median for udbudspris",
    forSale: "Boliger til salg",
    allAreas: "alle områder",
    listed: "Median for udbudt i",
    stockYoy: "Udbud mod sidste år",
    shown: (level) => `${level} vist`,
    find: "Find et område",
    theme: "Tema",
  },
  map: {
    attribution:
      "Grænser: DAWA / Styrelsen for Dataforsyning og Infrastruktur · Data: Finans Danmark, Danmarks Statistik",
    aria: (metric, level, period) =>
      `Danmarkskort, der viser ${metric} fordelt på ${level} for ${period}`,
  },
  legend: {
    scale: (metric) => `Farveskala for ${metric}`,
    noData: "Ingen data offentliggjort for dette område",
    under: (v) => `under ${v}`,
    above: (v) => `${v} og derover`,
    range: (a, b) => `${a} til ${b}`,
  },
  timeline: {
    pause: "Pause",
    play: "Afspil over tid",
    playFromStart: "Afspil fra begyndelsen",
    quarter: "Kvartal",
    span: "Tidsrum",
    tenYears: "10 år",
    since: (year) => `Siden ${year}`,
  },
  ticker: {
    listings: "udbud",
    onMarket: "Huse til salg lige nu",
    asking: "Der forlanges i gennemsnit",
    waiting: "Og de har ventet i",
    withdrawn: "Taget af markedet usolgt denne måned",
    yoy: "år/år",
    worthKnowing: "Værd at vide",
    previous: "Forrige",
    next: "Næste",
  },
  movers: {
    title: "Størst bevægelse",
    monthlyMode: "Månedlige udbudstal",
    basis: (unit, quarter) =>
      `${unit} med mindst 40 handler de seneste fire kvartaler · ${quarter}`,
    realSuffix: " · faste priser",
    loading: "Henter hele historikken…",
    monthlyBefore:
      "Listerne rangerer bevægelser i realiserede priser, og de findes kun på kvartalsbasis. Skift tilbage til ",
    monthlyAfter: " for at se dem. Kortet virker stadig – det viser udbud.",
    before2004: (quarter) =>
      `Antallet af handler opgøres først fra 2004, så intet kan rangeres i ${quarter} – kortet viser stadig de offentliggjorte priser.`,
    none: (unit, quarter) =>
      `Ingen ${unit.toLowerCase()} når grænsen på 40 handler for dette mål i ${quarter}.`,
    now: (years) => `nu ${years}`,
  },
  card: {
    close: "Luk",
    nothingThisMonth: (noun) =>
      `Intet offentliggjort for ${noun} her i denne måned – ingen boliger til salg, eller for få til at opgøre.`,
    tooFew: (noun, quarter, n) =>
      `Færre end 10 ${noun} blev solgt her i de fire kvartaler til og med ${quarter}${
        n ? ` (${n})` : ""
      }. Med så få handler ville en kvadratmeterpris sige mere om, hvilke få boliger der tilfældigvis skiftede ejer, end om markedet. Så hellere vise ingenting.`,
    forSale: "Boliger til salg",
    asking: "Udbudspris",
    listed: "Udbudt i",
    stockYoy: "Udbud mod sidste år",
    price: "Pris",
    priceReal: "Pris, nutidskroner",
    yoy: "År til år",
    yoyReal: "År til år, faste priser",
    dom: "Liggetid",
    supply: "Udbud i kvartalers salg",
    sales: "Handler, 4 kvartaler",
    gap: "Udbudspris mod salgspris",
    yearsIncome: "Årsindkomster",
    postnrs: "Postnumre",
    lowSample: (n) => `Få handler · ${n} – vises, men holdes ude af listerne`,
    more: (name) => `Hele historikken for ${name} →`,
    loading: "Henter historik…",
    sparkAria: (from, to) => `Pris fra ${from} til ${to}`,
  },
  detail: {
    loadError: "Historikken for dette område kunne ikke hentes",
    noSeries: (name) =>
      `Finans Danmark offentliggør ingen prisserie for ${name}. Det er ikke et hul i dette site – det betyder, at for få boliger skifter ejer her til, at en kvadratmeterpris giver mening, så tallet tilbageholdes ved kilden i stedet for at blive offentliggjort som et tal, ingen bør stole på.`,
    backToMap: "Tilbage til kortet",
    greyReason: (name) => `, hvor ${name} netop derfor er tegnet i neutral grå.`,
    sales: "Handler",
    subPrice: "pr. m², gennemsnit over 4 kvartaler",
    subDom: "median, fra udbud til salg",
    subSales: "seneste fire kvartaler",
    subSupply: "udbud ÷ salg",
    subGap: "negativt = solgt under udbudsprisen",
    subIncome: (year) => `for 100 m², familieindkomst ${year}`,
    chartPrice: "Pris i forhold til landsgennemsnittet",
    captionPrice: (name, real) =>
      `${name} i farve, hele landet stiplet i grå. ${
        real ? "Omregnet til nutidskroner." : "Løbende priser."
      }`,
    chartAfford: "Årsindkomster for at købe 100 m²",
    captionAfford: (name) =>
      "Lokal pris pr. m² × 100 divideret med den gennemsnitlige disponible familieindkomst i samme område og år. " +
      `${name} i farve, hele landet stiplet. ` +
      "Tæller og nævner er kroner fra samme år, så inflationen går ud, og valget mellem løbende og faste priser gælder ikke her.",
    chartSold: "Solgte boliger pr. kvartal",
    chartDom: "Liggetid",
    inside: (name) => `Inden for ${name}`,
    loadingPostnr: "Henter postnumre…",
    drillNone: (n, one, quarter) =>
      `Ingen af de ${n} postnumre her havde nok ${one}handler i de fire kvartaler til og med ${quarter} til, at en pris kan opgøres. Kommunens samlede tal ovenfor offentliggøres stadig – det dækker dem alle.`,
    colPostnr: "Postnummer",
    colPrice: "Pris",
    colYoy: "År til år",
    colDays: "Dage",
    colSales: "Handler",
    drillNote:
      "Rækker markeret med · har 10-39 handler de seneste fire kvartaler: de vises, men holdes ude af listerne. Postnumre med færre end 10 er helt udeladt.",
    drillBelow: (missing, total) =>
      ` ${missing} af ${total} postnumre her ligger under den grænse i dette kvartal.`,
    drillOwn:
      " Det er hvert postnummers egne offentliggjorte tal, ikke kommunens tal fordelt ud – og omkring 23 % af de danske postnumre krydser en kommunegrænse, så de kan ikke lægges sammen til kommunens tal.",
  },
  search: {
    placeholder: "Søg på område eller postnummer",
    aria: "Søg efter en kommune, landsdel, region eller et postnummer",
    locked: "Postnumre kan vælges, når databasen er indlæst",
    postnr: "Postnr.",
  },
  theme: { light: "Lyst", auto: "Følg systemet", dark: "Mørkt", aria: "Farvetema" },

  summary: {
    tooFew: (name) =>
      `For få boliger skifter ejer i ${name} til, at en kvadratmeterpris kan offentliggøres, så der vises intet tal.`,
    price: (quarter, noun, name, price, yoy) =>
      `I ${quarter} blev ${noun} i ${name} solgt for ${price} i gennemsnit over de seneste fire kvartaler` +
      (yoy ? `, ${yoy} i forhold til året før.` : "."),
    dom: (days) => `Et salg tog i gennemsnit ${days}.`,
    sales: (n, low) =>
      `${n} blev handlet over de fire kvartaler${low ? " – et lille antal handler." : "."}`,
    national: (price) => `Huse i hele landet blev solgt for ${price}.`,
    meta: (label, name, price, quarter, yoy, days) =>
      `${label} i ${name}: ${price} i ${quarter}` +
      (yoy ? `, ${yoy} år til år` : "") +
      (days ? `, liggetid ${days}` : "") +
      `. Priser, liggetid, handler og udbud siden 1992, fra Finans Danmark.`,
    metaNone: (name) =>
      `For få boliger sælges i ${name} til, at en kvadratmeterpris kan offentliggøres. Data fra Finans Danmark.`,
  },

  pages: {
    siteTitle: "Danish Housing – se, hvad der sker på det danske boligmarked",
    siteDescription:
      "Kvartalsvise priser, liggetid, handler og udbud for alle 98 kommuner og 605 postnumre siden 1992, fra Finans Danmark og Danmarks Statistik.",
    areaTitle: (name) => `${name} – Danish Housing`,
    areasTitle: "Alle områder – Danish Housing",
    areasDescription: (quarter) =>
      `Huspriser, udvikling år til år og liggetid for alle landsdele, regioner, kommuner og postnumre i Danmark, ${quarter}.`,
    areasH1: "Alle områder",
    areasIntroBefore: "Huse (parcel- og rækkehuse), ",
    areasIntroAfter:
      ". Priserne er realiserede salgspriser pr. kvadratmeter som gennemsnit over de seneste fire kvartaler; udviklingen sammenligner det gennemsnit med året før. En streg betyder, at der er for få handler til, at et tal kan offentliggøres.",
    colArea: "Område",
    colPrice: "Pris",
    colYoy: "År til år",
    colDays: "Liggetid",
    colSales: "Handler, 4 kvartaler",
    methodsTitle: "Data og metode – Danish Housing",
    methodsDescription:
      "Kilder, definitioner, regler for antal handler og kendte begrænsninger bag det danske boligkort.",
    aboutTitle: "Om – Danish Housing",
    aboutDescription:
      "Hvem der har bygget Danish Housing og hvordan: et statisk site uden backend, der forespørger Parquet i browseren med DuckDB WASM. Kildekoden ligger på GitHub.",
  },
};

export const MESSAGES: Record<Locale, Messages> = { en, da };
