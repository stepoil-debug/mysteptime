# Checklist de virada do My Step Time

Origem: Lovable, projeto `e3ef1542-ee0e-4fca-996f-6b3a20bf536b`, banco `lzahnaekoiervgqxmouv`, schema `public`. Destino: Supabase `knzszyxsspdjzgqkfrdt`, schema `mysteptime`, e Vercel `douglas-6d4f/mysteptime`. Horários da janela em Brasília.

## Antes da janela

- Obter aprovação de B4, D1, das divergências de conteúdo e da janela. Confirmar acesso operacional aos dois bancos e à Vercel. Manter o commit atual de produção e o caminho do card da Intranet identificados.
- Confirmar acesso logado aos quatro PDFs com ETags compostos e, na homologação, validar novamente o conteúdo entregue. A auditoria já confirmou a equivalência dos ETags de uma parte. Anotar contagens e tamanhos dos buckets operacionais. Deixar o bucket de backup na origem, salvo decisão explícita de migrá-lo.
- Antes da sincronização, resolver B4 no destino em transações aprovadas. Usar a migration que neutraliza `public.handle_new_user()` antes de provisionar Matheus como PM com o UUID da origem. Remapear os 15 eventos de Douglas e preservar sua presença mais recente. O script traduz as referências de origem para os UUIDs atuais de Douglas e Thales. Validar a FK de `timesheet_semanas.recebido_por` separadamente.
- Preparar a configuração de Auth para a virada. Usar `https://intranet.step-og.com/mysteptime` como Site URL de produção e desligar o cadastro direto no Supabase Auth. Confirmar os redirecionamentos exigidos pelo SSO e validar entrada pela Intranet. Aplicar somente na janela autorizada.
- Preparar as credenciais pelos canais protegidos de cada plataforma. A validação do fluxo HTTP de e-mail deve confirmar o remetente `noreply@step-og.com` e o serviço efetivamente chamado por `M365_FLOW_URL`.
- Manter o job de snapshot do destino desligado até a virada. `mysteptime-daily-planejamento-embarque-snapshot` está ativo na checagem de 21/11/2026, às 09:00 UTC (06:00 em Brasília). Preparar o desagendamento com `supabase/cutover/pause-destination-snapshot.sql`, exclusivamente no Supabase de destino. O arquivo usa `cron.unschedule` por nome e termina em `ROLLBACK` para conferência. Após autorização operacional de aplicação, o job deve ficar desagendado até a virada. `supabase/cutover/cron.sql` recria o job diariamente às 09:00 UTC. A janela da virada deve ficar inteiramente fora de 09:00 UTC. Conferir os endpoints da Vercel e a responsabilidade de cada ambiente antes de habilitar jobs.

## Sequência da janela

1. **Congelar gravações no Lovable.** Avisar usuários e responsáveis pelos conectores sobre início, fim e canais de suporte. Na janela aprovada, usar modo de manutenção somente leitura com bloqueio reversível de mutações, ou combinar a suspensão operacional e verificar que nenhum usuário, webhook ou job continua gravando. Confirmar com duas leituras consecutivas sem alterações. Manter a origem disponível para consulta. Se uma rotina continuar escrevendo, interromper a virada e obter aprovação para o bloqueio reversível dessa rotina.
2. **Gerar e baixar o export.** No Lovable, usar `Database → Manage → Settings → Export project data` com as gravações congeladas. Salvar o arquivo fora do repositório, em pasta de acesso restrito. O export completo documentado é PostgreSQL custom comprimido (`.backup`).
3. **Carregar `lovable_export`.** No Windows, ter PostgreSQL 16 ou mais recente com `pg_restore` no PATH e a dependência `pg` disponível localmente. Se ela estiver ausente, rodar `npm install --no-save --package-lock=false pg` na raiz do repositório. Usar somente `MYSTEPTIME_DB_URL` para o projeto de destino. Rodar `node --env-file=.env.local scripts/migracao-intranet/load-export.mjs "<caminho-absoluto>" --format-only` para detectar o arquivo. Repetir sem `--format-only` para ensaiar em ROLLBACK. Conferir as contagens por tabela. Após aprovação, repetir com `--commit <digest-da-carga>` para materializar apenas o staging. O carregador exige as tabelas completas e, para a opção CSV, uma pasta com um CSV por tabela e `auth.users.csv` com as colunas `id` e `email`. Nenhum hash de senha é carregado. Se houver staging de outro export, aguardar a aprovação da limpeza antes de recarregar.
4. **Executar `sync-final.mjs` com ROLLBACK.** Rodar `node --env-file=.env.local scripts/migracao-intranet/sync-final.mjs`. O script consulta `lovable_export` e sincroniza `mysteptime` na mesma conexão. Conferir as inserções, atualizações e linhas mantidas por tabela. A origem prevalece nas divergências. Preservar linhas exclusivas do destino, UUID e `created_at` dos períodos Drake equivalentes, o ID de snapshots por `(snapshot_date, colaborador_nome)` e a presença de Douglas mais recente.
5. **Executar `sync-final.mjs` com COMMIT.** Após aprovação do ensaio, usar o mesmo staging e repetir com `--id-map <digest-do-mapa> --commit <digest-do-ensaio>`. Aguardar confirmação da transação.
6. **Conferir por valor.** Reexecutar o relatório com ROLLBACK e verificar zero inserções ou atualizações a fazer, além das exceções aprovadas. Conferir as linhas exclusivas do destino, remapeamentos, anexos e contagens por tabela.
7. **Limpar o staging após aprovação específica.** Usar `supabase/cutover/cleanup-lovable-export.sql`, que remove só o schema `lovable_export` e termina em ROLLBACK no ensaio. Somente após aprovar a limpeza, usar COMMIT na última linha. Preservar o arquivo exportado conforme a retenção acordada.
8. **Publicar Edge Functions no destino.** Conferir `verify_jwt`, dependências, schema e escopo de permissões de cada função. Confirmar que as rotas da aplicação que serão chamadas pelo cron estarão disponíveis na Vercel.
9. **Configurar os secrets no destino.** Conferir `CRON_SECRET`, `M365_FLOW_URL` e variáveis `SMARTSHEET_*` com os nomes efetivamente usados. Validar por integração sem mostrar valores. Conferir também a configuração de Vault usada pelo SQL do cron e a autenticação das rotas Drake e Flow Track.
10. **Aplicar `supabase/cutover/cron.sql` na janela aprovada.** Inspecionar o SQL e validar em transação antes da aplicação. Agendar a primeira execução para depois de o deploy e seus endpoints estarem acessíveis. Se a janela cruzar uma execução, manter a aplicação do cron pendente e pedir decisão sobre a sequência. Confirmar que apenas um ambiente é responsável por cada rotina.
11. **Fazer merge na `main`.** Conferir o resultado dos checks de CI e registrar o SHA aprovado.
12. **Acompanhar o deploy da Vercel.** Conferir status Ready, ambiente de produção, variáveis e rotas de `/mysteptime`.
13. **Apontar o card `offshore:mysteptime` da Intranet ao destino.** Confirmar o rewrite de `/mysteptime`, a política de acesso ao card e a rota de retorno à Intranet.
14. **Executar testes logados** com usuários autorizados. Liberar a operação quando os responsáveis aprovarem os resultados.

## Testes de aceitação

| Área | Evidência esperada |
| --- | --- |
| SSO pela Intranet | Card abre o My Step Time, ticket é consumido uma vez, sessão termina ou expira corretamente e retorno ao portal funciona. Testar as três contas de B4. |
| Papéis e RLS | Administrador, PM, operador e usuário sem acesso veem as operações esperadas. Testar leitura e gravação permitidas e negadas, inclusive acesso direto à API. |
| Anexos privados | Anexo histórico e upload de homologação funcionam com perfil permitido. Perfil não autorizado não consegue baixar nem enumerar arquivos. Confirmar caminho, bytes e tipo. |
| Smartsheet | Executar leitura com a conta autorizada e validar as planilhas de BM e ordens de trabalho contra o inventário. |
| IA de nota fiscal | Processar uma nota de homologação e verificar número reconhecido e resposta de erro para arquivo inválido. |
| E-mail | Entrega controlada pelo fluxo `M365_FLOW_URL`, com `noreply@step-og.com`, destinatário de teste e um único envio. Validar também as rotinas que usam outro caminho. |
| Drake | Testar autenticação, uma leitura de planejamento e vínculos período/embarque. Conferir a idempotência por `drake_event_key`. |
| Crons | Validar jobs, horários UTC/Brasília e resultado recente de cada função e rota. Conferir ausência de efeitos duplicados entre os ambientes. |

## Rollback operacional

1. Reapontar o card da Intranet para [My Step Time no Lovable](https://mysteptime.lovable.app) e validar acesso com um administrador e um PM.
2. Suspender os jobs de destino da virada de modo reversível e restaurar o acesso de escrita e o agendamento original do Lovable se tiverem sido pausados na janela.
3. Registrar as gravações que ocorreram no destino desde o corte. Conciliar esse delta com aprovação antes de uma nova virada. Preservar os bancos e os arquivos dos dois ambientes.
