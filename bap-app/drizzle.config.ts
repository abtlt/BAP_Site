import { defineConfig } from "drizzle-kit";

// Cloudflare D1 : drizzle-kit sert uniquement à générer les fichiers SQL
// de migration (npm run db:generate), dans ./drizzle. L'application de
// ces migrations se fait ensuite via Wrangler, pas via drizzle-kit push :
//   npx wrangler d1 migrations apply bap-db --local   (dev local)
//   npx wrangler d1 migrations apply bap-db --remote  (production)
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
