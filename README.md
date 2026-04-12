# FORONORS

Base Next.js + TypeScript + Tailwind + Supabase (DB only), avec authentification personnalisée username/mot de passe.

## Démarrage

```bash
npm install
cp .env.example .env.local
```

Renseignez les variables d'environnement, puis lancez:

```bash
npm run dev
```

## Base de données

1. Exécuter `supabase/schema.sql` dans SQL Editor.
2. Créer le premier compte:

```bash
npm run seed:first-user
```

Compte seedé:
- username: `pyke`
- password: `santa`
- role: `Patron`
- is_active: `true`

## Fonctionnalités livrées

- Login personnalisé (`/login`)
- Session cookie HTTP-only
- Protection des routes (`middleware.ts`)
- Dashboard (`/dashboard`)
- Module membres (`/dashboard/membres`) avec:
  - liste
  - création
  - modification rôle + actif/inactif
