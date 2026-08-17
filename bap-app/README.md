# Bureau Auxiliaire de Presse — application

Outil de gestion du Bureau Auxiliaire de Presse (RP Roblox) : connexion via l'API officielle Roblox (OAuth 2.0), liste
blanche d'accès, gestion des journalistes, création et attribution d'articles, rédaction collaborative, validation,
deadlines, freeze (journaliste et administrateur), et panel d'administration complet.

Stack : Next.js 16 (App Router, Server Actions), TypeScript, Cloudflare D1 (SQLite serverless) via Drizzle ORM,
Cloudflare R2 pour les fichiers joints, sessions signées (JWT/`jose`), Lexend (Google Fonts), déployé sur Cloudflare
Workers via `@opennextjs/cloudflare`.

## 1. Installation

```bash
npm install
```

## 2. Base de données (Cloudflare D1)

Le projet utilise [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite serverless) via Drizzle ORM — voir
la section **Déploiement sur Cloudflare** ci-dessous pour la création de la base. Après toute modification de
`src/db/schema.ts`, régénérez les fichiers SQL de migration :

```bash
npm run db:generate
```

Les migrations sont ensuite appliquées via Wrangler (pas `drizzle-kit push`, qui ne fonctionne pas avec D1) :

```bash
npx wrangler d1 migrations apply bap-db --local   # base locale (npm run dev / npm run preview)
npx wrangler d1 migrations apply bap-db --remote  # base de production
```

## 3. Créer l'application OAuth Roblox

1. Allez sur la page [OAuth 2.0 Apps](https://create.roblox.com/dashboard/credentials?activeTab=OAuthTab) du Creator
   Dashboard.
2. Cliquez sur **Create App**, donnez-lui un nom (ex : "Bureau Auxiliaire de Presse").
3. Copiez immédiatement le **Client ID** et le **Secret** affichés — le secret ne sera plus jamais visible ensuite.
4. Dans **Permissions Scopes**, cochez uniquement `openid` et `profile` (c'est le scope minimal permettant de
   récupérer le nom d'utilisateur Roblox — aucune autre donnée du compte n'est demandée).
5. Dans **Redirect URLs**, ajoutez l'URL exacte de callback de votre site, par exemple :
   - En local : `http://localhost:3000/api/auth/callback`
   - En production : `https://votre-domaine.fr/api/auth/callback`

> ⚠️ **Limite importante :** tant que l'app n'est pas soumise et approuvée en revue ("Submit for Review"), elle reste
> en **mode privé, limité à 10 utilisateurs uniques**. C'est très bien pour tester, mais si votre Bureau compte plus
> de 10 journalistes, il faudra soumettre l'app à la revue Roblox pour passer en mode public avant l'ouverture à
> toute l'équipe.

## 4. Variables d'environnement

Copiez `.env.example` en `.env.local` et remplissez :

```bash
cp .env.example .env.local
```

- `AUTH_SECRET` : générez une chaîne aléatoire, par ex. `openssl rand -base64 32`.
- `ROBLOX_CLIENT_ID` / `ROBLOX_CLIENT_SECRET` : récupérés à l'étape 3.
- `ROBLOX_REDIRECT_URI` : doit correspondre **exactement** à une Redirect URL configurée sur l'app OAuth.

## 5. Amorçage — devenir rédacteur en chef

Le tout premier compte créé sur le site devient automatiquement **rédacteur en chef** (les suivants sont journalistes
par défaut). Il faut donc que le futur rédacteur en chef se connecte en premier, et pour ça il doit déjà être dans la
liste blanche d'accès. Amorcez-la avec le script de seed :

```bash
npm run db:seed -- --username=VotrePseudoRoblox
# ou
npm run db:seed -- --id=123456789
```

Puis lancez le site et connectez-vous avec ce compte Roblox en premier.

## 6. Lancer le site en local

```bash
npm run dev
```

Rendez-vous sur `http://localhost:3000`. Les bindings Cloudflare (D1, R2) sont disponibles automatiquement en local
grâce à `initOpenNextCloudflareForDev()` (voir `next.config.ts`) — pas besoin de base à part.

Pour tester dans le runtime Workers réel (recommandé avant un déploiement) :

```bash
npm run preview
```

## 7. Déploiement sur Cloudflare

Le site est prévu pour tourner sur **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
Étapes à faire une seule fois, depuis votre poste (nécessite un compte Cloudflare) :

```bash
# 1. Connexion à votre compte Cloudflare
npx wrangler login

# 2. Créer la base D1 — copiez le "database_id" renvoyé dans wrangler.jsonc
#    (champ d1_databases[0].database_id, actuellement "REMPLACEZ_PAR_VOTRE_DATABASE_ID")
npx wrangler d1 create bap-db

# 3. Créer le bucket R2 pour les fichiers joints
npx wrangler r2 bucket create bap-uploads

# 4. Appliquer le schéma de base de données à la base distante
npx wrangler d1 migrations apply bap-db --remote

# 5. Amorcer la liste blanche (voir étape 5 plus haut), avec --remote :
npm run db:seed -- --username=VotrePseudoRoblox --remote

# 6. Renseigner les secrets de production (jamais dans wrangler.jsonc en clair)
npx wrangler secret put AUTH_SECRET
npx wrangler secret put ROBLOX_CLIENT_ID
npx wrangler secret put ROBLOX_CLIENT_SECRET
npx wrangler secret put ROBLOX_REDIRECT_URI

# 7. Générer les types TypeScript des bindings (facultatif, met à jour cloudflare-env.d.ts)
npm run cf-typegen

# 8. Déployer
npm run deploy
```

Pensez à ajouter l'URL de production (`https://bap-app.<votre-sous-domaine>.workers.dev/api/auth/callback`, ou votre
domaine personnalisé si vous en branchez un) dans les **Redirect URLs** de l'app OAuth Roblox (étape 3).

> **Limite de taille du Worker :** 3 Mo (gzip) sur le plan gratuit, 10 Mo sur le plan payant (5 $/mois). Cette
> application passe normalement sous les 10 Mo ; si vous restez sur le plan gratuit et dépassez 3 Mo au build, il
> faudra passer au plan payant.

Vous pouvez aussi connecter le dépôt GitHub directement dans le dashboard Cloudflare (Workers & Pages → Create →
Connect to Git) pour un déploiement automatique à chaque `push`.

## 8. Gestion des accès (liste blanche)

Une fois connecté comme administrateur ou rédacteur en chef, l'onglet **Accès** du panel administrateur permet
d'ajouter l'ID ou le nom d'utilisateur Roblox de toute personne qui doit pouvoir accéder au site. Se connecter avec
Roblox est ouvert à tout le monde, mais seules les personnes présentes dans cette liste obtiennent un compte actif
(journaliste par défaut) lors de leur première connexion. Un compte déjà créé n'est pas supprimé si on le retire
ensuite de la liste blanche — pour révoquer un accès déjà actif, gérez son rôle/statut depuis sa fiche.

## 9. Fichiers joints aux articles

Les fichiers uploadés dans l'espace de rédaction sont stockés sur **Cloudflare R2** (bucket `bap-uploads`, voir
`src/lib/uploads.ts`) et relus via la route `/api/uploads/[...path]` (`src/app/api/uploads/[...path]/route.ts`). Le
système de fichiers d'un Worker n'étant pas persistant, il n'y a plus d'écriture sur disque.

## 10. Structure du projet

```
src/
  app/                Pages (App Router) : login, profil, articles, redaction, admin...
                       + app/api/uploads/[...path] : sert les fichiers joints depuis R2
  actions/            Server Actions (mutations : articles, journalistes, accès)
  components/         Shell, Sidebar, ProfileView, DeadlineRing...
  db/                 schema.ts (Drizzle), index.ts (connexion D1), seed.ts
  lib/                session.ts (JWT), roblox.ts (OAuth), permissions.ts, dates.ts, uploads.ts (R2)
wrangler.jsonc         Configuration Worker : bindings D1 (DB), R2 (UPLOADS), assets statiques
open-next.config.ts    Configuration de l'adaptateur @opennextjs/cloudflare
cloudflare-env.d.ts    Types des bindings (régénéré par `npm run cf-typegen`)
```

## 11. Réglages métier

- Seuil vert/rouge de la deadline et durée d'un cycle : `DEADLINE_THRESHOLD_DAYS` / `DEADLINE_CYCLE_DAYS` dans
  `src/lib/dates.ts`.
- Grades disponibles : `GRADES` dans `src/lib/permissions.ts`.

## 12. Règles déjà implémentées

- Un journaliste ne peut avoir qu'un seul article actif à la fois (en rédaction, en validation ou à corriger).
- Un journaliste peut demander l'annulation de sa prise en charge (erreur, désistement) ; un administrateur
  approuve ou refuse la demande depuis l'onglet **Annulations**.
- La validation d'un article réinitialise la deadline des journalistes concernés et leur crédite 5 jours de freeze.
- Un freeze administrateur bloque totalement le compte concerné (prise, rédaction, envoi d'articles) jusqu'à sa
  levée manuelle ; la deadline est alors repoussée du nombre de jours passés sous freeze.
- Seul le rédacteur en chef peut promouvoir ou rétrograder un administrateur.
