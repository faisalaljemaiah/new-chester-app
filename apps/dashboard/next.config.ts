import type { NextConfig } from "next";

// The dashboard is fully client-side (Supabase client in the browser), so it exports to
// static files in out/ that any static host can serve.
const config: NextConfig = {
  output: "export",
  transpilePackages: ["@chester/shared"],
  images: { unoptimized: true },
};

export default config;
