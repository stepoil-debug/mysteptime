# Migração do Mysteptime: Lovable → Intranet STEP One

Data: 2026-11-07 · Branch: `feat/migracao-intranet`

## Arquitetura nova

| Item | Antes (Lovable) | Agora |
|---|---|---|
| Banco | Lovable Cloud `lzahnaekoiervgqxmouv` (schema `public`) | Supabase da Intranet `qxmxtbjxkhecqilpnhgq`, schema **`mysteptime`** |
| Auth | Supabase Auth do Lovable (e-mail/senha) | Supabase Auth da Intranet, contas **sem senha**: entrada só pela Intranet (ticket → `/mysteptime/auth/intranet`) |
| Acesso | papel em `user_roles` | card `offshore:mysteptime` liberado no **admin da Intranet** + papel em `mysteptime.user_roles` (primeiro acesso cria a conta com `pending`) |
| Hospedagem | `mysteptime.lovable.app` | Vercel (projeto `mysteptime`, Nitro preset `vercel`), servido em `intranet.step-og.com/mysteptime` por rewrite da Intranet |
| Build | `@lovable.dev/vite-tanstack-config` | `vite.config.ts` próprio (TanStack Start + Nitro), basepath `/mysteptime` |
| IA | gateway do Lovable (`LOVABLE_API_KEY`) | API da Anthropic (`ANTHROPIC_API_KEY`), modelo `claude-opus-5-5` |
| Storage | buckets do Lovable | buckets `reembolsos-anexos`, `nomeacoes-anexos`, `bm-mob-desmob-notas` no projeto da Intranet |

## O que já foi aplicado no Supabase da Intranet

1. Schema `mysteptime`: 84 tabelas, 48 funções, 245 policies, 13 enums, gerado das 185 migrations do repositório mais as 9 do `drizzle/`, convertidas por `scripts/migracao-intranet/build-schema.mjs`. Testado em transação com ROLLBACK antes do commit. Correções para refletir o banco real do Lovable:
   - `sql-extra/20260713195959_bootstrap_timesheet_offshore.sql`: `timesheet_embarques/semanas/dias` foram criadas direto no Lovable, sem migration.
   - `sql-extra/20260915149999_drift_colunas_lovable.sql`: colunas que só existiam no banco real.
   - `nominations.scope_documents` passou a aceitar nulo, como no banco real.
   - **Não** foram aplicados: o trigger `on_auth_user_created` em `auth.users`, o seed do usuário `hermann.siqueira` com senha fixa, os jobs de cron (ficam em `mysteptime_schema_cron.sql`, para depois que as Edge Functions existirem) e as cargas de dados (substituídas pela importação real).
2. `mysteptime` acrescentado a `pgrst.db_schemas` (role `authenticator`).
3. Dados: 83 tabelas, **316.946 linhas**, iguais à origem (`export_counts.json`); 41 contas de Auth criadas com o **mesmo UUID** do Lovable; 2 contas que já existiam na Intranet tiveram os IDs remapeados (363 valores).
4. Storage: 20 arquivos, cerca de 25 MB.

## Sincronização final (antes da virada)

O Lovable continua em uso até a virada. Antes de apontar o card para a versão nova:

1. Gerar um token novo (`import_inbox.sql`, última linha comentada).
2. Logado como administrador no mysteptime.lovable.app, rodar de novo a exportação pelo navegador para a RPC `mysteptime._import_page`.
3. `node scripts/migracao-intranet/import-data.mjs` (teste com ROLLBACK), depois com `--commit`. O script apaga e recarrega cada tabela e recusa o commit se alguma contagem divergir.

## Limpeza depois da virada

```sql
drop function if exists mysteptime._import_page(text,text,int,jsonb);
drop function if exists mysteptime._import_file(text,text,text,text,text);
drop function if exists mysteptime._import_file_get(text,text,text);
drop schema if exists mysteptime_import cascade;
```
E apagar a Edge Function `mysteptime-import-files-tmp`.

## Rollback

- App: voltar o card da Intranet para `https://mysteptime.lovable.app/` (o Lovable não foi alterado).
- Banco (só se for abandonar a migração; **destrutivo**):
  ```sql
  drop schema mysteptime cascade;
  delete from auth.users where raw_app_meta_data->>'origem' = 'mysteptime-lovable';
  -- e retirar 'mysteptime' de pgrst.db_schemas (alter role authenticator set pgrst.db_schemas = '...'; notify pgrst, 'reload config';)
  ```

## Variáveis de ambiente (projeto Vercel `mysteptime`)

Públicas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
Secretas, cadastradas pelo responsável e nunca no repositório: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `DRAKE_USERNAME`, `DRAKE_PASSWORD`, `MYSTEPTIME_AUTOMATION_EMAIL`, `MYSTEPTIME_AUTOMATION_PASSWORD`, `SMARTSHEET_API_TOKEN` e os `SMARTSHEET_*_SHEET_ID`.

## Testes

`npx vitest run`: 14 falhas, as mesmas que já existiam na `main` antes da migração (filtros `ativo=true` e cookie jar do Drake); nenhuma falha nova.
