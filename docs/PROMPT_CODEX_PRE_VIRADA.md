# Prompt para o Codex — configuração pré-virada do Mysteptime (22/11/2026)

> Copie tudo abaixo da linha e cole no Codex.

---

Você vai configurar variáveis e opções de autenticação do sistema **Mysteptime** antes da virada do Lovable para Vercel + Supabase próprio. Trabalhe com cuidado máximo: siga os passos **na ordem**, confira cada um e **pare e me avise** se algo não bater exatamente com o descrito.

## Regras obrigatórias (não negociáveis)

1. **Nunca** exiba, registre em log, grave em arquivo, commit ou responda com o **valor** de qualquer chave, token, URL secreta ou senha. Nos relatórios, mostre só o **nome** da variável e "configurada / não configurada".
2. **Não** altere nenhum outro secret, variável, schema, tabela, dado, RLS, Edge Function, cron, domínio ou deploy além do listado aqui.
3. **Não remova** nenhuma variável existente. Se uma variável já existir com o mesmo nome, **atualize** o valor (não crie duplicada), e só se eu tiver fornecido o valor.
4. **Não** rode `import-data.mjs`, `sync-final.mjs --commit`, `cron.sql`, merge na `main` nem nada de virada. Isso é feito depois, por outra pessoa.
5. Se uma tela/CLI pedir confirmação de algo destrutivo (apagar projeto, chave, domínio, desligar auth), **cancele** e me avise.
6. Projetos corretos (confira o ID antes de cada ação):
   - **Supabase do Mysteptime (destino):** `knzszyxsspdjzgqkfrdt`
   - **Supabase da Intranet (NÃO mexer, só leitura se necessário):** `qxmxtbjxkhecqilpnhgq`
   - **Vercel:** time `douglas-6d4f`, projeto `mysteptime` (ID `prj_EeFDYkPChLX21aKEFJSwGpwnMhw0`)

## Valores que eu (Douglas) vou te fornecer

Peça-me estes valores **em privado** se ainda não tiver (não invente, não reutilize outros tokens):

| Nome | O que é | Onde obter |
|---|---|---|
| `M365_FLOW_URL` | URL do gatilho HTTP do fluxo do Power Automate que envia pela caixa **noreply** (o **mesmo** fluxo usado pela Intranet STEP One) | Power Automate → fluxo de envio da noreply → gatilho "Quando uma solicitação HTTP for recebida" → copiar "URL HTTP POST" |
| `SMARTSHEET_OFFSHORE_SHEET_ID` | ID numérico da planilha usada na tela **Colaboradores** (dados offshore). No Lovable aparecia como `VITE_SMARTSHEET_SHEET_ID` | Lovable → Settings → variáveis do projeto, ou Smartsheet → planilha → File → Properties → Sheet ID |

Observação: `SMARTSHEET_API_TOKEN` **já está** na Vercel. Não altere.

---

## Passo 1 — Vercel: variáveis de ambiente

Projeto `mysteptime` → Settings → Environment Variables.

1.1. Criar/atualizar **`M365_FLOW_URL`**
- Valor: o fornecido por mim.
- Ambientes: **Production** e **Preview** (os dois).
- Tipo: **Sensitive**.
- Atenção: o nome **não** pode ter prefixo `VITE_`.

1.2. Criar/atualizar **`SMARTSHEET_OFFSHORE_SHEET_ID`**
- Valor: o ID numérico fornecido (só dígitos, sem espaços).
- Ambientes: **Production** e **Preview**.
- Tipo: Sensitive.

1.3. Conferir (sem mostrar valores) que **existem** em Production e Preview:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTRANET_SUPABASE_URL`, `INTRANET_SUPABASE_PUBLISHABLE_KEY`, `NITRO_PRESET`, `SMARTSHEET_API_TOKEN`, `SMARTSHEET_BM_FLOW_SHEET_ID`, `SMARTSHEET_JOB_ORDER_SHEET_ID`, `DRAKE_USERNAME`, `DRAKE_PASSWORD`, `MYSTEPTIME_AUTOMATION_EMAIL`, `MYSTEPTIME_AUTOMATION_PASSWORD`, `M365_FLOW_URL`, `SMARTSHEET_OFFSHORE_SHEET_ID`.
- Confirme que `VITE_SUPABASE_URL` e `SUPABASE_URL` apontam para `https://knzszyxsspdjzgqkfrdt.supabase.co` (esse valor é público, pode mostrar).
- **Não** crie `ANTHROPIC_API_KEY` (a IA foi removida). Se existir, **não apague**; só me informe.
- Se existirem `VITE_SMARTSHEET_TOKEN` ou `VITE_SMARTSHEET_SHEET_ID`, **não apague**; só me informe (vou decidir).

1.4. **Não** faça redeploy manual. O próximo push na branch `feat/migracao-intranet` gera o preview.

## Passo 2 — Supabase `knzszyxsspdjzgqkfrdt`: secrets das Edge Functions

Dashboard → Project `knzszyxsspdjzgqkfrdt` → Edge Functions → **Secrets** (ou `npx supabase secrets set --project-ref knzszyxsspdjzgqkfrdt`, se o CLI estiver logado; nunca passe o valor em linha de comando que fique no histórico — prefira o painel).

2.1. Criar/atualizar **`M365_FLOW_URL`** com o **mesmo** valor do passo 1.1.

2.2. **Não** crie `CRON_SECRET` agora (será criado na virada junto com o cron; criar antes pode bloquear o job de snapshot que está ativo).

2.3. **Não** crie `ANTHROPIC_API_KEY`, `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2` — não são mais usados.

2.4. Relatório: liste os **nomes** dos secrets existentes (sem valores).

## Passo 3 — Supabase `knzszyxsspdjzgqkfrdt`: URLs do Auth

Dashboard → Authentication → **URL Configuration**.

3.1. **Site URL:** `https://intranet.step-og.com/mysteptime`

3.2. **Redirect URLs** — adicionar (sem remover as que já existem):
- `https://intranet.step-og.com/mysteptime/**`
- `https://mysteptime.vercel.app/mysteptime/**`
- `https://mysteptime-*-douglas-6d4f.vercel.app/mysteptime/**`
- `http://localhost:3000/mysteptime/**`

3.3. **Não** mexer em: provedores, "Enable sign ups", SMTP, templates, JWT, chaves. (Desligar cadastro direto é feito na virada.)

3.4. Salvar e tirar um print/descrição do resultado.

## Passo 4 — Revogar as chaves expostas em conversa

Essas chaves apareceram em chat e precisam ser invalidadas. **Antes de revogar, confirme que existe outra chave ativa equivalente** para não derrubar o sistema.

4.1. **Secret key `sb_secret_BfTJ…`** do projeto `knzszyxsspdjzgqkfrdt`:
- Dashboard → Project Settings → **API Keys** → seção Secret keys.
- Se ela for a **única** secret key: primeiro **crie uma nova** secret key, depois me avise para eu atualizar `SUPABASE_SERVICE_ROLE_KEY` na Vercel **com a nova** antes de revogar a antiga. Pare aqui e espere minha confirmação.
- Se já houver outra secret key em uso pela Vercel: revogue somente a que começa com `sb_secret_BfTJ`.

4.2. **Personal Access Token `sbp_fc9a…`**:
- supabase.com → Account → **Access Tokens** → revogue o token que começa com `sbp_fc9a`.
- Não revogue outros tokens.

## Passo 5 — Validação (sem mostrar valores)

5.1. Vercel: confirme que `M365_FLOW_URL` e `SMARTSHEET_OFFSHORE_SHEET_ID` aparecem em Production e Preview.

5.2. Supabase: confirme que o secret `M365_FLOW_URL` aparece na lista.

5.3. Auth: confirme Site URL e as 4 Redirect URLs.

5.4. Chaves: confirme que `sb_secret_BfTJ…` e `sbp_fc9a…` aparecem como revogadas/inexistentes (ou que você parou no 4.1 aguardando).

## Relatório final (formato obrigatório)

```
VERCEL
- M365_FLOW_URL: configurada (Production, Preview)
- SMARTSHEET_OFFSHORE_SHEET_ID: configurada (Production, Preview)
- Variáveis conferidas faltando: <lista ou "nenhuma">
- Variáveis antigas encontradas (não apagadas): <lista ou "nenhuma">

SUPABASE SECRETS (knzszyxsspdjzgqkfrdt)
- M365_FLOW_URL: configurada
- Lista de nomes: <...>

AUTH URLS
- Site URL: <valor>
- Redirect URLs: <lista>

CHAVES
- sb_secret_BfTJ…: revogada | aguardando (motivo)
- sbp_fc9a…: revogado

PROBLEMAS / DÚVIDAS
- <qualquer coisa que não bateu>
```

Não inclua nenhum valor secreto no relatório.
