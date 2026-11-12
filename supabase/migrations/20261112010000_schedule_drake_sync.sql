-- Sincronização do Drake em horário fixo (pedido dela, 2026-11-12).
--
-- Antes, a sincronização automática só disparava quando alguém abria o site publicado
-- (scheduler oportunista em src/server.ts); sem visita, não sincronizava — de 29/10 a 05/11 e
-- em 11/11 não rodou nenhuma vez. Agora o próprio banco chama a rota
-- /api/integrations/drake/cron a cada 2 horas, das 06h às 20h (Brasília).
--
-- Não substitui nada: o botão "Atualizar dados do Drake" e o disparo por visita continuam. A
-- rota usa a mesma janela/trava/reserva (drake_scheduler_slots), então não roda em dobro.
--
-- Segredo: fica no Vault do Supabase com o nome 'drake_cron_secret' (app.cron_secret não está
-- configurado neste banco — conferido em 2026-11-12). Criar ANTES desta migração, uma vez:
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'drake_cron_secret');
-- e copiar o valor (select decrypted_secret from vault.decrypted_secrets
-- where name = 'drake_cron_secret') para o secret CRON_SECRET do app no Lovable. Sem o mesmo valor
-- nos dois lados a rota responde 401/503 e nada acontece.
--
-- Para desligar: select cron.unschedule('drake-sync-horario-fixo');
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Reexecutável: remove o agendamento anterior, se houver, antes de criar de novo.
select cron.unschedule(jobid) from cron.job where jobname = 'drake-sync-horario-fixo';

select cron.schedule(
  'drake-sync-horario-fixo',
  '5 9-23/2 * * *', -- 09:05, 11:05 … 23:05 UTC = 06:05, 08:05 … 20:05 em Brasília
  $$
  select net.http_post(
    url := 'https://mysteptime.lovable.app/api/integrations/drake/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'drake_cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    -- A sincronização leva ~7 min; a requisição fica aberta até terminar (máx. 15 min).
    timeout_milliseconds := 900000
  );
  $$
);
