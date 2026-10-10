// Pure static export. Output goes to out/ and can be dropped straight onto
// GitHub Pages / Cloudflare Pages / S3.
//
// BASE_PATH is for GitHub Pages project sites: if the repo is called
// dk-housing, set it to "/dk-housing". User sites (<user>.github.io) and
// custom domains do not need it.
//
//   BASE_PATH=/dk-housing npm run build:static
import { spawnSync } from "node:child_process";

const base = process.env.BASE_PATH ?? "";
const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  BASE_PATH: base,
  // Client code needs the prefix inlined at build time (see lib/paths.ts)
  NEXT_PUBLIC_BASE_PATH: base,
};

if (base) console.log(`[static] basePath = ${base}`);
const r = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env },
);
process.exit(r.status ?? 1);
