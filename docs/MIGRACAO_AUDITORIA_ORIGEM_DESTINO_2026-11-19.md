# Auditoria de migração Lovable → Supabase / Vercel — 2026-11-19

## Ambientes conferidos
- Origem Lovable: projeto `e3ef1542-ee0e-4fca-996f-6b3a20bf536b`, banco Lovable Cloud `lzahnaekoiervgqxmouv`, schema `public`.
- Destino: Supabase `knzszyxsspdjzgqkfrdt`, schema `mysteptime`; deploy futuro na Vercel.
- Origem: 88 tabelas; destino: 89 tabelas. Diferença de quantidade, por si só, não prova incompatibilidade.
- Nenhum dado modificado ou segredo exportado por esta auditoria.

## Contagens exatas (SELECT COUNT(*) em origem e destino)
| Tabela | Lovable origem | Destino | Diferença (origem - destino) |
|---|---:|---:|---:|
| mo_planejamento | 219 | 0 | +219 |
| mo_editores | 2 | 0 | +2 |
| mo_funcao_depara | 16 | 0 | +16 |
| drake_logistica_embarques | 446 | 0 | +446 |
| drake_enderecos | 300 | 0 | +300 |
| profiles | 44 | 43 | +1 |
| collaborators | 586 | 573 | +13 |
| timesheet_dias | 135052 | 133485 | +1567 |
| transport_trips | 2429 | 2274 | +155 |
| notifications | 7071 | 3318 | +3753 |
| flow_track_events | 18718 | 14293 | +4425 |
| form_drafts | 11 | 0 | +11 |
| nominations | 307 | 216 | +91 |
| drake_sync_runs | 212 | 203 | +9 |

Contagens diferentes podem refletir sincronização pendente, exclusões ou novos registros. Não copiar dados cegamente; comparar identidade das linhas, timestamps e regras de transformação antes de aplicar.

## Storage (quantidade de objetos)
| Bucket | Origem | Destino |
|---|---:|---:|
| bm-mob-desmob-notas | 1 | 1 |
| nomeacoes-anexos | 16 | 12 |
| reembolsos-anexos | 7 | 7 |
| database_export_03_11_26 | 1 | ausente |

O bucket de exportação pode ser backup legado e não precisar migrar. Conferir metadados, checksums, vínculos e arquivos antes da virada. Pelo menos 4 arquivos de nomeações podem estar faltando.

## Edge Functions e secrets
- Ver inventário local em `docs/EDGE_FUNCTION_SECRETS_AUDIT.md`.
- Destino tem funções publicadas, mas valores dos secrets de Lovable não foram exportados.
- Secrets Lovable criptografados não devem ser exibidos ou copiados para este relatório. Recuperar nomes e origem das credenciais; gerar novas chaves se necessário.
- Considerar integrações Smartsheet, Anthropic, SMTP, Resend e CRON. Confirmar quais efetivamente são usadas em produção.

## Próximos passos antes de migrar
1. Confirmar names de secrets/integrações na origem Lovable sem revelar valores.
2. Comparar todas as 88 tabelas: esquema, chaves, índices, RLS, funções, triggers e contagens exatas, distinguindo conteúdo novo e alterações.
3. Preparar exportação incremental/consistente; executar sincronização em etapa de corte controlada, evitando substituir registros de destino mais novos.
4. Comparar e transferir arquivos de Storage ausentes por ID/chave/checksum.
5. Registrar e configurar credenciais corretas do destino no Supabase/Vercel, sem expô-las em frontend.
6. Testar login e SSO da Intranet, Edge Functions, envio de email, Smartsheet, IA, cron, URLs e CRUD.
7. Somente após validação fazer cutover DNS/rotas; preservar rollback e não excluir o ambiente Lovable ou schema antigo automaticamente.

## Notas da arquitetura no repositório
- `docs/MIGRACAO_INTRANET.md` registra histórico, scripts e `supabase/cutover/cron.sql`.
- Migração estava parcialmente executada: **não** reexecutar importação com --commit sem backup, comparação e janela de corte.

## Inventário dos secrets da origem Lovable (nomes somente)

Auditoria somente leitura do agente Lovable identificou 14 nomes: `APIKEY`, `API_RESEND`, `EMAIL_SETTINGS_ENCRYPTION_KEY`, `FLOW_TRACK_SYNC_SECRET`, `LGP_FLOW_ACCESS_TOKEN`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `SMARTSHEET_API_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2`, `SMARTSHEET_SHEET_ID`, `SMARTSHEET_TOKEN`, `SMS_SYNC_ACCESS_TOKEN`.

**Atenção:** estes nomes não são os valores e não comprovam que cada integração esteja operacional. As chaves `LOVABLE_API_KEY` e `RESEND_API_KEY` podem ser gerenciadas pela Lovable/conector; migrar para provedor independente requer outras credenciais. Variáveis `CRON_SECRET`, `SMTP_*`, `DRAKE_*` e `MYSTEPTIME_AUTOMATION_*` são usadas no código e não constam dessa lista de 14 secrets; podem existir em outros ambientes (p.ex. Vercel) e exigem inspeção independente. Um segredo `drake_cron_secret` também está registrado no Vault do banco original; **não** copiar seu valor nem confundir com `CRON_SECRET`.

**Divergência relevante:** na Lovable a função `extract-invoice-number-ai` utiliza `LOVABLE_API_KEY` (gateway Lovable); no Supabase novo o código usa `ANTHROPIC_API_KEY`. A substituição exige uma chave própria da Anthropic e teste funcional. A função de e-mail `create-fixed-nominations` requer chave Resend própria fora do conector Lovable.

O plano produzido pela Lovable sugeriu recriar toda estrutura e usuários, mas **isso já foi parcialmente executado conforme a documentação e verificações no Supabase**. Não repetir carga integral ou redefinir senhas automaticamente sem diagnóstico e consentimento.
