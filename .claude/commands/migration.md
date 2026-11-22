---
description: Cria e aplica com segurança uma migration de banco no Supabase do Mysteptime
argument-hint: <o que muda no banco>
---

Mudança de banco: **$ARGUMENTS**

Antes era o Lovable que aplicava migrations. Agora é este fluxo. Siga exatamente, em português:

## 1. Entender o banco atual
- O banco é o Supabase próprio `knzszyxsspdjzgqkfrdt`. **Todas as tabelas ficam no schema `mysteptime`** (não em `public`).
- Se o MCP do Supabase estiver disponível (somente leitura), use `list_tables`/`execute_sql` de leitura para ver a estrutura atual. Senão, leia migrations anteriores em `supabase/migrations/`.

## 2. Escrever a migration
- Arquivo novo: `supabase/migrations/AAAAMMDDHHMMSS_descricao_curta.sql` (data/hora atual, UTC).
- Sempre qualifique com o schema: `mysteptime.tabela`. Em funções: `set search_path = mysteptime, public, extensions`.
- Tabela nova: ligue RLS (`alter table mysteptime.x enable row level security;`) e crie as policies. Dê `grant` para `authenticated` só no necessário.
- Prefira mudanças que não quebram o código atual (adicionar coluna com default; não renomear/apagar na mesma entrega).
- **Proibido sem confirmação explícita minha:** `DROP TABLE`, `TRUNCATE`, `DELETE` em massa, `DROP COLUMN`, desligar RLS.
- Atualize os tipos TypeScript se o código usar a coluna nova (`src/integrations/supabase/types.ts`).

## 3. Ensaiar (não grava nada)
- `npm run db:migration -- supabase/migrations/<arquivo>.sql`
- Precisa terminar com `ENSAIO OK (ROLLBACK)`. Se der erro, corrija o SQL e ensaie de novo.
- Requer `MYSTEPTIME_DB_URL` no `.env.local` (nunca commitar esse arquivo). Se não existir, PARE e me avise.

## 4. Gravar
- Mostre o SQL e o resultado do ensaio e PERGUNTE se pode gravar.
- Com meu "sim": `npm run db:migration -- supabase/migrations/<arquivo>.sql --commit`
- O script registra a migration em `mysteptime.app_migrations` e recusa aplicar a mesma duas vezes.
- Grave a migration **antes** do merge do PR do código que depende dela.

## 5. Rollback documentado
- No topo do arquivo, deixe em comentário o SQL para desfazer (`-- rollback: ...`).

Edge Functions (`supabase/functions/`): deploy com `npx supabase functions deploy <nome> --project-ref knzszyxsspdjzgqkfrdt` (precisa `npx supabase login`). Secrets só pelo painel do Supabase, nunca no código.
