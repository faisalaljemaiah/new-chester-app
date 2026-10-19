import type { NextConfig } from "next";

// The dashboard is fully client-side (Firebase SDK in the browser), so it exports to
// static files that Firebase Hosting serves from out/.
const config: NextConfig = {
  output: "export",
  transpilePackages: ["@chester/shared"],
  images: { unoptimized: true },
};

export default config;
