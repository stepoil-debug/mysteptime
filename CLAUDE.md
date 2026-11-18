# Mysteptime — guia para desenvolvimento (Claude Code / VS Code)

Leia também `AGENTS.md` (regras de arquitetura) e `docs/MIGRACAO_INTRANET.md` (histórico da migração).

## Stack
- TanStack Start (React 19) + Nitro, build com Vite. App servido em `/mysteptime`.
- Hospedagem: **Vercel**, projeto `mysteptime` (Git Integration: push em branch = preview; merge na `main` = produção).
- Banco/Auth/Storage/Edge Functions: **Supabase próprio** `knzszyxsspdjzgqkfrdt`, tudo no schema **`mysteptime`**
  (os clientes usam `db: { schema: "mysteptime" }`; chamadas REST diretas precisam do header `Content-Profile: mysteptime`).
- Entrada dos usuários: só pela Intranet STEP One (ticket de 60 s consumido na RPC `mysteptime_bridge_consume` do Supabase da Intranet `qxmxtbjxkhecqilpnhgq`). Não há autocadastro.
- O Lovable não é mais usado. Não reintroduzir `@lovable.dev/*`, `.lovable/` nem URLs `*.lovable.app`.

## Fluxo de trabalho
1. Criar branch a partir da `main` (nunca commitar direto na `main`).
2. `npm install` e `npm run dev`.
3. Antes do PR: `npm run typecheck`, `npx vitest run`, `npm run build`, `npm run check:server-boundaries`.
   Há 14 testes que já falhavam antes da migração (filtros `ativo=true` e cookie jar do Drake); não aumente esse número.
4. Push → PR → conferir o preview da Vercel → merge na `main` (deploy automático).

## Banco (migrations)
- Novas migrations em `supabase/migrations/` escritas **no schema `mysteptime`** (`mysteptime.tabela`, `set search_path = mysteptime, public, extensions` em funções).
- Testar em transação com ROLLBACK antes de aplicar. Conexão local em `.env.local` (`MYSTEPTIME_DB_URL`, nunca commitar).
- Edge Functions em `supabase/functions/` (nomes sem prefixo). Secrets só no painel do Supabase.
- Cron: `supabase/cutover/cron.sql`.

## Variáveis
- Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `INTRANET_SUPABASE_URL`, `INTRANET_SUPABASE_PUBLISHABLE_KEY`, `NITRO_PRESET=vercel` e, como *sensitive*:
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `DRAKE_USERNAME`, `DRAKE_PASSWORD`,
  `MYSTEPTIME_AUTOMATION_EMAIL`, `MYSTEPTIME_AUTOMATION_PASSWORD`, `SMARTSHEET_API_TOKEN`, `SMARTSHEET_*_SHEET_ID`.
- Nunca colocar chaves, senhas ou tokens no código, em commits ou em logs.
