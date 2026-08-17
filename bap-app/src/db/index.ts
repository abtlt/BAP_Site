import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import * as schema from "./schema";

// Cloudflare D1 : le binding (env.DB) n'est disponible qu'au moment de la
// requête (pas au chargement du module), donc pas de client global — on
// crée un client par requête. `cache()` de React évite de le recréer
// plusieurs fois pendant le rendu d'une même requête.
//
// getDb()      -> à utiliser dans les Server Actions, Route Handlers et
//                 pages/layouts en rendu dynamique (le cas de toutes les
//                 pages de cette appli, qui dépendent du cookie de session).
// getDbAsync() -> à utiliser uniquement dans du code exécuté hors requête
//                 (routes statiques/ISR). Non utilisé ici pour l'instant.
export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
});

export const getDbAsync = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
});

export { schema };
