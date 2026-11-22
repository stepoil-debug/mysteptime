# Migração MyStepTime — execução e pendências (19/11/2026)

## Identificação e segurança

- Origem: Lovable My Step Time (projeto `e3ef1542-ee0e-4fca-996f-6b3a20bf536b`, banco `lzahnaekoiervgqxmouv`, schema `public`).
- Destino: Supabase `knzszyxsspdjzgqkfrdt`, schema `mysteptime`; Vercel `douglas-6d4f/mysteptime`.
- Carga realizada por conexões autorizadas de origem e destino, sem exportar valores de secrets para arquivos.
- **Origem Lovable preservada; NÃO realizar exclusão nem cutover de produção antes de validação integral.**
- Fonte continua recebendo gravações, portanto os totais são uma fotografia transitória.

## O que foi executado

1. Comparação de estrutura: 88 tabelas na origem, 89 no destino. Todas as 999 colunas da origem existem no destino. A tabela extra no destino é `bm_dias_overrides` (10 colunas).
2. Primeira transação: teste com ROLLBACK, depois importação de 1.004 registros de `hist_novo_colaboradores` (21), `mo_planejamento` (219), `mo_editores` (2), `mo_funcao_depara` (16), `drake_logistica_embarques` (446), `drake_enderecos` (300); contagens validadas após COMMIT.
3. Complementação incremental de colaboradores, fornecedores/hotéis, hospedagens, passagens, viagens, materiais e vínculos de viagens, indicações, equipes fixas, eventos, notificações, timesheets, planejamento de embarques, snapshots, atividades e rotinas do Drake.
4. Novos registros inseridos com a chave original e políticas de conflito preservando dados existentes. Alguns registros do destino não existem na origem e **não foram apagados**.
5. Para notificações de um usuário com UUID migrado, o vínculo foi remapeado pelo e-mail já existente no destino, sem criar identidade duplicada.
6. Verificados por digest de IDs os 87 conjuntos de chaves primárias (exceto `timesheet_dias`): 73 iguais entre os ambientes; nas demais tabelas, em sua maioria há registros extras no destino.
7. `timesheet_dias` foi inspecionada por 4.096 grupos de hash de ID; **todos os IDs de origem estavam no destino**, com 161 IDs adicionais no destino no momento do exame.
8. `hist_novo_periodos`: 569 IDs da origem não foram inseridos porque os **569 valores de `drake_event_key` já existem no destino sob UUID diferente**. Não criar duplicidade lógica nem reescrever as referências sem reconciliar.
9. Vercel: criadas e verificadas variáveis sensíveis de Drake (`DRAKE_USERNAME`, `DRAKE_PASSWORD`, `DRAKE_BASE_URL`) e automação (`MYSTEPTIME_AUTOMATION_EMAIL`, `MYSTEPTIME_AUTOMATION_PASSWORD`) para production/preview, sem revelar valores.
10. Variáveis SMTP antigas do ambiente local foram identificadas como Microsoft. Como o requisito é envio apenas via Google, as cinco variáveis SMTP recém-criadas na Vercel foram **esvaziadas/desabilitadas**. Nenhum envio deve depender delas.
11. A produção da Vercel tinha deploy `READY` da `main` no commit `3b1f117154bd73fed1e9a936c18402f169f862ab`. Novas variáveis não entram num deploy já concluído; **não foi feito redeploy** por faltar configuração/testes.

## Bloqueios e diferenças restantes

- **Identidade:** 44 usuários na origem e 43 no Supabase novo; uma conta original não tem correspondente por e-mail no destino. Duas contas originais possuem UUID diferente para o mesmo e-mail no destino. Precisam de revisão de permissão e SSO antes da virada. `profiles` e `user_roles` têm um registro a menos no destino.
- **Schema:** `timesheet_semanas.recebido_por` é `uuid` e FK para `auth.users` na origem, mas `text` sem essa FK no destino. Corrigir somente após teste de compatibilidade dos usuários migrados.
- **Storage privado:** `nomeacoes-anexos` tem 16 arquivos na origem e 12 no destino. É necessário comparar nomes/checksums e transferir os quatro arquivos ainda ausentes; os buckets são privados. `bm-mob-desmob-notas` e `reembolsos-anexos` tinham contagens iguais.
- **Secrets:** 14 nomes inventariados na origem Lovable; valores criptografados indisponíveis para exportação. Funções novas exigem, entre outros, `ANTHROPIC_API_KEY`, `SMARTSHEET_TOKEN`, `SMARTSHEET_ID_1/2`, `CRON_SECRET` e credenciais de e-mail. Não foram configurados os secrets hospedados na Supabase Edge Functions por ausência de interface de escrita e/ou credenciais corretas.
- **Email:** não reativar o SMTP Microsoft; definir credenciais próprias para envio Google, testar. As Edge Functions antigas também usam Resend; reconciliar com a decisão Google-only.
- **IA:** a função de extração original usa o gateway de IA do Lovable; no destino depende de chave Anthropic própria. Não reutilizar `LOVABLE_API_KEY` como `ANTHROPIC_API_KEY`.
- **Cron:** `supabase/cutover/cron.sql` ainda não foi aplicado. Manter desabilitado para evitar agendamentos duplicados.
- **SSO:** não ativar a virada definitiva até testar o acesso pela Intranet, papéis e contas com IDs remapeados.
- **Dados:** a origem continuou recebendo gravações durante a cópia; diferenças de conteúdo (UPDATE em registros existentes) ainda não foram reconciliadas. Correspondência de quantidades e IDs não garante valores idênticos.

## Para finalizar com segurança

1. Congelar gravações na origem numa janela de cutover aprovada.
2. Refazer validação de valores por chave (não apenas contagens), resolver o caso de identidade e as 569 chaves lógicas duplicadas.
3. Transferir anexos privados faltantes com autorização de acesso aos bytes da origem.
4. Provisionar secrets no novo Supabase, obter chave Anthropic e autenticação de e-mail Google; testar Edge Functions e notificações sem efeitos externos de produção.
5. Executar testes de integração, login, SSO, permissões, RLS, storage, Smartsheet, Drake, IA, e-mail e processos agendados.
6. Aplicar cron apenas na virada, refazer deploy da Vercel após conclusão das env vars, e validar monitoramento com plano de rollback.
7. Manter Lovable disponível até homologação concluída e aprovação da virada.

Referências de trabalho: `docs/MIGRACAO_INTRANET.md`, `docs/EDGE_FUNCTION_SECRETS_AUDIT.md`, `docs/MIGRACAO_AUDITORIA_ORIGEM_DESTINO_2026-11-19.md`.
