import Link from "next/link";
import Masthead from "@/components/Masthead";
import snapshot from "../../public/data/snapshot.json";
import { formatters } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n";

const REPO = "https://github.com/HUIYULEO/Danish-Housing";
const EMAIL = "luhy0629@outlook.com";

/**
 * The site is a technical showcase as much as a data product, so this page
 * says how it is put together, not only who made it.
 */
export default function AboutView({ locale }: { locale: Locale }) {
  const quarter = formatters(locale).quarter(snapshot.quarter);
  const methods = localePath(locale, "/methods/");
  return (
    <div className="shell">
      <Masthead locale={locale} path="/about/" />
      {locale === "da" ? (
        <Da quarter={quarter} methods={methods} />
      ) : (
        <En quarter={quarter} methods={methods} />
      )}
    </div>
  );
}

interface Props {
  quarter: string;
  methods: string;
}

function En({ quarter, methods }: Props) {
  return (
    <main className="prose">
      <h1>About</h1>
      <p>
        Danish Housing puts thirty-four years of Danish house prices, selling
        times, transaction volume and supply on one map: every kommune and
        postal district, every quarter since 1992. It is an independent
        project, built to see what official statistics can show when they are
        made easy to look at. It is not a valuation, a forecast, or advice
        about buying or selling a home.
      </p>
      <p>
        The data currently runs to <strong>{quarter}</strong> and is refreshed
        automatically every month. Where the numbers come from and how they
        are treated is on the <Link href={methods}>Data &amp; methods</Link>{" "}
        page.
      </p>

      <h2>How it is built</h2>
      <p>
        There is no backend and no database server. The whole site is static
        files.
      </p>
      <ul>
        <li>
          <strong>Pipeline.</strong> A Python job pulls the public tables from
          Finans Danmark and Danmarks Statistik, joins them into one panel per
          geographic level, computes rolling four-quarter measures and
          inflation-adjusted prices, grades every figure by sample size, and
          writes a few megabytes of Parquet.
        </li>
        <li>
          <strong>Queries in the browser.</strong> DuckDB compiled to
          WebAssembly reads that Parquet over HTTP range requests, fetching
          only the row groups a query touches. The timeline, the rankings and
          every chart are SQL running on your own machine.
        </li>
        <li>
          <strong>First paint without the engine.</strong> The query engine is
          larger than the data it queries, so the map does not wait for it:
          the latest quarter ships as a small snapshot and the engine loads
          behind it.
        </li>
        <li>
          <strong>Map.</strong> MapLibre GL with no basemap tiles. Colours are
          set through feature state, so scrubbing the timeline updates the map
          without rebuilding any geometry.
        </li>
        <li>
          <strong>Pages.</strong> Next.js static export, in English and
          Danish. Each of the 700-odd area pages has its headline figures
          written into the HTML at build time, so it reads without JavaScript.
        </li>
      </ul>

      <h2>Rules it holds itself to</h2>
      <ul>
        <li>
          Only official, published figures. Nothing scraped, estimated or
          modelled.
        </li>
        <li>
          An area with too few sales shows grey and no number, however good
          the map would look with it filled in.
        </li>
        <li>
          Growth is always measured on four-quarter averages, never one
          quarter against another.
        </li>
      </ul>

      <h2>Source and contact</h2>
      <p>
        The code is open source under the MIT licence:{" "}
        <a href={REPO}>github.com/HUIYULEO/Danish-Housing</a>. Bug reports and
        questions are welcome as <a href={`${REPO}/issues`}>issues on GitHub</a>
        , or by email at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
      <p>
        Housing market data: Finans Danmark, Boligmarkedsstatistikken, via
        Danmarks Statistik. Boundaries: Styrelsen for Dataforsyning og
        Infrastruktur.
      </p>
    </main>
  );
}

function Da({ quarter, methods }: Props) {
  return (
    <main className="prose">
      <h1>Om</h1>
      <p>
        Danish Housing samler 34 års danske boligpriser, liggetider, handler
        og udbud på ét kort: hver kommune og hvert postnummer, hvert kvartal
        siden 1992. Det er et uafhængigt projekt, lavet for at se, hvad den
        officielle statistik kan vise, når den bliver gjort let at se på. Det
        er ikke en vurdering, en prognose eller rådgivning om køb eller salg
        af bolig.
      </p>
      <p>
        Data går i øjeblikket til og med <strong>{quarter}</strong> og bliver
        opdateret automatisk hver måned. Hvor tallene kommer fra, og hvordan
        de behandles, står på siden <Link href={methods}>Data og metode</Link>.
      </p>

      <h2>Sådan er det bygget</h2>
      <p>
        Der er ingen backend og ingen databaseserver. Hele sitet er statiske
        filer.
      </p>
      <ul>
        <li>
          <strong>Datakørsel.</strong> Et Python-job henter de offentlige
          tabeller fra Finans Danmark og Danmarks Statistik, samler dem til ét
          panel pr. geografisk niveau, beregner glidende gennemsnit over fire
          kvartaler og inflationskorrigerede priser, vurderer hvert tal efter
          antallet af handler og skriver nogle få megabyte Parquet.
        </li>
        <li>
          <strong>Forespørgsler i browseren.</strong> DuckDB kompileret til
          WebAssembly læser Parquet-filerne med HTTP range requests og henter
          kun de rækkegrupper, en forespørgsel berører. Tidslinjen, listerne
          og alle grafer er SQL, der kører på din egen maskine.
        </li>
        <li>
          <strong>Første visning uden databasen.</strong> Databasemotoren
          fylder mere end de data, den forespørger, så kortet venter ikke på
          den: det seneste kvartal sendes med som et lille øjebliksbillede, og
          motoren indlæses bagefter.
        </li>
        <li>
          <strong>Kort.</strong> MapLibre GL uden baggrundskort. Farverne
          sættes via feature state, så tidslinjen kan opdatere kortet uden at
          genopbygge geometrien.
        </li>
        <li>
          <strong>Sider.</strong> Statisk eksport fra Next.js, på dansk og
          engelsk. Hver af de godt 700 områdesider har sine hovedtal skrevet
          ind i HTML-koden ved bygning, så siden kan læses uden JavaScript.
        </li>
      </ul>

      <h2>Regler, sitet holder sig til</h2>
      <ul>
        <li>
          Kun officielle, offentliggjorte tal. Intet er skrabet, estimeret
          eller modelleret.
        </li>
        <li>
          Et område med for få handler vises gråt og uden tal, uanset hvor
          godt kortet ville se ud, hvis det var fyldt ud.
        </li>
        <li>
          Udviklingen måles altid på gennemsnit over fire kvartaler, aldrig på
          ét kvartal mod et andet.
        </li>
      </ul>

      <h2>Kildekode og kontakt</h2>
      <p>
        Koden er open source under MIT-licensen:{" "}
        <a href={REPO}>github.com/HUIYULEO/Danish-Housing</a>. Fejlrapporter og
        spørgsmål er velkomne som <a href={`${REPO}/issues`}>issues på GitHub</a>{" "}
        eller pr. e-mail til <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
      <p>
        Boligmarkedsdata: Finans Danmark, Boligmarkedsstatistikken, via
        Danmarks Statistik. Grænser: Styrelsen for Dataforsyning og
        Infrastruktur.
      </p>
    </main>
  );
}
