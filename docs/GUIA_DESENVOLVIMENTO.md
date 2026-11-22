# Guia de desenvolvimento do Mysteptime (VS Code + Claude Code + GitHub)

Desde 22/11/2026 o Mysteptime **não usa mais o Lovable**. Todo código vai pelo GitHub
(`stepoil-debug/mysteptime`) e a Vercel publica sozinha. O Lovable ficou parado só como histórico:
**não edite nada lá e não peça para ele "subir" PRs**.

## Como era × como é agora

| Antes (Lovable) | Agora |
|---|---|
| Abria PR no GitHub e pedia ao Lovable "gh pr checkout N, sobe esse código" | Faz o merge do PR na `main` — a Vercel publica sozinha |
| Lovable aplicava as migrations | Você aplica com `npm run db:migration` (comando `/migration`) |
| Banco no Lovable Cloud | Supabase próprio `knzszyxsspdjzgqkfrdt`, schema `mysteptime` |
| App em `mysteptime.lovable.app` | `https://intranet.step-og.com/mysteptime` (pelo card da Intranet) |

## Preparar o computador (uma vez)

1. Instale: **Git**, **Node.js 22+**, **VS Code**, extensão **Claude Code**, **GitHub CLI** (`gh`).
2. `gh auth login` (conta com acesso a `stepoil-debug/mysteptime`).
3. Clone e instale:
   ```
   git clone https://github.com/stepoil-debug/mysteptime.git
   cd mysteptime
   npm install
   ```
4. Crie o arquivo `.env.local` na raiz (peça os valores ao responsável; **nunca** commite):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
   - `MYSTEPTIME_DB_URL` (só se você for aplicar migrations)
5. `npm run dev` e abra o endereço mostrado (o app roda em `/mysteptime`).

## O dia a dia (3 comandos no Claude Code)

Abra a pasta no VS Code, abra o Claude Code e use:

1. **`/nova-tarefa <o que fazer>`** — atualiza a `main`, cria a branch e localiza os arquivos.
2. Peça a alteração normalmente ao Claude.
3. **`/migration <o que muda no banco>`** — só se mexer em tabela/coluna/função/policy.
4. **`/publicar`** — roda as validações, commita, abre o PR, espera o preview da Vercel,
   pergunta se pode publicar e faz o merge (produção).

### Fazendo à mão (sem os comandos)

```
git checkout main
git pull origin main
git checkout -b fix/descricao-curta
# ... altera os arquivos ...
npm run typecheck
npx vitest run          # 14 falhas já existiam; não pode aumentar
npm run build
npm run check:server-boundaries
git add <arquivos>
git commit -m "fix(area): o que mudou"
git push -u origin fix/descricao-curta
gh pr create --base main --fill
# conferir o preview da Vercel no PR
gh pr merge <número> --merge --delete-branch
```

## Regras

- Nunca commitar direto na `main`; sempre branch + PR.
- Nunca colocar chaves, senhas ou tokens no código, no commit ou no chat.
  Variáveis ficam na Vercel (projeto `mysteptime`) e secrets de Edge Functions no painel do Supabase.
- Mudança de banco: sempre migration em arquivo, ensaiada (ROLLBACK) antes de gravar, e gravada
  **antes** do merge do código que depende dela. Preview e produção usam o **mesmo banco**.
- Não reintroduzir `@lovable.dev/*`, `.lovable/` nem URLs `*.lovable.app`.

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| Código | GitHub `stepoil-debug/mysteptime` |
| Publicação | Vercel, projeto `mysteptime` (push em branch = preview; merge na `main` = produção) |
| Banco, login, arquivos, Edge Functions | Supabase `knzszyxsspdjzgqkfrdt` (schema `mysteptime`) |
| Rotinas automáticas (cron) | `cron.job` no Supabase (snapshot, alertas, equipes fixas, Drake) |
| E-mail | Caixa noreply via Power Automate (`M365_FLOW_URL`) |
| Entrada dos usuários | Card do Mysteptime na Intranet STEP One (login automático) |

## Se der problema em produção

- Na Vercel (projeto `mysteptime` → Deployments), use **Instant Rollback** para o deploy anterior; ou
- `git revert -m 1 <commit do merge>` numa branch nova e `/publicar`.
- Para devolver os usuários ao Lovable (emergência): na Intranet, `MYSTEPTIME_NEW_APP_FOR_ALL = false`
  em `server/functions/auth-mysteptime-launch.mts`.
