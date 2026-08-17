import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de binding Cloudflare Images configuré : on désactive
  // l'optimisation d'image intégrée de Next.js (le site n'affiche qu'un
  // logo statique et les avatars Roblox, déjà optimisés côté Roblox).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

// Donne accès en local (`next dev`) aux bindings Cloudflare (D1, R2...)
// définis dans wrangler.jsonc, via getCloudflareContext().
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
