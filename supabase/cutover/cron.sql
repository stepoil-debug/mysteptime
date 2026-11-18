-- Jobs de cron do Mysteptime no Supabase próprio (knzszyxsspdjzgqkfrdt).
-- APLICAR SÓ NA VIRADA (depois da sincronização final), senão duplica e-mails/nomeações com o Lovable.
-- Pré-requisitos (feitos no painel do Supabase, nunca no repositório):
--   1. Vault: secret 'cron_secret' (Edge Functions) e 'drake_cron_secret' (rota do app) — valores aleatórios.
--      select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'cron_secret');
--      select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'drake_cron_secret');
--   2. Edge Functions → Secrets: CRON_SECRET = mesmo valor de 'cron_secret'
--      (select decrypted_secret from vault.decrypted_secrets where name='cron_secret').
--   3. Secrets das funções: SMTP_*, RESEND_API_KEY, RESEND_FROM, ANTHROPIC_API_KEY, SMARTSHEET_TOKEN, SMARTSHEET_ID_1/2.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$ declare j text; begin
  foreach j in array array['mysteptime-daily-turma-alert','mysteptime-daily-planejamento-embarque-snapshot',
    'mysteptime-daily-create-fixed-nominations','mysteptime-flow-track-demandas-sync','mysteptime-drake-sync-horario-fixo'] loop
    perform cron.unschedule(jobid) from cron.job where jobname = j;
  end loop;
end $$;

-- Edge Functions diárias (09:00 UTC = 06:00 Brasília)
select cron.schedule(f.job, '0 9 * * *', format($cmd$
  select net.http_post(
    url := 'https://knzszyxsspdjzgqkfrdt.supabase.co/functions/v1/%s',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      coalesce((select decrypted_secret from vault.decrypted_secrets where name='cron_secret' limit 1),'')),
    body := '{}'::jsonb);
  $cmd$, f.fn))
from (values ('mysteptime-daily-turma-alert','check-turma-alerts'),
             ('mysteptime-daily-planejamento-embarque-snapshot','capture-planejamento-snapshot'),
             ('mysteptime-daily-create-fixed-nominations','create-fixed-nominations')) f(job, fn);

-- Rotas do app na Vercel (basepath /mysteptime)
select cron.schedule('mysteptime-flow-track-demandas-sync', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://mysteptime.vercel.app/mysteptime/api/public/flow-track-demandas-sync',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-flow-track-sync-token','b18a4d2afd13fbe329b0355b15a6d62c63f5e4fe2071f92e93e805416f5c0384'),
    body := '{}'::jsonb);
$$);

select cron.schedule('mysteptime-drake-sync-horario-fixo', '5 9-23/2 * * *', $$
  select net.http_post(
    url := 'https://mysteptime.vercel.app/mysteptime/api/integrations/drake/cron',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      coalesce((select decrypted_secret from vault.decrypted_secrets where name='drake_cron_secret' limit 1),'')),
    body := '{}'::jsonb,
    timeout_milliseconds := 900000);
$$);
