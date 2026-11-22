# Inventário final do Lovable — My Step Time

Leitura em 21/11/2026. Aplicação publicada em [mysteptime.lovable.app](https://mysteptime.lovable.app). Origem `lzahnaekoiervgqxmouv.public`. Destino `knzszyxsspdjzgqkfrdt.mysteptime`. O painel de domínios do Lovable mostrou somente o endereço padrão. Escopo verificado em consultas de catálogo, painel Lovable, configuração versionada e metadados do Supabase de destino.

## Secrets e integrações

O painel do Lovable mostrou os 14 nomes abaixo. Os usos indicados vêm do código das Edge Functions e da auditoria do servidor do projeto. Variáveis sem consumidor identificado exigem revisão antes de migrar.

| Nome na origem | Uso |
| --- | --- |
| `APIKEY` | Consumidor ativo não confirmado. |
| `API_RESEND` | Alias de integração de e-mail no servidor TanStack. |
| `EMAIL_SETTINGS_ENCRYPTION_KEY` | Criptografia da configuração de e-mail no servidor. |
| `FLOW_TRACK_SYNC_SECRET` | Integração de sincronização do Flow Track no servidor. |
| `LGP_FLOW_ACCESS_TOKEN` | Monitoramento LGP Flow. |
| `LOVABLE_API_KEY` | Extração de número de nota em `extract-invoice-number-ai`; destino usa `ANTHROPIC_API_KEY`. |
| `RESEND_API_KEY` | Envio em `create-fixed-nominations`; também exigido pelo código atualmente publicado de alertas de turma no destino. |
| `RESEND_FROM` | Remetente de envio pelo Resend. |
| `SMARTSHEET_API_TOKEN` | Acesso Smartsheet no servidor TanStack. |
| `SMARTSHEET_ID_1` | Planilha Smartsheet consumida em `get-bm-smartsheet-data`. |
| `SMARTSHEET_ID_2` | Segunda planilha Smartsheet consumida em `get-bm-smartsheet-data`. |
| `SMARTSHEET_SHEET_ID` | Referência de planilha registrada; não se confirmou consumidor ativo. |
| `SMARTSHEET_TOKEN` | Acesso Smartsheet em `get-bm-smartsheet-data`. |
| `SMS_SYNC_ACCESS_TOKEN` | Acesso da sincronização SMS no servidor. |

- Smartsheet: o servidor também referencia `SMARTSHEET_BM_FLOW_SHEET_ID` e `SMARTSHEET_JOB_ORDER_SHEET_ID`. Os IDs só ficaram disponíveis como nomes de variáveis protegidas na evidência examinada. Os valores não foram extraídos.
- Drake: cron chama a rota de integração. O servidor referencia `DRAKE_USERNAME`, `DRAKE_PASSWORD`, `DRAKE_BASE_URL`, `DRAKE_LOGIN_URL`, `DRAKE_QUERY_URL`, `DRAKE_CLIENT_NAME`, `DRAKE_CONTEXT_NAME`, `MYSTEPTIME_AUTOMATION_EMAIL` e `MYSTEPTIME_AUTOMATION_PASSWORD`. O Vault contém `drake_cron_secret` na origem e `cron_secret`, `drake_cron_secret` no destino.
- E-mail: na origem, os alertas de turma no código usam `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; as nomeações fixas usam Resend. No destino, ambas as funções publicadas usam Resend. A branch local referencia `M365_FLOW_URL` nas duas funções. Homologar o fluxo HTTP e o remetente noreply antes da virada.
- Destino, secrets personalizados visíveis de Edge Functions: `CRON_SECRET` e `RESEND_FROM`. Faltam os nomes `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2` para o código publicado e `M365_FLOW_URL` para o fluxo da branch local. Esta leitura diz respeito ao runtime de Edge Functions; as variáveis da Vercel têm configuração própria.

## Edge Functions

A configuração versionada e o código da origem foram lidos. A API de gerenciamento do Supabase não autorizou a listagem de deployments da origem. No destino, presença, `verify_jwt` e código são da versão publicada.

| Função | `verify_jwt` origem | Variáveis no código de origem | `verify_jwt` destino | Variáveis no código publicado do destino |
| --- | --- | --- | --- | --- |
| `admin-user-management` | padrão `true`; sem confirmação do deploy | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `true` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `capture-planejamento-snapshot` | `false` no repositório | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `false` | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `check-turma-alerts` | `false` no repositório | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `false` | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM` |
| `create-fixed-nominations` | `false` no repositório | `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `false` | `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `extract-invoice-number-ai` | padrão `true`; sem confirmação do deploy | `LOVABLE_API_KEY` | `true` | `ANTHROPIC_API_KEY` |
| `get-bm-smartsheet-data` | padrão `true`; sem confirmação do deploy | `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2` | `true` | `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1`, `SMARTSHEET_ID_2` |
| `tmp-import-files` | Sem evidência na origem | — | `true` | — |

`tmp-import-files` é adicional no destino. O material consultado não confirmou dependência de variável nessa função. Antes da virada, verificar a finalidade e o acesso sem alterar a publicação.

## Agendamento

Comandos normalizados a método, operação, endpoint e fonte da autenticação. Valores e cabeçalhos sensíveis ficaram fora do inventário. Horários da tabela em UTC.

| Job ativo na origem | Expressão | Comando e endpoint |
| --- | --- | --- |
| `daily-planejamento-embarque-snapshot` | `0 9 * * *` | `net.http_post` em `https://lzahnaekoiervgqxmouv.functions.supabase.co/capture-planejamento-snapshot`; cabeçalho de cron via configuração do banco. |
| `drake-sync-horario-fixo` | `5 9-23/2 * * *` | `net.http_post` em `https://mysteptime.lovable.app/api/integrations/drake/cron`; referência Vault `drake_cron_secret`. |
| `flow-track-demandas-sync` | `*/15 * * * *` | `net.http_post` em `https://mysteptime.lovable.app/api/public/flow-track-demandas-sync`. |

No destino, `mysteptime-daily-planejamento-embarque-snapshot` está ativo às 09:00 UTC, ao mesmo tempo que a origem. `mysteptime-daily-create-fixed-nominations`, `mysteptime-daily-turma-alert` e `mysteptime-drake-sync-horario-fixo` existem desativados. O job equivalente de Flow Track está ausente.

## Auth

| Item | Origem | Destino |
| --- | --- | --- |
| Provedores | 44 identidades `email` registradas. Flags administrativas não acessíveis pelo painel ou API disponíveis. | Apenas Email ativo. 43 identidades `email`. Cadastros novos e confirmação de e-mail habilitados. Login anônimo desligado. |
| Site URL | Não verificada. | `http://localhost:3000`. |
| Redirect URLs | Não verificadas. | Lista vazia. |
| Templates | Painel administrativo da origem inacessível. | Categorias disponíveis: confirmação de cadastro, convite, magic link/OTP, alteração de e-mail, redefinição de senha e reautenticação. Catálogo de notificações de segurança disponível. Conteúdo customizado não comparado. |
| SMTP personalizado do Auth | Não verificável com o acesso atual. | Desabilitado no painel. |

A entrada prevista é pela Intranet. O Site URL local e o cadastro público habilitado no Auth de destino precisam de decisão de configuração antes da virada.

## Storage privado

| Bucket | Origem | Destino | Bytes em cada ambiente |
| --- | ---: | ---: | ---: |
| `bm-mob-desmob-notas` | 1 | 1 | 2103146 |
| `nomeacoes-anexos` | 16 | 16 | 20017669 |
| `reembolsos-anexos` | 7 | 7 | 5232804 |
| `database_export_03_11_26` | 1 | ausente | backup fora dos três buckets operacionais |

Nos três buckets operacionais, os caminhos, tamanhos e content-types coincidem. Vinte arquivos têm ETag idêntico. Os outros quatro, em `nomeacoes-anexos`, têm 595.593 bytes cada. Cada ETag no destino é multipart de uma parte e coincide com `md5(decode(etag_origem, 'hex')) || '-1'` após remover aspas. A comparação usou os checksums dos metadados armazenados. Nenhum caminho faltou e nenhum arquivo foi copiado ou baixado. [Documentação de checksums S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)

| Policy | Papel | Comando | Comparação |
| --- | --- | --- | --- |
| `nomeacoes_anexos_insert` | authenticated | INSERT | Existe nos dois, expressão diferente. |
| `nomeacoes_anexos_select` | authenticated | SELECT | Existe nos dois, expressão diferente. |
| `operators_bm_mob_desmob_notas_all` | authenticated | ALL | Igual com nomes de schemas normalizados. |
| `operators_reembolsos_anexos_storage_all` | authenticated | ALL | Igual com nomes de schemas normalizados. |
| `nominations_roles_scope_storage_all` | authenticated | ALL | Adicional no destino, bucket `nomeacoes-anexos`. |

## Objetos SQL e diferenças

As 88 tabelas e todas as colunas da origem têm homólogas no destino. O destino tem `bm_dias_overrides` adicional. As extensões instaladas e nomes de triggers e relações do schema da aplicação coincidem. A comparação não valida a equivalência de cada corpo de trigger.

- Drift da origem já registrado no repositório fora de `supabase/migrations/`: tabelas `timesheet_embarques`, `timesheet_semanas` e `timesheet_dias`; coluna `hist_novo_colaboradores.ativo`; colunas `drake_sync_runs.source_type`, `source_file_name`, `base_inserted`, `base_ignored`, `base_not_found`. Os arquivos `sql-extra` documentam o bootstrap e as colunas. O conteúdo de todas as migrations não foi reexecutado em banco efêmero, então a lista de drift do repositório é parcial.
- Assinaturas da origem sem equivalente no schema do destino: `cost_simulator_local_stats(p_filters jsonb)`, `cost_simulator_transport_trajetos(p_filters jsonb)`, `cost_simulator_unit_stats(p_filters jsonb)`, `is_active_member(_user_id uuid)`. As assinaturas de `has_role` e `nomination_notificar_logistica_inserir` têm correspondentes com tipos qualificados no schema do destino.
- A FK e o tipo de `timesheet_semanas.recebido_por` faltam no destino e têm migration adicional testada com ROLLBACK. Ver relatório de divergências.

## Contas e vínculos

Correspondência de e-mail sem diferenciar maiúsculas. A busca de referências contou tabelas do schema da aplicação com UUID exato em colunas de primeiro nível, incluindo perfil e papel. A contagem da tabela abaixo é do aplicativo. Em colunas de referência do Auth, encontrei três tabelas adicionais para Douglas (`auth.identities`, `auth.refresh_tokens`, `auth.sessions`) e uma para cada um dos outros dois (`auth.identities`). Total, excluindo a própria linha de `auth.users`: Douglas 8, Matheus 3 e Thales 3. Nenhuma referência apareceu nas colunas de propriedade consultadas em Storage. Referências dentro de JSON aninhado ou texto livre ficaram fora do recorte.

| E-mail | Papel | Perfil | Tabelas na origem com UUID antigo | Evidência no destino |
| --- | --- | --- | ---: | --- |
| `douglas.tabella@step-og.com` | administrador | Perfil presente, campo `perfil` nulo nos dois | 5 | Novo UUID em perfil, papel, notificações, eventos e presença. UUID antigo em 15 eventos e 1 registro de presença. |
| `matheus.marques@step-og.com` | pm | Projetos | 2 | Conta ausente. |
| `thales.vieira@step-og.com` | pm | Coordenador de Projetos | 2 | Novo UUID em perfil e papel. UUID antigo ausente no recorte do destino. |

- Douglas: `1d501add-b207-46e2-88ee-dd1aa4f3ac56` na origem → `e2a7ac3f-207d-437d-955b-2d2721a26218` no destino. Aguardar decisão para simular remapeamento dos registros restantes ou manter o identificador histórico.
- Matheus: `f7644a66-87f7-46df-b4df-4ad1e5d4e075`. O teste criou Auth, identidade, perfil e papel `pm` com ROLLBACK. O gatilho ativo em Auth também cria perfil e papel no schema legado `public`. Os registros de teste ficaram zerados após o ROLLBACK. Aguardar escolha sobre esse efeito antes de qualquer COMMIT. Testar entrada pela Intranet com a flag de primeiro acesso preservada.
- Thales: `993d74ab-ec62-43d5-b447-e9eb3d90e6c2` → `d70b2ac7-b7d7-4b20-b5b4-cd714930ef4a`. Preservar a conta de destino e traduzir vínculos que venham da origem após aprovação do mapa.

### Relação de e-mails

| Origem (44) | Destino (43) |
| --- | --- |
| `alvaro.moura@step-og.com` | `alvaro.moura@step-og.com` |
| `ana.freitas@step-og.com` | `ana.freitas@step-og.com` |
| `ana.garcia@step-og.com` | `ana.garcia@step-og.com` |
| `bruna.roque@step-og.com` | `bruna.roque@step-og.com` |
| `carlo.da.palma@step-og.com` | `carlo.da.palma@step-og.com` |
| `carolina.blume@step-og.com` | `carolina.blume@step-og.com` |
| `daniele.silva@step-og.com` | `daniele.silva@step-og.com` |
| `diego.ramos@step-og.com` | `diego.ramos@step-og.com` |
| `douglas.jacinto@step-og.com` | `douglas.jacinto@step-og.com` |
| `douglas.tabella@step-og.com` | `douglas.tabella@step-og.com` |
| `etapa.teste@step-og.com` | `etapa.teste@step-og.com` |
| `fernando.junger@step-og.com` | `fernando.junger@step-og.com` |
| `fernando.v.junger@gmail.com` | `fernando.v.junger@gmail.com` |
| `gabriel.sales@sttep-og.com` | `gabriel.sales@sttep-og.com` |
| `gustavo.rangel@step-og.com` | `gustavo.rangel@step-og.com` |
| `henrique.correia@step-og.com` | `henrique.correia@step-og.com` |
| `hermann.siqueira@step-og.com` | `hermann.siqueira@step-og.com` |
| `larissa.silva@step-og.com` | `larissa.silva@step-og.com` |
| `logisticapessoal@step-og.com` | `logisticapessoal@step-og.com` |
| `luis.santos@step-og.com` | `luis.santos@step-og.com` |
| `marcos.pimentel@step-og.com` | `marcos.pimentel@step-og.com` |
| `maria.ribeiro@step-og.com` | `maria.ribeiro@step-og.com` |
| `matheus.marques@step-og.com` | `matheus.moreira@step-og.com` |
| `matheus.moreira@step-og.com` | `matheus.pedrosa@step-og.com` |
| `matheus.pedrosa@step-og.com` | `natan.oliveira@step-og.com` |
| `natan.oliveira@step-og.com` | `paulo.chaves@step-og.com` |
| `paulo.chaves@step-og.com` | `paulo.nunes@step-og.com` |
| `paulo.nunes@step-og.com` | `pm.teste@step-og.com` |
| `pm.teste@step-og.com` | `qualidade@step-og.com` |
| `qualidade@step-og.com` | `rafael.brandao@step-og.com` |
| `rafael.brandao@step-og.com` | `rh@step-og.com` |
| `rh@step-og.com` | `ricardo.carvalho@step-og.com` |
| `ricardo.carvalho@step-og.com` | `rodrigo.muniz@step-og.com` |
| `rodrigo.muniz@step-og.com` | `rodrigo.quintao@step-og.com` |
| `rodrigo.quintao@step-og.com` | `ruan.araujo@step-og.com` |
| `ruan.araujo@step-og.com` | `sandro.manhaes@step-og.com` |
| `sandro.manhaes@step-og.com` | `sergio.junior@step-og.com` |
| `sergio.junior@step-og.com` | `sms@step-og.com` |
| `sms@step-og.com` | `thales.vieira@step-og.com` |
| `thales.vieira@step-og.com` | `uelton.pereira@step-og.com` |
| `uelton.pereira@step-og.com` | `valter.santos@step-og.com` |
| `valter.santos@step-og.com` | `vinicius.brand@step-og.com` |
| `vinicius.brand@step-og.com` | `visitante.teste@step-og.com` |
| `visitante.teste@step-og.com` | — |

As duas colunas são listas independentes em ordem alfabética. A correspondência por identidade está na tabela de vínculos.
