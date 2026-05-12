import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project so the lockfile detection
  // doesn't pick up an unrelated `package-lock.json` in the user's home.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
