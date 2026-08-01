# FORONORS

FORONORS is an open-source, self-hosted operations platform for small roleplay communities. It is currently piloted by a 10-person group and is designed to replace scattered spreadsheets, chat messages, and manual stock tracking with one auditable workspace.

The application is built with Next.js, TypeScript, Tailwind CSS, and Supabase. Its interface is primarily in French.

## Features

- Custom member authentication with HTTP-only sessions
- Role-based permissions and member administration
- Shared inventory, stock movements, and transactions
- Activity, payroll, expenses, and audit logs
- Operational modules for group-specific workflows
- Optional Discord webhook notifications
- Responsive dashboard suitable for desktop and in-game webviews

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`.
3. Generate strong random values for `SESSION_SECRET` and `CRON_SECRET`.
4. Configure a Supabase project and run `supabase/schema.sql` in the SQL editor.
5. Set `INITIAL_ADMIN_USERNAME` and a unique `INITIAL_ADMIN_PASSWORD` containing at least 12 characters.
6. Run `pnpm seed:first-user` once, then remove the two initial-admin variables from the deployment environment.
7. Start the development server with `pnpm dev`.

Never commit `.env` files, Supabase secret keys, session secrets, cron secrets, or Discord webhook URLs.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only)
- `SESSION_SECRET` (server only)
- `CRON_SECRET` (server only)

Optional variables and initial setup values are documented in `.env.example`.

## Security

Passwords are stored only as bcrypt hashes. Session tokens remain in secure, HTTP-only cookies and are not exposed to browser storage. Scheduled endpoints fail closed unless `CRON_SECRET` is configured. Discord webhook URLs are validated and are never returned to the browser after storage.

See [SECURITY.md](SECURITY.md) for operational guidance and vulnerability reporting.

## License

Released under the [MIT License](LICENSE).
