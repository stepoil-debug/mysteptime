---
description: Começa uma alteração no Mysteptime em branch nova a partir da main atualizada
argument-hint: <descrição curta da alteração>
---

Vou começar a alteração: **$ARGUMENTS**

Siga exatamente, em português:

1. Leia `CLAUDE.md`, `AGENTS.md` e `docs/GUIA_DESENVOLVIMENTO.md` se ainda não leu nesta conversa.
2. Rode `git status`. Se houver alterações não commitadas, PARE e me pergunte o que fazer com elas (não descarte nada).
3. Atualize a main e crie a branch:
   - `git checkout main`
   - `git pull origin main`
   - `git checkout -b <tipo>/<nome-curto>` — tipo: `feat` (função nova), `fix` (correção), `chore` (manutenção), `docs`. Nome em minúsculas, com hífens, a partir de "$ARGUMENTS".
4. Rode `npm install` só se o `package-lock.json` mudou no pull.
5. Localize os arquivos envolvidos com busca (grep/glob) antes de abrir arquivos grandes. Explique em 3–5 linhas o que vai mudar e em quais arquivos, e confirme comigo antes de editar se o pedido estiver ambíguo.
6. Faça a alteração mínima necessária, preservando o que já funciona.
7. Se precisar mudar banco (tabela, coluna, função, policy), NÃO altere direto no Supabase: use o comando `/migration`.
8. Ao terminar, rode `/publicar`.

Nunca: commitar direto na `main`, usar Lovable, colocar chaves/senhas/tokens em código ou commit.
