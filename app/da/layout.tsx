import { LocaleProvider } from "@/components/LocaleProvider";

/**
 * Everything under /da/ is Danish.
 *
 * The root layout owns <html lang="en"> and cannot vary it per route without
 * a second root layout, which would cost the shared not-found page and the
 * shared metadata files. Marking the language on a wrapper is valid HTML and
 * is what screen readers and translators actually read; `display: contents`
 * keeps the wrapper out of the page's layout.
 */
export default function DanishLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="da">
      <div lang="da" style={{ display: "contents" }}>
        {children}
      </div>
    </LocaleProvider>
  );
}
