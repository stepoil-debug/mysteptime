# Auditoria de secrets das Edge Functions — MyStepTime

Projeto Supabase: `knzszyxsspdjzgqkfrdt`. Auditoria somente leitura feita em 2026-11-19.

> **IMPORTANTE:** Presenca no arquivo `.env` local NAO implica que o secret existe no Supabase hospedado. A listagem de secrets remotos nao foi verificada neste diagnostico. Nunca salvar valores nesta documentacao ou em logs.

| Edge Function ativa | Variaveis exigidas pelo codigo | No `.env` local |
|---|---|---|
| `get-bm-smartsheet-data` | `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2` | Token: presente; ambos os IDs: ausentes |
| `extract-invoice-number-ai` | `ANTHROPIC_API_KEY` | Ausente |
| `check-turma-alerts` | `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP: chaves presentes, `SMTP_FROM` requer validacao; CRON_SECRET ausente |
| `create-fixed-nominations` | `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM` | Ausentes |
| `capture-planejamento-snapshot` | `CRON_SECRET` | Ausente |
| `admin-user-management` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Normalmente providos pela plataforma Supabase no runtime |

## Proximos passos seguros

1. Acesse `https://supabase.com/dashboard/project/knzszyxsspdjzgqkfrdt/functions/secrets` para conferir **somente os nomes** dos secrets ja cadastrados no projeto.
2. Determine quais Edge Functions sao realmente usadas em producao, antes de completar secrets opcionais. Nao substituir um secret existente por um valor do `.env` sem confirmar que ele e o atual.
3. Se `get-bm-smartsheet-data` for usada, identificar corretamente as planilhas para `SMARTSHEET_ID_1` e `SMARTSHEET_ID_2`. Existem nomes diferentes de IDs no `.env` (`SMARTSHEET_SHEET_ID`, `SMARTSHEET_BM_FLOW_SHEET_ID`, `SMARTSHEET_JOB_ORDER_SHEET_ID`); **nao assumir equivalencia**.
4. Para e-mail, confirmar a arquitetura pretendida: `check-turma-alerts` usa SMTP; `create-fixed-nominations` usa Resend. Nao migrar provedores silenciosamente.
5. `ANTHROPIC_API_KEY` e `CRON_SECRET` devem vir de uma fonte confiavel; nunca reutilizar um PAT do Supabase ou inventar seus valores.
6. Aplicar apenas as variaveis faltantes via painel do Supabase ou CLI, com permissao adequada. Validar as funcoes sem expor valores de secrets. Nao ha necessidade de preencher artificialmente as cinco tabelas vazias.
7. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sao variaveis automaticamente disponiveis no runtime hospedado segundo a documentacao Supabase.

Documentacao: https://supabase.com/docs/guides/functions/secrets
