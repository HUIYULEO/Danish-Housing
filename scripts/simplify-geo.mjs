// data/*.geojson (DAWA 原图，一两百 MB) -> public/geo/*.geojson
// PRD §11 要求上线前简化。0.5% + precision 0.001 实测 kommuner 439KB。
//
// 用 mapshaper 的 Node API 而不是命令行：-each 的表达式里有分号、引号和正则，
// 走 shell 会被拆开，不走 shell 的话 Windows 上又不让 spawn .cmd。
// 直接调 API 两个问题都没有。
import mapshaper from "mapshaper";
import { statSync, existsSync, mkdirSync } from "node:fs";

mkdirSync("public/geo", { recursive: true });

const jobs = [
  {
    src: "data/kommuner.geojson",
    dst: "public/geo/kommuner.geojson",
    fields: "kode,navn,regionsnavn",
    // kode 是 4 位带前导零的 '0101'，BM010 的 OMR20 是 '101'，这里对齐
    each: 'code = kode.replace(/^0+/, ""), name = navn, region = regionsnavn, delete kode, delete navn, delete regionsnavn',
  },
  {
    // region / landsdel 的 code 在 ETL 里已经对齐成 DST 的 OMR20 编码了
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
    src: "data/postnumre.geojson",
    dst: "public/geo/postnumre.geojson",
    fields: "nr,navn",
    each: "code = nr, name = navn, delete nr, delete navn",
  },
];

for (const j of jobs) {
  if (!existsSync(j.src)) {
    console.warn(`[geo] 找不到 ${j.src}，先跑 npm run etl`);
    continue;
  }
  const cmd = [
    `-i ${j.src}`,
    `-filter-fields ${j.fields}`,
    j.each ? `-each '${j.each}'` : "",
    "-simplify 0.5% keep-shapes",
    "-clean",
    `-o format=geojson precision=0.001 ${j.dst}`,
  ]
    .filter(Boolean)
    .join(" ");

  await mapshaper.runCommands(cmd);
  console.log(`[geo] ${j.dst}  ${(statSync(j.dst).size / 1024).toFixed(0)} KB`);
}
