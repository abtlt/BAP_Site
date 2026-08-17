// Types des bindings Cloudflare (D1, R2, assets...) utilisés par
// `getCloudflareContext().env`. Une fois wrangler.jsonc renseigné avec vos
// identifiants réels, régénérez ce fichier avec :
//   npm run cf-typegen
interface CloudflareEnv {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ASSETS: Fetcher;
}
