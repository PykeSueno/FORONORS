# Feature architecture (base)

Objectif: garder Supabase en **couche technique** et piloter la gestion des comptes depuis FORONORS.

## Principes

- L'UI consomme des **contrats métiers** (`AuthRepository`, `MemberRepository`).
- Les implémentations techniques (Supabase/Auth API) seront ajoutées ensuite derrière ces contrats.
- La gestion des membres (création, modification, activation, désactivation, suppression, rôles) reste dans le site.

## Prochaine étape

1. Implémenter un bootstrap serveur pour créer le premier admin si absent.
2. Brancher une implémentation `AuthRepository` (Supabase en arrière-plan).
3. Créer le module UI "Gestion des membres" sur `MemberRepository`.
