import type { MethodsProps } from "./MethodsView";

export default function MethodsDa({
  quarter,
  quarterCode,
  latestMonth,
  tally,
}: MethodsProps) {
  const cats = [
    ["Huse", "house"],
    ["Ejerlejligheder", "flat"],
    ["Fritidshuse", "holiday"],
  ] as const;

  return (
    <main className="prose">
      <h1>Data og metode</h1>
      <p>
        Alt her kommer fra to gratis, offentlige kilder. Der er ingen
        proprietære data, ingen scraping og ingen estimerede eller modellerede
        priser. Det seneste kvartal er <strong>{quarter}</strong>.
      </p>

      <h2>Kilder</h2>
      <table>
        <thead>
          <tr>
            <th>Tabel</th>
            <th>Niveau</th>
            <th>Dækker</th>
            <th>Indhold</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>BM010</code> / <code>BM011</code></td>
            <td>Kommune / postnummer</td>
            <td>1992Q1–{quarterCode}</td>
            <td>Pris pr. m², udbudspris og salgspris</td>
          </tr>
          <tr>
            <td><code>BM020</code> / <code>BM021</code></td>
            <td>Kommune / postnummer</td>
            <td>2004Q1–{quarterCode}</td>
            <td>Solgte boliger og boliger til salg ved kvartalets udgang</td>
          </tr>
          <tr>
            <td><code>BM030</code> / <code>BM031</code></td>
            <td>Kommune / postnummer</td>
            <td>2004Q1–{quarterCode}</td>
            <td>Liggetid i dage</td>
          </tr>
          <tr>
            <td>
              <code>UDB010</code> / <code>UDB020</code> / <code>UDB030</code>
            </td>
            <td>Kommune, månedligt</td>
            <td>2004M01–{latestMonth}</td>
            <td>Udbud: antal til salg, udbudspris, liggetid</td>
          </tr>
          <tr>
            <td><code>PRIS113</code></td>
            <td>Hele landet, månedligt</td>
            <td>1980M01–</td>
            <td>Forbrugerprisindeks til inflationskorrektionen</td>
          </tr>
        </tbody>
      </table>
      <p>
        Boligmarkedsstatistikken udgives af <strong>Finans Danmark</strong> og
        hentes via Danmarks Statistiks Statistikbank-API. Grænserne kommer fra{" "}
        <strong>DAWA</strong>, Styrelsen for Dataforsyning og Infrastruktur.
      </p>

      <h2>Fire geografiske niveauer, ét sæt tabeller</h2>
      <p>
        Kortet tegner <strong>11 landsdele</strong>, <strong>5 regioner</strong>,{" "}
        <strong>98 kommuner</strong> eller <strong>605 postnumre</strong>.
        Ingen af dem er lagt sammen af os: Finans Danmark offentliggør hvert
        niveau som egne rækker, så et tal for en landsdel er deres tal, ikke
        vores sum af kommuner. Det betyder noget, fordi postnumre og kommuner
        ikke ligger pænt inden i hinanden, og en sammenlægning på tværs af
        grænser ville tælle noget dobbelt uden at det kunne ses.
      </p>
      <p>
        Det er på landsdelsniveau, at Danmarks egentlige geografi træder frem:
        Sjælland og hovedstadsområdet, Fyn, de fire jyske landsdele og
        Bornholm for sig. Den typiske landsdel på Sjælland koster tæt på tre
        gange så meget som den typiske i Jylland.
      </p>

      <h2>Salg pr. kvartal, udbud pr. måned</h2>
      <p>
        Der er to forskellige ure i disse data, og kortet skifter mellem dem
        i stedet for at lade, som om de er ét.
      </p>
      <ul>
        <li>
          <strong>Kvartal · solgt</strong> – realiserede handelspriser, antal
          handler og liggetid frem til salg. De findes kun på kvartalsbasis.
          Det seneste er {quarter}.
        </li>
        <li>
          <strong>Måned · udbudt</strong> – boliger, der står til salg, hvad
          sælgerne forlanger for dem, og hvor længe de har ventet. Månedligt,
          pr. kommune og fire måneder nyere end salgstallene.
        </li>
      </ul>
      <p>
        Udbudssiden er ikke en hurtigere udgave af salgssiden. Udbudspriserne
        på usolgte boliger ligger et godt stykke over de realiserede priser,
        fordi dyre boliger bliver liggende, mens billige hurtigt bliver solgt;
        de to serier måler forskellige boliger. Det, udbudssiden giver, er et
        forvarsel: udbud og udbudspriser flytter sig før de realiserede
        priser. Der findes ingen månedlig serie for realiserede priser i de
        gratis data, og vi fremstiller ikke en ved at interpolere
        kvartalstallene.
      </p>

      <h2>Reglen om antal handler</h2>
      <p>
        En kvadratmeterpris beregnet på fire handler er ikke et markedssignal,
        det er en anekdote. Hvert område vurderes efter, hvor mange boliger
        der faktisk er solgt dér i de <strong>seneste fire kvartaler</strong>,
        og vurderingen afgør, hvad vi vil tegne.
      </p>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Handler på 4 kvartaler</th>
            <th>Hvad vi gør</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>ok</code></td>
            <td>40 eller flere</td>
            <td>Farvelagt på kortet, kan komme på listerne</td>
          </tr>
          <tr>
            <td><code>low</code></td>
            <td>10–39</td>
            <td>Farvelagt, mærket &ldquo;få handler&rdquo;, holdt ude af listerne</td>
          </tr>
          <tr>
            <td><code>unverified</code></td>
            <td>Ikke offentliggjort</td>
            <td>Farvelagt, mærket, holdt ude af listerne</td>
          </tr>
          <tr>
            <td><code>insufficient</code></td>
            <td>Under 10, eller ingen pris</td>
            <td>Neutral grå, intet tal vises</td>
          </tr>
        </tbody>
      </table>
      <p>
        Grænsen ligger på fire kvartaler i stedet for ét af en konkret grund:
        i et enkelt kvartal har det midterste postnummer omkring ti
        hushandler, og cirka halvdelen har færre end ti. En regel på ét
        kvartal ville gøre det halve land gråt.
      </p>
      <p>
        <code>unverified</code> findes, fordi de to serier begynder i hvert
        sit årti. Priserne går tilbage til 1992; antallet af handler opgøres
        først fra 2004. At kalde 1992&ndash;2003 for <code>insufficient</code>{" "}
        ville være at påstå, at vi ved, at de markeder var tynde, og det ved
        vi ikke – vi har blot intet antal for dem. Derfor beholder de
        kvartaler deres offentliggjorte pris og får mærket i stedet, og der
        laves ingen lister ud fra dem. Træk tidslinjen tilbage før 2004, og
        kortet virker stadig; listerne er med rette tomme.
      </p>

      <h2>Dækning lige nu</h2>
      <p>
        For {quarter}, ud af {tally("house").n} kommuner:
      </p>
      <table>
        <thead>
          <tr>
            <th>Boligtype</th>
            <th>ok</th>
            <th>low</th>
            <th>unverified</th>
            <th>insufficient</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(([label, id]) => {
            const t = tally(id);
            return (
              <tr key={id}>
                <td>{label}</td>
                <td className="num">{t.ok}</td>
                <td className="num">{t.low}</td>
                <td className="num">{t.unv}</td>
                <td className="num">{t.ins}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Huse fylder næsten hele kortet ud. Det gør ejerlejligheder og
        fritidshuse ikke, og det er ikke en fejl i data – i det meste af
        landdistrikterne er der ingen ejerlejligheder at sælge, og
        fritidshusene ligger ved kysterne. Grå betyder &ldquo;vi ved det
        ikke&rdquo;, aldrig &ldquo;nul&rdquo;.
      </p>

      <h2>Definitioner</h2>
      <ul>
        <li>
          <strong>Pris</strong> – realiseret pris pr. kvadratmeter som
          gennemsnit over de seneste fire kvartaler.
        </li>
        <li>
          <strong>Prisudvikling</strong> – det gennemsnit over fire kvartaler
          i forhold til samme gennemsnit året før. Udviklingen beregnes aldrig
          på priser for enkelte kvartaler; med få handler giver det et
          savtakket forløb, der ligner nyheder, men er støj.
        </li>
        <li>
          <strong>Faste priser</strong> – de samme tal korrigeret med
          forbrugerprisindekset og udtrykt i kroner fra {quarter}, så
          &ldquo;faste priser&rdquo; læses som &ldquo;hvad det ville svare til
          i dag&rdquo;. Over tre årtier betyder det meget: et godt stykke over
          halvdelen af den nominelle stigning siden begyndelsen af
          1990&rsquo;erne er inflation.
        </li>
        <li>
          <strong>Liggetid</strong> – median for antal dage fra udbud til
          salg.
        </li>
        <li>
          <strong>Udbud målt i kvartalers salg</strong> – boliger til salg ved
          kvartalets udgang divideret med kvartalets salg.
        </li>
        <li>
          <strong>Udbudspris mod salgspris</strong> – den realiserede pris i
          forhold til den første udbudspris. Negativt betyder, at sælgerne
          accepterede mindre, end de først forlangte.
        </li>
      </ul>

      <h2>Kendte begrænsninger</h2>
      <ul>
        <li>
          <strong>Et nul i liggetidstabellen er manglende data.</strong>{" "}
          Omkring 28 % af de &ldquo;gyldige&rdquo; værdier på postnummerniveau
          er 0 dage, hvilket betyder ingen handel i det kvartal, ikke et salg
          på nul dage. Hvis de fik lov at stå, ville hvert stille
          landdistrikt fremstå som Danmarks hotteste marked. Vi behandler de
          nuller som manglende.
        </li>
        <li>
          <strong>Månedsstriben er ikke kortet.</strong> Striben øverst er
          fire måneder foran kvartalstallene, men den måler udbud, ikke salg:
          hvad sælgerne forlanger for de boliger, der står til salg, og hvor
          længe de har ventet. Udbudspriserne på usolgte boliger ligger et
          godt stykke over de realiserede priser, fordi dyre boliger bliver
          liggende, og billige bliver solgt. Der findes ingen månedlig serie
          for realiserede priser i de gratis data, og vi fremstiller ikke en.
        </li>
        <li>
          <strong>Inflationskorrektionen bygger på én antagelse.</strong>{" "}
          Forbrugerprisindekset offentliggøres et kvartal efter boligtallene,
          så det seneste kvartal genbruger den sidst offentliggjorte
          indeksværdi. Det undervurderer inflationen med højst ét kvartal,
          omkring en halv procent.
        </li>
        <li>
          <strong>Kvartaler, ikke måneder.</strong> Den gratis serie for
          realiserede priser er kvartalsvis, så det korteste skridt på kortet
          er ét kvartal. Vi vil hellere vise en langsommere, sand frekvens end
          interpolere en hurtigere, falsk.
        </li>
        <li>
          <strong>
            Farverne er inddelt i trin, og trinene ligger fast over tid.
          </strong>{" "}
          Kortet bruger adskilte klasser i stedet for en glidende overgang, så
          en farve på kortet kan findes som et nummereret trin i
          signaturforklaringen og læses tilbage som en værdi. Trinene er
          fastlagt én gang ud fra 2.–98. percentil over alle kvartaler siden
          2004 – ikke beregnet på ny hvert kvartal – så tidslinjen viser, at
          markedet faktisk bliver varmere og koldere, og ikke kun at
          rækkefølgen bytter rundt. Områder ud over yderpunkterne falder i det
          yderste trin i stedet for at trække skalaen flad for alle andre.
        </li>
        <li>
          <strong>Postnumre ligger ikke inden i kommuner.</strong> Omkring
          23 % krydser en grænse, så tal for postnumre lægges aldrig sammen
          til tal for kommuner – kommunetallene kommer fra deres egne
          officielle tabeller.
        </li>
      </ul>

      <h2>Kilder og forbehold</h2>
      <p>
        Boligmarkedsdata: Finans Danmark, Boligmarkedsstatistikken, via
        Danmarks Statistik. Administrative grænser: Styrelsen for
        Dataforsyning og Infrastruktur (DAWA). Dette er et
        datavisualiseringsprojekt. Det er ikke en vurdering, en prognose eller
        rådgivning om køb eller salg af bolig.
      </p>
    </main>
  );
}
