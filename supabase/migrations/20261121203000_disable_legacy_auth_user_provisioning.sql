-- Neutraliza somente o provisionamento legado de public associado a auth.users.
-- O app provisiona o perfil e o papel no schema mysteptime.
SET LOCAL lock_timeout = '5s';

DO $migration$
BEGIN
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgfoid='public.handle_new_user()'::regprocedure) <> 1
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid='auth.users'::regclass
        AND tgname='on_auth_user_created'
        AND tgfoid='public.handle_new_user()'::regprocedure
        AND NOT tgisinternal
    )
  THEN
    RAISE EXCEPTION 'Escopo do gatilho legado de Auth mudou';
  END IF;
END $migration$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=pg_catalog
AS $body$
BEGIN
  RETURN NEW;
END
$body$;
