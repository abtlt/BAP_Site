/**
 * Script d'amorçage : ajoute une première personne à la liste blanche
 * d'accès, pour permettre au rédacteur en chef de se connecter la
 * première fois (le tout premier compte créé sur le site devient
 * automatiquement rédacteur en chef — voir src/app/api/auth/callback/route.ts).
 *
 * Cloudflare D1 n'est accessible que via un binding Worker ou via la CLI
 * Wrangler (pas de driver Node classique en dehors du Worker) : ce script
 * ne se connecte donc pas à la base lui-même, il affiche la commande
 * Wrangler exacte à lancer.
 *
 * Usage :
 *   npm run db:seed -- --username=VotrePseudoRoblox
 *   npm run db:seed -- --id=123456789
 *
 * Ajoutez --remote pour cibler la base D1 de production au lieu de la
 * base locale (utilisée par `npm run dev` / `npm run preview`).
 */
function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const robloxUsername = getArg("username") || process.env.SEED_ROBLOX_USERNAME || "";
  const robloxId = getArg("id") || process.env.SEED_ROBLOX_ID || "";
  const remote = process.argv.includes("--remote");
  const dbName = process.env.D1_DATABASE_NAME || "bap-db";

  if (!robloxUsername && !robloxId) {
    console.error(
      "\nMerci de préciser le compte Roblox du futur rédacteur en chef :\n" +
        "  npm run db:seed -- --username=VotrePseudoRoblox\n" +
        "  npm run db:seed -- --id=123456789\n" +
        "\nAjoutez --remote pour cibler la base D1 de production.\n"
    );
    process.exit(1);
  }

  const now = new Date().toISOString();
  const sql =
    `INSERT INTO authorized_roblox_users (roblox_id, roblox_username, note, added_by, added_at) VALUES (` +
    `${robloxId ? sqlQuote(robloxId) : "NULL"}, ${robloxUsername ? sqlQuote(robloxUsername) : "NULL"}, ` +
    `'Amorçage initial (rédacteur en chef)', 'Script de seed', ${sqlQuote(now)});`;

  console.log("\nLancez la commande suivante pour ajouter ce compte à la liste blanche :\n");
  console.log(`npx wrangler d1 execute ${dbName} ${remote ? "--remote" : "--local"} --command "${sql.replace(/"/g, '\\"')}"\n`);
  console.log(
    `Une fois exécuté, connectez-vous sur le site avec le compte ${robloxUsername ? "@" + robloxUsername : "#" + robloxId} : il deviendra automatiquement rédacteur en chef.\n`
  );
}

main();
