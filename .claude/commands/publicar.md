---
description: Valida, commita, abre PR, confere o preview da Vercel e publica na main (produção)
argument-hint: [mensagem do commit opcional]
---

Publique a alteração atual do Mysteptime. Siga exatamente, em português, e pare no primeiro erro:

## 1. Conferir a branch
- `git branch --show-current`. Se for `main`, PARE: crie uma branch (`git checkout -b fix/...`) antes de continuar.
- `git status` e `git diff --stat`: mostre o que vai entrar. Não inclua `.env*`, `node_modules`, arquivos de build nem nada com chave/senha/token.

## 2. Validar localmente (obrigatório)
Rode, nesta ordem:
- `npm run typecheck` → precisa dar 0 erros.
- `npx vitest run` → há **14 testes que já falhavam antes** (filtros `ativo=true` e cookie jar do Drake). O total de falhas não pode passar de 14. Se passar, corrija antes de seguir.
- `npm run build` → precisa terminar sem erro.
- `npm run check:server-boundaries` → precisa dar OK.

## 3. Commit e push
- Commit em português, no padrão `tipo(área): o que mudou` (ex.: `fix(nomeacoes): corrige filtro de etapa`). Se eu passei mensagem, use: "$ARGUMENTS".
- `git push -u origin <branch>`

## 4. Pull Request
- `gh pr create --base main --fill` (ou com título/descrição claros: o que mudou, como testar).
- Mostre o link do PR.

## 5. Conferir o preview
- A Vercel gera um preview automaticamente para o PR. Rode `gh pr checks <número> --watch` até "Vercel" ficar `pass`.
- Mostre o link do preview e diga o que eu devo conferir nele (telas afetadas).
- Se houver migration nesta alteração: lembre que ela precisa ser aplicada com `/migration` ANTES do merge (o preview e a produção usam o mesmo banco).
- PERGUNTE se pode publicar. Só continue com meu "sim".

## 6. Publicar (produção)
- `gh pr merge <número> --merge --delete-branch`
- A Vercel publica a `main` em produção sozinha (2–5 min). Acompanhe com `gh run list` ou pelo link da Vercel no PR.
- Produção: https://intranet.step-og.com/mysteptime (o mesmo app em https://mysteptime.vercel.app/mysteptime).
- Volte para a main: `git checkout main && git pull origin main`.

## 7. Se der problema em produção
- Reverter: `gh pr view <número> --json mergeCommit` → `git revert -m 1 <commit>` numa branch nova → `/publicar`.
- Ou, na Vercel (projeto `mysteptime`), use "Instant Rollback" para o deploy anterior.
