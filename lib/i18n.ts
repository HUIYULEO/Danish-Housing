/**
 * Two languages, English at the root and Danish under /da/.
 *
 * English keeps the root so every link published before the Danish version
 * existed still works. Paths passed around the code are locale-less
 * ("/areas/"); localePath() puts the prefix on.
 */

export type Locale = "en" | "da";

export const LOCALES: Locale[] = ["en", "da"];

export const otherLocale = (l: Locale): Locale => (l === "en" ? "da" : "en");

export const localePath = (l: Locale, path: string) =>
  l === "da" ? `/da${path}` : path;
