// data/*.geojson (raw DAWA, one or two hundred MB) -> public/geo/*.geojson
// PRD §11 requires simplification before launch. 0.5% + precision 0.001
// gives a 439 KB kommuner file in practice.
//
// mapshaper's Node API is used instead of the command line: the -each
// expressions contain semicolons, quotes and regexes, which a shell would
// split apart, while without a shell Windows refuses to spawn a .cmd.
// Calling the API directly avoids both problems.
import mapshaper from "mapshaper";
import { statSync, existsSync, mkdirSync } from "node:fs";

mkdirSync("public/geo", { recursive: true });

const jobs = [
  {
    src: "data/kommuner.geojson",
    dst: "public/geo/kommuner.geojson",
    fields: "kode,navn,regionsnavn",
    // kode is 4 digits with leading zeros, '0101'; BM010's OMR20 is '101'. Aligned here
    each: 'code = kode.replace(/^0+/, ""), name = navn, region = regionsnavn, delete kode, delete navn, delete regionsnavn',
  },
  {
    // The ETL has already aligned region / landsdel codes to DST's OMR20 codes
    src: "data/regioner.geojson",
    dst: "public/geo/regioner.geojson",
    fields: "code,name",
  },
  {
    src: "data/landsdele.geojson",
    dst: "public/geo/landsdele.geojson",
    fields: "code,name",
  },
  {
    // The postal layer is merged before simplifying. BM011 does not publish
    // inner Copenhagen code by code (1050, 1051, ...); it publishes three big
    // cells, 1000 / 1500 / 1800, while DAWA draws a boundary per postal code:
    // 232 polygons for 1050-1499 alone. Without the dissolve, the densest
    // part of Denmark would be solid grey on the postal map. Not for lack of
    // data, but because the two sides' codes do not refer to the same thing.
    // The merge rule must match postnr_bucket() in etl/geo.py.
    src: "data/postnumre.geojson",
    dst: "public/geo/postnumre.geojson",
    fields: "nr,navn",
    // The whole expression is wrapped in single quotes and handed to
    // mapshaper's parser, so string literals inside it must use double
    // quotes. Single quotes would be taken as argument boundaries and fail
    // with "Command expects a single value".
    each:
      'code = +nr >= 1000 && +nr < 1500 ? "1000" ' +
      ': +nr >= 1500 && +nr < 1800 ? "1500" ' +
      ': +nr >= 1800 && +nr < 2000 ? "1800" : nr, ' +
      'name = +nr >= 1000 && +nr < 1500 ? "København K" ' +
      ': +nr >= 1500 && +nr < 1800 ? "København V" ' +
      ': +nr >= 1800 && +nr < 2000 ? "Frederiksberg C" : navn, ' +
      'delete nr, delete navn',
    dissolve: "code",
  },
];

for (const j of jobs) {
  if (!existsSync(j.src)) {
    console.warn(`[geo] ${j.src} not found, skipping. The raw boundaries came from DAWA, which closed on 2026-10-01; public/geo already holds the simplified copies`);
    continue;
  }
  const cmd = [
    `-i ${j.src}`,
    `-filter-fields ${j.fields}`,
    j.each ? `-each '${j.each}'` : "",
    // dissolve has to come before simplify: merge the polygons of one cell
    // first, so the simplifier cannot nudge the internal borders separately
    // and leave hairline gaps.
    j.dissolve ? `-dissolve ${j.dissolve} copy-fields=name` : "",
    "-simplify 0.5% keep-shapes",
    "-clean",
    `-o format=geojson precision=0.001 ${j.dst}`,
  ]
    .filter(Boolean)
    .join(" ");

  await mapshaper.runCommands(cmd);
  console.log(`[geo] ${j.dst}  ${(statSync(j.dst).size / 1024).toFixed(0)} KB`);
}
