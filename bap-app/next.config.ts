import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de binding Cloudflare Images configuré : on désactive
  // l'optimisation d'image intégrée de Next.js (le site n'affiche qu'un
  // logo statique et les avatars Roblox, déjà optimisés côté Roblox).
  images: {
    unoptimized: true,
  },
  // Next.js limite par défaut le corps d'une Server Action à 1 Mo (pour
  // éviter les abus). C'est trop petit pour un fichier joint (captures
  // d'écran Roblox notamment) : on relève la limite à 15 Mo.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

// Donne accès en local (`next dev`) aux bindings Cloudflare (D1, R2...)
// définis dans wrangler.jsonc, via getCloudflareContext().
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
