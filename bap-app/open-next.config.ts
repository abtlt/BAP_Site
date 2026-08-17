import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Toutes les pages de ce site dépendent du cookie de session (rendu
// dynamique), il n'y a pas de contenu statique/ISR à mettre en cache :
// pas besoin du cache incrémental R2 (voir la doc "Caching" d'OpenNext
// si vous ajoutez un jour des pages statiques/ISR).
export default defineCloudflareConfig({});
