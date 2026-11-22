-- Row Level Security on every table, with NO policies.
--
-- Supabase exposes the `public` schema through its REST API (PostgREST) to the `anon` and `authenticated` roles.
-- AccessLens never uses that API: only our Node server talks to the database, as the table owner, which bypasses RLS.
-- Enabling RLS without any policy therefore denies the public API everything, and revoking the grants closes the
-- door a second time. (Plain Postgres has no such roles: those statements are skipped there.)
--
-- RULE FOR FUTURE MIGRATIONS: every new table must end with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
-- A test (src/rls.test.ts) fails if any table in `public` has RLS switched off.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      -- objects created by later migrations must not be handed to the public API either
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
