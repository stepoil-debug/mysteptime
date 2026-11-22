-- Executar somente no Supabase de destino (knzszyxsspdjzgqkfrdt).
-- Conferência padrão: mantém o agendamento ao final do teste.
-- A aplicação persistente exige autorização para usar COMMIT na última linha.
-- supabase/cutover/cron.sql recria esse agendamento na virada.
BEGIN;
SET LOCAL lock_timeout = '5s';

SELECT cron.unschedule(jobname) AS desagendado
FROM cron.job
WHERE jobname = 'mysteptime-daily-planejamento-embarque-snapshot'
  AND schedule = '0 9 * * *';

SELECT count(*) AS agendamentos_restantes
FROM cron.job
WHERE jobname = 'mysteptime-daily-planejamento-embarque-snapshot';

ROLLBACK;
