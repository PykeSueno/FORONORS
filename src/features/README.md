# Feature architecture (base)

Objectif: authentification **username + mot de passe** gérée dans FORONORS (pas depuis le dashboard Supabase).

## Principes

- Supabase reste une couche DB technique cachée.
- Les routes API du site gèrent login/session et la création des membres.
- Le hash de mot de passe se fait avec `bcryptjs` côté serveur.

## Étapes couvertes

1. Login via `/api/login` (username/password).
2. Session HTTP-only signée (JWT) pour protéger `/dashboard`.
3. Module membres initial pour lister et créer des comptes.
