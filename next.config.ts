import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node.js module — don't bundle it, let Node require it directly
  serverExternalPackages: ['better-sqlite3'],
  // Ensure the seed database is included in the deployment bundle
  outputFileTracingIncludes: {
    '/**': ['./seed/**', './data/l26weeks_product_metric_v3.json'],
  },
};

export default nextConfig;
