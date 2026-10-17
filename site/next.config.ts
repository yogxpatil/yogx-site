import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // a plain static site: `next build` writes every page to out/, which any static host can serve
  output: "export",
  images: { unoptimized: true },
  // out/fast-lane/index.html: a plain static host serves /fast-lane/ with no rewrite rules
  trailingSlash: true,
};

export default nextConfig;
