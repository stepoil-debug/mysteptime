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
  `SUPABASE_SERVICE_ROLE_KEY`, `DRAKE_USERNAME`, `DRAKE_PASSWORD`,
  `MYSTEPTIME_AUTOMATION_EMAIL`, `MYSTEPTIME_AUTOMATION_PASSWORD`, `SMARTSHEET_API_TOKEN`, `SMARTSHEET_*_SHEET_ID`.
- Nunca colocar chaves, senhas ou tokens no código, em commits ou em logs.

## Claude Code — Supabase MCP (projeto)
- Servidor MCP oficial configurado em `.mcp.json`, restrito a `knzszyxsspdjzgqkfrdt` e em modo `read_only=true`.
- Para autorizar, abra um terminal **nesta pasta**, inicie `claude`, execute `/mcp`, selecione `supabase` e conclua a autenticação OAuth no navegador.
- Após autorizar, teste a leitura das tabelas do schema `mysteptime` pelo MCP. A conexão MCP não utiliza o token do `supabase login`.
- Não altere schema, dados, RLS, secrets ou Edge Functions diretamente em produção por causa da integração. Mudanças devem seguir o fluxo de migrations/PR/testes acima.
- Não inclua tokens, service role keys ou valores de secrets no `.mcp.json`, commits ou conversas.

## Importante para conversas abertas no Claude Desktop
- Este repositorio ja possui o Supabase MCP oficial no `.mcp.json` (project_ref `knzszyxsspdjzgqkfrdt`, `read_only=true`). O MCP foi autenticado e testado em uma sessao local do Claude Code.
- Se uma conversa antiga solicitar `SUPABASE_ACCESS_TOKEN` para **consultar** o projeto, utilize primeiro as ferramentas MCP do Supabase; **nao** solicite ou grave um Personal Access Token no `.env.local` para esse fim.
- O Supabase CLI (`npx supabase`) e o servidor MCP do Claude usam autenticacoes diferentes. Autenticacao bem-sucedida no terminal nao garante que uma sessao antiga do Claude Desktop tenha atualizado sua lista de servidores; reabra a sessao existente no Desktop para atualizar os MCPs quando necessario.
- Para validar: consulte `mysteptime` com `list_tables` e `get_project` via MCP; informe explicitamente quando MCP nao estiver acessivel. Nao modifique o banco.

## Estado da migração Lovable → Supabase próprio (19/11/2026)
- **Leia primeiro** `docs/MIGRACAO_EXECUTADA_2026-11-19.md` antes de qualquer importação adicional, sincronização do Lovable ou alteração de secrets.
- A maior parte dos dados foi sincronizada por inserções incrementais. NÃO executar `import-data.mjs --commit` nem apagar/recarregar as tabelas: há registros novos no destino e isso poderia causar perda de dados.
- Em `hist_novo_periodos`, 569 UUIDs diferem para os mesmos `drake_event_key`; não duplicar nem reescrever IDs sem análise dos vínculos.
- Faltam validação de conteúdo, uma conta de Auth, quatro anexos privados, secrets de Edge Functions, Google email e testes de SSO, Cron e IA. Não ativar cutover/cron/deploy de produção automaticamente.
- As variáveis SMTP Microsoft antigas foram neutralizadas na Vercel. O requisito do projeto é **e-mail via Google**, não reativar Microsoft SMTP.
