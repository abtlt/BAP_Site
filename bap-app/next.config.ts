import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 embarque un binaire natif : on demande à Next.js de
  // ne pas essayer de le bundler (webpack/turbopack) et de le laisser
  // en require() natif côté serveur.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
