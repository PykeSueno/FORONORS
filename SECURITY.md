# Security policy

## Supported version

Security fixes are applied to the current `main` branch.

## Reporting a vulnerability

Do not publish credentials, exploit details, database contents, or webhook URLs in a public issue. Use GitHub's private vulnerability reporting feature when available.

## Secret handling

- Keep all `.env` files outside version control.
- Use distinct random values for `SESSION_SECRET` and `CRON_SECRET`.
- Treat `SUPABASE_SECRET_KEY` and Discord webhook URLs as credentials.
- Rotate a credential immediately if it is exposed in logs, screenshots, chat, commits, or deployment output.
- Never store or log plaintext member passwords.
- Remove `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` after the first administrator has been created.

## Database hardening

Existing installations created before August 2026 should run:

`supabase/archive/security-remove-plaintext-passwords-2026-08-01.sql`

This permanently removes the legacy plaintext-password column and related permissions. Back up the database before applying schema changes.
