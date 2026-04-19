-- FORONORS - Reset groupe (état vierge) sans casser la structure
-- Option retenue: A (conserver le catalogue items, remettre les quantités à 0)
-- Exécuter ce script dans Supabase SQL Editor sur le projet concerné.

begin;

-- 1) Réinitialiser les historiques métier
truncate table public.transaction_lines restart identity cascade;
truncate table public.transactions restart identity cascade;
truncate table public.item_stock_movements restart identity cascade;
truncate table public.cash_movements restart identity cascade;
truncate table public.activity_items restart identity cascade;
truncate table public.activities restart identity cascade;
truncate table public.tablet_passages restart identity cascade;
truncate table public.tablet_days restart identity cascade;
truncate table public.four_transaction_lines restart identity cascade;
truncate table public.four_transactions restart identity cascade;
truncate table public.four_movements restart identity cascade;
truncate table public.four_sessions restart identity cascade;
truncate table public.audit_logs restart identity cascade;

-- 2) Conserver le catalogue items, mais remettre les stocks à zéro
update public.items
set quantity = 0,
    updated_at = timezone('utc', now());

-- 3) Réinitialiser la caisse du groupe (modifier la valeur si besoin)
--    Exemple: remplacer 0 par 5000 pour démarrer avec un solde initial.
update public.group_cash
set balance = 0,
    updated_at = timezone('utc', now());

-- 4) Assainir les états applicatifs "ouverts" éventuels
update public.four_sessions
set status = 'closed',
    closed_at = timezone('utc', now())
where status = 'open';

update public.tablet_days
set closed_at = coalesce(closed_at, timezone('utc', now()))
where closed_at is null;

commit;
