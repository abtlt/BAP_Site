/**
 * Script d'amorçage : ajoute une première personne à la liste blanche
 * d'accès, pour permettre au rédacteur en chef de se connecter la
 * première fois (le tout premier compte créé sur le site devient
 * automatiquement rédacteur en chef — voir src/app/api/auth/callback/route.ts).
 *
 * Usage :
 *   npm run db:seed -- --username=VotrePseudoRoblox
 *   npm run db:seed -- --id=123456789
 *
 * Vous pouvez aussi renseigner SEED_ROBLOX_USERNAME / SEED_ROBLOX_ID en
 * variables d'environnement (utile en CI/déploiement).
 */
import { db, schema } from "./index";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main() {
  const robloxUsername = getArg("username") || process.env.SEED_ROBLOX_USERNAME || "";
  const robloxId = getArg("id") || process.env.SEED_ROBLOX_ID || "";

  if (!robloxUsername && !robloxId) {
    console.error(
      "\nMerci de préciser le compte Roblox du futur rédacteur en chef :\n" +
        "  npm run db:seed -- --username=VotrePseudoRoblox\n" +
        "  npm run db:seed -- --id=123456789\n"
    );
    process.exit(1);
  }

  await db.insert(schema.authorizedRobloxUsers).values({
    robloxId: robloxId || null,
    robloxUsername: robloxUsername || null,
    note: "Amorçage initial (rédacteur en chef)",
    addedBy: "Script de seed",
    addedAt: new Date().toISOString(),
  });

  console.log(
    `\n✓ Compte Roblox ${robloxUsername ? "@" + robloxUsername : "#" + robloxId} ajouté à la liste blanche.\n` +
      "Connectez-vous une première fois sur le site avec ce compte : il deviendra automatiquement rédacteur en chef.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
