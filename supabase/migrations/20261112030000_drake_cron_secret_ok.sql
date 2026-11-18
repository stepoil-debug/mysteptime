-- Conferência da senha do cron do Drake no próprio banco (pedido dela, 2026-11-12): a rota
-- /api/integrations/drake/cron pergunta aqui se a senha recebida é a 'drake_cron_secret' do
-- Vault — assim não é preciso configurar CRON_SECRET nos secrets do Lovable.
-- Só devolve true/false; nunca devolve a senha. Senha aleatória de 256 bits (64 hex).
create or replace function public.drake_cron_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(p_secret) >= 32 and exists (
      select 1 from vault.decrypted_secrets
      where name = 'drake_cron_secret' and decrypted_secret = p_secret
    ),
    false
  );
$$;

revoke all on function public.drake_cron_secret_ok(text) from public;
grant execute on function public.drake_cron_secret_ok(text) to anon, authenticated;
