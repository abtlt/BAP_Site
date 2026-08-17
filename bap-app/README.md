# Bureau Auxiliaire de Presse — application

Outil de gestion du Bureau Auxiliaire de Presse (RP Roblox) : connexion via l'API officielle Roblox (OAuth 2.0), liste
blanche d'accès, gestion des journalistes, création et attribution d'articles, rédaction collaborative, validation,
deadlines, freeze (journaliste et administrateur), et panel d'administration complet.

Stack : Next.js 16 (App Router, Server Actions), TypeScript, SQLite via Drizzle ORM, sessions signées (JWT/`jose`),
Lexend (Google Fonts) et le design déjà validé dans le prototype.

## 1. Installation

```bash
npm install
```

## 2. Base de données

Le projet utilise SQLite (fichier local) via Drizzle ORM — aucun serveur de base de données à installer.

```bash
# Génère les fichiers de migration à partir du schéma (déjà fait, à relancer si vous modifiez src/db/schema.ts)
npm run db:generate

# Applique le schéma à la base ./data/bap.db (créée automatiquement)
npm run db:push
```

`npm run db:studio` ouvre une interface web pour explorer/éditer les données directement.

> **Déploiement serverless (Vercel, etc.) :** le système de fichiers y est éphémère, donc SQLite n'y persistera pas.
> Pour ce type d'hébergement, remplacez le driver dans `src/db/index.ts` par un driver Postgres (Drizzle propose une
> API quasi identique pour `drizzle-orm/postgres-js` ou `drizzle-orm/neon-serverless`) et adaptez `drizzle.config.ts`
> (`dialect: "postgresql"`). Pour un VPS ou un Docker auto-hébergé, SQLite convient très bien tel quel.

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

## 6. Lancer le site

```bash
npm run dev
```

Rendez-vous sur `http://localhost:3000`.

Pour la production :

```bash
npm run build
npm run start
```

## 7. Gestion des accès (liste blanche)

Une fois connecté comme administrateur ou rédacteur en chef, l'onglet **Accès** du panel administrateur permet
d'ajouter l'ID ou le nom d'utilisateur Roblox de toute personne qui doit pouvoir accéder au site. Se connecter avec
Roblox est ouvert à tout le monde, mais seules les personnes présentes dans cette liste obtiennent un compte actif
(journaliste par défaut) lors de leur première connexion. Un compte déjà créé n'est pas supprimé si on le retire
ensuite de la liste blanche — pour révoquer un accès déjà actif, gérez son rôle/statut depuis sa fiche.

## 8. Fichiers joints aux articles

Les fichiers uploadés dans l'espace de rédaction sont stockés sur disque, dans `public/uploads/<id-article>/`. Cela
fonctionne très bien pour un VPS/Docker auto-hébergé. Pour un déploiement serverless, remplacez
`src/lib/uploads.ts` par un stockage objet (S3, Cloudflare R2, Supabase Storage...).

## 9. Structure du projet

```
src/
  app/                Pages (App Router) : login, profil, articles, redaction, admin...
  actions/            Server Actions (mutations : articles, journalistes, accès)
  components/         Shell, Sidebar, ProfileView, DeadlineRing...
  db/                 schema.ts (Drizzle), index.ts (connexion), seed.ts
  lib/                session.ts (JWT), roblox.ts (OAuth), permissions.ts, dates.ts, uploads.ts
```

## 10. Réglages métier

- Seuil vert/rouge de la deadline et durée d'un cycle : `DEADLINE_THRESHOLD_DAYS` / `DEADLINE_CYCLE_DAYS` dans
  `src/lib/dates.ts`.
- Grades disponibles : `GRADES` dans `src/lib/permissions.ts`.

## 11. Règles déjà implémentées

- Un journaliste ne peut avoir qu'un seul article actif à la fois (en rédaction, en validation ou à corriger).
- Un journaliste peut demander l'annulation de sa prise en charge (erreur, désistement) ; un administrateur
  approuve ou refuse la demande depuis l'onglet **Annulations**.
- La validation d'un article réinitialise la deadline des journalistes concernés et leur crédite 5 jours de freeze.
- Un freeze administrateur bloque totalement le compte concerné (prise, rédaction, envoi d'articles) jusqu'à sa
  levée manuelle ; la deadline est alors repoussée du nombre de jours passés sous freeze.
- Seul le rédacteur en chef peut promouvoir ou rétrograder un administrateur.
