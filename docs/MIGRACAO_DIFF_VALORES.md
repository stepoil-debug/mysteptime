# My Step Time — divergências por valor

Auditoria de 21/11/2026. Origem `lzahnaekoiervgqxmouv.public`, destino `knzszyxsspdjzgqkfrdt.mysteptime`.

## Comparação por chave primária

Cada chave primária foi representada como um array JSON ordenado pelas posições da PK. As colunas de cada linha foram ordenadas por nome e processadas em `md5(row_to_json(... )::text)`. Grupos idênticos foram conferidos pelo digest de chaves e hashes de linha. Grupos divergentes foram comparados por chave e hash de linha. Os totais calculados pelas chaves conferem com as contagens de cada tabela. A coleta usou consultas em lotes enquanto os ambientes estavam operacionais. Refazer com instantâneos consistentes na janela da virada.

Das 88 tabelas da origem, 61 coincidem por valor. Em 27 há diferenças de chaves ou conteúdo. Existe uma tabela adicional, vazia, no destino. No total há 336649 linhas idênticas, 1950 chaves com valores divergentes, 2385 linhas só na origem e 2949 só no destino, por chave primária e antes dos remapeamentos.

A coluna “Origem recente” conta chaves divergentes cujo `updated_at` da origem registra 20/11/2026 ou depois, em Brasília. Foram 11 linhas em `nominations` e 119 em `planejamento_embarque`. Esse critério identifica candidatas a alterações posteriores à cópia documentada em 19/11. Para atribuir os demais conflitos e detectar alterações nos dois lados é necessário um instantâneo por chave da cópia ou decisão explícita. “—” indica que esse recorte de timestamp não foi executado.

| Tabela | Origem | Destino | Iguais | Mesma PK, valores diferentes | Só origem | Só destino | Origem recente |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `activity_log` | 5001 | 4973 | 4973 | 0 | 28 | 0 | — |
| `app_email_settings` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `approval_requests` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `approvers` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `bm_dias_overrides` | — | 0 | 0 | 0 | 0 | 0 | — |
| `bm_lines_logistica` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `bm_lines_materiais` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `bm_lines_mo` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `bm_medicoes` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `bm_mob_desmob_costs` | 3385 | 3385 | 3385 | 0 | 0 | 0 | — |
| `bm_mob_desmob_markups` | 6 | 6 | 6 | 0 | 0 | 0 | — |
| `bm_status_history` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `bm_timesheet_dias` | 14817 | 14817 | 14817 | 0 | 0 | 0 | — |
| `bms` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `clients` | 5 | 5 | 5 | 0 | 0 | 0 | — |
| `colaborador_funcoes_historico` | 1012 | 1012 | 1012 | 0 | 0 | 0 | — |
| `collaborators` | 589 | 586 | 576 | 10 | 3 | 0 | 0 |
| `cost_logs` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `cost_simulations` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `documents` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `drake_enderecos` | 300 | 300 | 300 | 0 | 0 | 0 | — |
| `drake_logistica_embarques` | 446 | 446 | 446 | 0 | 0 | 0 | — |
| `drake_qualification_contexts` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `drake_qualification_options` | 1137 | 1137 | 1137 | 0 | 0 | 0 | — |
| `drake_qualification_requirements` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `drake_qualification_sync_state` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `drake_qualification_workers` | 629 | 629 | 629 | 0 | 0 | 0 | — |
| `drake_scheduler_slots` | 891 | 874 | 851 | 23 | 17 | 0 | — |
| `drake_sync_runs` | 213 | 212 | 212 | 0 | 1 | 0 | — |
| `drake_worker_qualifications` | 47640 | 47640 | 47640 | 0 | 0 | 0 | — |
| `embarkations` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `flow_track_demandas` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `flow_track_events` | 19261 | 18843 | 18718 | 96 | 447 | 29 | — |
| `flow_track_presence` | 34 | 35 | 7 | 27 | 0 | 1 | — |
| `flow_track_regra_responsaveis` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `flow_track_regras` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `form_drafts` | 12 | 12 | 12 | 0 | 0 | 0 | — |
| `hist_novo_colaboradores` | 2059 | 2054 | 2031 | 23 | 5 | 0 | — |
| `hist_novo_periodos` | 22137 | 22381 | 21476 | 17 | 644 | 888 | — |
| `hospedagens` | 565 | 565 | 554 | 11 | 0 | 0 | — |
| `hoteis_fornecedores` | 48 | 48 | 48 | 0 | 0 | 0 | — |
| `hotel_bookings` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `lgp_flow_activity_log` | 9788 | 10000 | 9749 | 0 | 39 | 251 | — |
| `materials` | 4 | 4 | 4 | 0 | 0 | 0 | — |
| `mo_editores` | 2 | 2 | 2 | 0 | 0 | 0 | — |
| `mo_funcao_depara` | 16 | 16 | 0 | 16 | 0 | 0 | 0 |
| `mo_planejamento` | 219 | 219 | 0 | 219 | 0 | 0 | 0 |
| `nomination_aptitude_alerts` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `nomination_fixed_teams` | 24 | 24 | 21 | 3 | 0 | 0 | 0 |
| `nomination_funcao_catalog` | 57 | 57 | 57 | 0 | 0 | 0 | — |
| `nomination_nominees` | 318 | 326 | 262 | 56 | 0 | 8 | — |
| `nomination_status_history` | 2236 | 2228 | 2225 | 0 | 11 | 3 | — |
| `nominations` | 307 | 310 | 163 | 144 | 0 | 3 | 11 |
| `notas_debito` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `notas_debito_anexos` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `notas_debito_itens` | 1 | 1 | 1 | 0 | 0 | 0 | — |
| `notifications` | 7095 | 7888 | 6441 | 654 | 0 | 793 | — |
| `passagem_opcoes` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `passagem_status_history` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `passagens_aereas` | 269 | 269 | 269 | 0 | 0 | 0 | — |
| `payroll_summaries` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `planejamento_colaboradores_vistos` | 357 | 357 | 357 | 0 | 0 | 0 | — |
| `planejamento_embarque` | 336 | 346 | 9 | 327 | 0 | 10 | 119 |
| `planejamento_embarque_log` | 7665 | 7293 | 7293 | 0 | 372 | 0 | — |
| `planejamento_embarque_snapshots` | 18111 | 18131 | 17439 | 0 | 672 | 692 | — |
| `profiles` | 44 | 43 | 39 | 2 | 3 | 2 | 0 |
| `projects` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `rates` | 202 | 202 | 202 | 0 | 0 | 0 | — |
| `rdo_entries` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `reembolso_anexos` | 7 | 7 | 7 | 0 | 0 | 0 | — |
| `reembolso_itens` | 17 | 17 | 17 | 0 | 0 | 0 | — |
| `reembolso_status_history` | 14 | 14 | 14 | 0 | 0 | 0 | — |
| `reembolsos` | 10 | 10 | 10 | 0 | 0 | 0 | — |
| `timesheet_dias` | 135056 | 135213 | 134961 | 20 | 75 | 232 | — |
| `timesheet_embarques` | 8109 | 8107 | 8003 | 99 | 7 | 5 | — |
| `timesheet_semanas` | 21773 | 21783 | 21761 | 0 | 12 | 22 | — |
| `timesheets` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `transport_columns` | 3 | 3 | 3 | 0 | 0 | 0 | — |
| `transport_requests` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `transport_solicitations` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `transport_tags` | 28 | 28 | 28 | 0 | 0 | 0 | — |
| `transport_trip_collaborators` | 3674 | 3651 | 3643 | 0 | 31 | 8 | — |
| `transport_trip_materials` | 64 | 64 | 64 | 0 | 0 | 0 | — |
| `transport_trip_tags` | 2487 | 2487 | 2487 | 0 | 0 | 0 | — |
| `transport_trips` | 2446 | 2431 | 2228 | 201 | 17 | 2 | 0 |
| `user_roles` | 44 | 43 | 41 | 2 | 1 | 0 | — |
| `vendors` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `weld_material_config` | 6 | 6 | 6 | 0 | 0 | 0 | — |
| `weld_type_config` | 3 | 3 | 3 | 0 | 0 | 0 | — |

## Drake e `hist_novo_periodos`

A auditoria de 19/11 registrou 569 UUIDs diferentes para a mesma `drake_event_key`. A leitura atual encontrou **560** pares, de 10.318 chaves distintas na origem e 10.562 no destino. O UUID e `created_at` são os únicos campos distintos nos 560 pares. Os valores dos demais campos coincidem.

| Referência aos pares | Origem | Destino |
| --- | ---: | ---: |
| `timesheet_embarques.periodo_id` | 37 registros e 37 UUIDs dos pares | 56 registros e 56 UUIDs dos pares |

A FK está presente nos dois ambientes. A busca por valores UUID exatos nas colunas de primeiro nível do schema de cada aplicação encontrou apenas essa referência fora da tabela de períodos. O recorte deixa de fora UUIDs incorporados em estruturas JSON aninhadas, documentos ou texto livre.

Proposta para aprovação: preservar o UUID do destino para cada chave Drake comum, preservar `created_at` do destino e traduzir a FK das linhas de origem durante a sincronização. A segunda opção é preservar o UUID do destino e adotar `created_at` da origem após simulação. Os 560 pares respondem por 560 linhas “só origem” e 560 “só destino” na comparação bruta da tabela. Feita a equivalência, restam 84 linhas só origem e 328 só destino quanto a PK e esses pares conhecidos. Há 17 chaves primárias comuns com diferença de valores, tratadas na comparação por conteúdo. A regra aprovada preserva UUID e `created_at` do destino. O ensaio e o plano atualizado estão abaixo.

## `timesheet_semanas.recebido_por`

No destino, 21.783 linhas: 21.534 nulas, 249 preenchidas, zero UUIDs inválidos e zero usuários inexistentes. A migration `20261121200000_timesheet_semanas_recebido_por_auth_fk.sql` converte para `uuid` e valida a FK para `auth.users(id)` com `ON DELETE SET NULL`, seguindo a definição de origem. O teste no destino confirmou tipo e FK dentro da transação e o retorno a `text` depois do ROLLBACK.

## Plano da sincronização pelas regras aprovadas

Em 21/11/2026, os hashes completos das 89 tabelas foram reconferidos e coincidiram com a coleta da tabela anterior. A projeção abaixo usa os dados reais, em leitura, e incorpora os remapeamentos de Auth e Drake, o `created_at` de destino dos períodos equivalentes e o remapeamento simulado dos 15 eventos de Douglas. Para a presença em colisão, o UUID atual retém o `last_seen` mais recente. Os snapshots usam a chave única `(snapshot_date, colaborador_nome)`, com os valores da origem e preservação do ID no destino. As linhas de perfil e papel de Matheus ainda aparecem como inserções porque a conta está pendente de criação definitiva. O plano será recalculado no ensaio transacional.

| Tabela | Iguais | Inserir | Atualizar pela origem | Manter mais recente | Só destino, preservar |
| --- | ---: | ---: | ---: | ---: | ---: |
| `activity_log` | 4973 | 28 | 0 | 0 | 0 |
| `app_email_settings` | 0 | 0 | 0 | 0 | 0 |
| `approval_requests` | 0 | 0 | 0 | 0 | 0 |
| `approvers` | 1 | 0 | 0 | 0 | 0 |
| `bm_dias_overrides` | 0 | 0 | 0 | 0 | 0 |
| `bm_lines_logistica` | 0 | 0 | 0 | 0 | 0 |
| `bm_lines_materiais` | 0 | 0 | 0 | 0 | 0 |
| `bm_lines_mo` | 1 | 0 | 0 | 0 | 0 |
| `bm_medicoes` | 0 | 0 | 0 | 0 | 0 |
| `bm_mob_desmob_costs` | 3385 | 0 | 0 | 0 | 0 |
| `bm_mob_desmob_markups` | 6 | 0 | 0 | 0 | 0 |
| `bm_status_history` | 0 | 0 | 0 | 0 | 0 |
| `bm_timesheet_dias` | 14817 | 0 | 0 | 0 | 0 |
| `bms` | 1 | 0 | 0 | 0 | 0 |
| `clients` | 5 | 0 | 0 | 0 | 0 |
| `colaborador_funcoes_historico` | 1012 | 0 | 0 | 0 | 0 |
| `collaborators` | 576 | 3 | 10 | 0 | 0 |
| `cost_logs` | 0 | 0 | 0 | 0 | 0 |
| `cost_simulations` | 0 | 0 | 0 | 0 | 0 |
| `documents` | 0 | 0 | 0 | 0 | 0 |
| `drake_enderecos` | 300 | 0 | 0 | 0 | 0 |
| `drake_logistica_embarques` | 446 | 0 | 0 | 0 | 0 |
| `drake_qualification_contexts` | 0 | 0 | 0 | 0 | 0 |
| `drake_qualification_options` | 1137 | 0 | 0 | 0 | 0 |
| `drake_qualification_requirements` | 0 | 0 | 0 | 0 | 0 |
| `drake_qualification_sync_state` | 1 | 0 | 0 | 0 | 0 |
| `drake_qualification_workers` | 629 | 0 | 0 | 0 | 0 |
| `drake_scheduler_slots` | 851 | 17 | 23 | 0 | 0 |
| `drake_sync_runs` | 212 | 1 | 0 | 0 | 0 |
| `drake_worker_qualifications` | 47640 | 0 | 0 | 0 | 0 |
| `embarkations` | 0 | 0 | 0 | 0 | 0 |
| `flow_track_demandas` | 0 | 0 | 0 | 0 | 0 |
| `flow_track_events` | 18814 | 447 | 0 | 0 | 29 |
| `flow_track_presence` | 7 | 0 | 26 | 1 | 1 |
| `flow_track_regra_responsaveis` | 0 | 0 | 0 | 0 | 0 |
| `flow_track_regras` | 0 | 0 | 0 | 0 | 0 |
| `form_drafts` | 12 | 0 | 0 | 0 | 0 |
| `hist_novo_colaboradores` | 2031 | 5 | 23 | 0 | 0 |
| `hist_novo_periodos` | 22036 | 84 | 17 | 0 | 328 |
| `hospedagens` | 554 | 0 | 11 | 0 | 0 |
| `hoteis_fornecedores` | 48 | 0 | 0 | 0 | 0 |
| `hotel_bookings` | 0 | 0 | 0 | 0 | 0 |
| `lgp_flow_activity_log` | 9749 | 39 | 0 | 0 | 251 |
| `materials` | 4 | 0 | 0 | 0 | 0 |
| `mo_editores` | 2 | 0 | 0 | 0 | 0 |
| `mo_funcao_depara` | 0 | 0 | 16 | 0 | 0 |
| `mo_planejamento` | 0 | 0 | 219 | 0 | 0 |
| `nomination_aptitude_alerts` | 0 | 0 | 0 | 0 | 0 |
| `nomination_fixed_teams` | 21 | 0 | 3 | 0 | 0 |
| `nomination_funcao_catalog` | 57 | 0 | 0 | 0 | 0 |
| `nomination_nominees` | 262 | 0 | 56 | 0 | 8 |
| `nomination_status_history` | 2225 | 11 | 0 | 0 | 3 |
| `nominations` | 163 | 0 | 144 | 0 | 3 |
| `notas_debito` | 1 | 0 | 0 | 0 | 0 |
| `notas_debito_anexos` | 0 | 0 | 0 | 0 | 0 |
| `notas_debito_itens` | 1 | 0 | 0 | 0 | 0 |
| `notifications` | 6998 | 0 | 97 | 0 | 793 |
| `passagem_opcoes` | 0 | 0 | 0 | 0 | 0 |
| `passagem_status_history` | 0 | 0 | 0 | 0 | 0 |
| `passagens_aereas` | 269 | 0 | 0 | 0 | 0 |
| `payroll_summaries` | 0 | 0 | 0 | 0 | 0 |
| `planejamento_colaboradores_vistos` | 357 | 0 | 0 | 0 | 0 |
| `planejamento_embarque` | 9 | 0 | 327 | 0 | 10 |
| `planejamento_embarque_log` | 7293 | 372 | 0 | 0 | 0 |
| `planejamento_embarque_snapshots` | 17439 | 0 | 672 | 0 | 20 |
| `profiles` | 41 | 1 | 2 | 0 | 0 |
| `projects` | 0 | 0 | 0 | 0 | 0 |
| `rates` | 202 | 0 | 0 | 0 | 0 |
| `rdo_entries` | 0 | 0 | 0 | 0 | 0 |
| `reembolso_anexos` | 7 | 0 | 0 | 0 | 0 |
| `reembolso_itens` | 17 | 0 | 0 | 0 | 0 |
| `reembolso_status_history` | 14 | 0 | 0 | 0 | 0 |
| `reembolsos` | 10 | 0 | 0 | 0 | 0 |
| `timesheet_dias` | 134961 | 75 | 20 | 0 | 232 |
| `timesheet_embarques` | 8035 | 7 | 67 | 0 | 5 |
| `timesheet_semanas` | 21761 | 12 | 0 | 0 | 22 |
| `timesheets` | 0 | 0 | 0 | 0 | 0 |
| `transport_columns` | 3 | 0 | 0 | 0 | 0 |
| `transport_requests` | 0 | 0 | 0 | 0 | 0 |
| `transport_solicitations` | 0 | 0 | 0 | 0 | 0 |
| `transport_tags` | 28 | 0 | 0 | 0 | 0 |
| `transport_trip_collaborators` | 3643 | 31 | 0 | 0 | 8 |
| `transport_trip_materials` | 64 | 0 | 0 | 0 | 0 |
| `transport_trip_tags` | 2487 | 0 | 0 | 0 | 0 |
| `transport_trips` | 2228 | 17 | 201 | 0 | 2 |
| `user_roles` | 43 | 1 | 0 | 0 | 0 |
| `vendors` | 0 | 0 | 0 | 0 | 0 |
| `weld_material_config` | 6 | 0 | 0 | 0 | 0 |
| `weld_type_config` | 3 | 0 | 0 | 0 | 0 |
| **Total** | **337898** | **1151** | **1934** | **1** | **1715** |

## Simulações em ROLLBACK

- **Matheus.** A migration `20261121203000_disable_legacy_auth_user_provisioning.sql` agora usa `CREATE OR REPLACE FUNCTION public.handle_new_user()` com retorno `NEW` e sem gravações. Ela verifica antes que apenas o gatilho legado de `auth.users` referencia a função. O ensaio com a própria migration criou Matheus com UUID original, identidade, perfil e papel PM. As verificações antes e depois do ROLLBACK confirmaram zero registros legados em `public`. Depois do ROLLBACK, a conta não existia e a função original havia sido restaurada.
- **Douglas.** A PK de eventos é `id`. Os 15 remapeamentos passaram sem colisão. A PK da presença é `user_id`, com uma colisão. A linha do UUID atual tem `last_seen` de 20/11/2026 às 21:54:12.950 UTC, mais recente que a linha do UUID antigo, de 19/11/2026 às 16:54:13.998 UTC. O UUID atual reteve a versão mais recente. A versão anterior ficou registrada sob o UUID antigo. O ROLLBACK restaurou os 15 eventos e as duas linhas de presença.
- **Snapshots.** O upsert por `(snapshot_date, colaborador_nome)` foi ensaiado na tabela real com ROLLBACK. As 672 chaves divergentes receberam o conteúdo da origem, preservando os IDs que já existiam no destino. As 17.439 chaves iguais e 20 exclusivas permaneceram fora do upsert. O digest do destino após o ROLLBACK coincidiu com o anterior e a tabela ficou com 18.131 linhas.
- **Drake.** Uma amostra transacional construída a partir dos 560 pares conferidos verificou a tradução de FK e a preservação do UUID e do `created_at` do destino. A projeção de leitura também executou a regra de normalização sobre as linhas reais da origem. O ROLLBACK removeu a amostra.
- **Ensaios do script.** O código passou na checagem de sintaxe e em oito cenários de classificação. A tentativa de rodar `sync-final.mjs` integralmente parou na configuração, antes de abrir transação, porque `LOVABLE_DB_URL` estava indisponível no ambiente de execução. O terminal Windows retornou `spawn EPERM` até para `node --version`. A consulta Lovable usada nesta auditoria dá acesso de leitura separado e não fornece a conexão PostgreSQL usada pelo script. Assim, os totais acima são uma projeção por tabela e a execução de todos os upserts com rollback permanece pendente. Antes do ensaio integral, também é preciso resolver as precondições de Matheus e dos vínculos de Douglas em uma transação autorizada.

Nenhum dado persistente mudou. O conteúdo das linhas e os valores de credenciais ficaram fora das saídas e dos arquivos.
