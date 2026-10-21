# Data API privileges

Every new public table must enable RLS, define its policies, and include explicit table grants in the same migration. Do not rely on Supabase automatic grants or grant access to all tables in the schema.

For private user data, use:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.your_table
TO authenticated, service_role;
```

Add `anon` privileges only when anonymous access is required and its RLS policies have been reviewed. Public landing-page statistics use `get_public_stats()` rather than anonymous access to private tables. Grants allow table operations; RLS continues to decide which rows a user can access.

`20261020000000_explicit_data_api_grants.sql` applies explicit privileges to the six tables defined by the migrations for existing installations. The original table migrations also include grants so recreating those tables does not depend on default privileges. Apply the new migration through the normal database release process.

Run the isolated privilege and RLS checks with an installed PGlite package:

```sh
node scripts/test-data-api-grants.mjs /path/to/@electric-sql/pglite/dist/index.js
```

`20261020000001_user_preferences.sql` captures the production preferences table (verified on 2026-10-20), preserves existing rows, and supplies RLS and explicit grants for fresh installs. It removes unnecessary anonymous privileges and authenticated TRUNCATE/REFERENCES/TRIGGER privileges. Production already had RLS and an owner-only policy; its existing grants cover the October 30 change. Applied successfully through the production SQL Editor on 2026-10-20. Follow-up effective-privilege checks confirmed RLS enabled, anon SELECT denied, authenticated/service_role CRUD allowed, and authenticated TRUNCATE denied. This manual SQL application does not register a Supabase migration-history entry; the migration is repeatable when replayed by the normal release process.

The snapshot includes daily_reflections and clarity_sessions as part of the security update.

## Security rollout

The 20261020 migrations are applied in production and recorded in `supabase_migrations.schema_migrations`.

- `20261020000002_secure_analytics` preserves the production analytics return type while enforcing RLS and denying anonymous execution.
- `20261020000003_minimum_api_privileges` removes anonymous table grants and authenticated TRUNCATE/REFERENCES/TRIGGER.
- `20261020000004_private_google_tokens` prepares Vault and service-only token RPCs. Deploy the matching web code after this step.
- `20261020000005_lock_down_google_tokens` then removes legacy plaintext and grants clients only safe connection-status columns.
- `20261020000006_data_api_bounds` validates size/count/owner-prefix limits without rewriting existing user data. Legacy violations abort the transaction.

The new web server needs `SUPABASE_SERVICE_ROLE_KEY` in the functions environment; this was verified to be present on Netlify. Never expose it via a NEXT_PUBLIC variable. Vault tokens are read only by server modules after session verification. Do not roll back to the pre-Vault web build after lockdown without a coordinated compatibility plan.

`full_schema.sql` now includes the remaining tables, public/project RPCs and security migrations. The short historical migration filenames are retained; do not assume a clean Supabase CLI reset has been validated solely by these targeted tests.

Additional isolated checks:

```sh
node scripts/test-private-google-tokens.mjs /path/to/@electric-sql/pglite/dist/index.js
node scripts/test-api-security-bounds.mjs /path/to/@electric-sql/pglite/dist/index.js
```

The private-token test uses a stub Vault API to verify permissions and lifecycle; it does not test encryption. The production migration used the native Supabase Vault extension.
