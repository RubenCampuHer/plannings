import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

// next-intl: apuntem al fitxer de config de request.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project so the lockfile detection
  // doesn't pick up an unrelated `package-lock.json` in the user's home.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // Documents Word del viatge llarg poden arribar a uns MB amb imatges embedded.
      // Per defecte el límit és 1MB, massa just.
      bodySizeLimit: "10mb",
    },
  },
};

export default withNextIntl(nextConfig);
