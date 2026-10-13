import Link from "next/link";
import { localePath, otherLocale, type Locale } from "@/lib/i18n";
import { MESSAGES } from "@/lib/messages";

type NavKey = "map" | "areas" | "methods" | "about";

const NAV: { key: NavKey; path: string }[] = [
  { key: "map", path: "/" },
  { key: "areas", path: "/areas/" },
  { key: "methods", path: "/methods/" },
  { key: "about", path: "/about/" },
];

/**
 * The header shared by every page.
 *
 * `path` is this page's own locale-less path. It does two jobs: the nav
 * leaves out the link to the page you are on, and the language switch goes
 * to the same page in the other language rather than dumping you on the
 * home page.
 */
export default function Masthead({
  locale,
  path,
  tag,
}: {
  locale: Locale;
  path: string;
  /** Small text next to the site name: the tagline, or what kind of page this is */
  tag?: string;
}) {
  const t = MESSAGES[locale];
  const other = otherLocale(locale);
  return (
    <header className="masthead">
      <div className="masthead__mark">
        Danish Housing<span>.</span>
      </div>
      {tag && <div className="masthead__tag">{tag}</div>}
      <nav className="masthead__nav">
        {NAV.filter((n) => n.path !== path).map((n) => (
          <Link key={n.key} href={localePath(locale, n.path)}>
            {t.nav[n.key]}
          </Link>
        ))}
        <Link href={localePath(other, path)} hrefLang={other} lang={other}>
          {t.nav.switchTo}
        </Link>
      </nav>
    </header>
  );
}
