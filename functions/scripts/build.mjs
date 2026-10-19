// Bundles the functions (with @chester/shared inlined) into lib/, plus a package.json that
// lists only the runtime dependencies. firebase.json deploys lib/ so the workspace-only
// shared package never has to be installed by Cloud Build.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "lib/index.js",
  external: ["firebase-admin", "firebase-functions"],
});

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(
  "lib/package.json",
  JSON.stringify(
    { name: "chester-functions", private: true, main: "index.js", engines: pkg.engines, dependencies: pkg.dependencies },
    null,
    2,
  ),
);
console.log("Built lib/index.js");
