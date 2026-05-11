-- Add an optional bank reference for member profiles.
-- Safe to run on an existing FORONORS database.

alter table public.users add column if not exists iban_rib text;
