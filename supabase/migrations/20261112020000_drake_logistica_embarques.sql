-- Embarques confirmados pela PROGRAMAÇÃO LOGÍSTICA do Drake (endpoint BI/LogisticScheduling —
-- pedido dela, 2026-11-12). A Ficha Anual do Drake (hist_novo_periodos) fica atrasada: em
-- 12/11/2026 ela mostrava 40 embarcados, a programação logística 80 e o Planejamento 82.
--
-- ADITIVO e SEPARADO de hist_novo_periodos de propósito: nada que lê a Ficha Anual (Histograma,
-- Timesheet, BM, Nomeações, importação da Ficha) enxerga esta tabela. Por enquanto só o
-- Dashboard a usa, para corrigir "Mão de Obra por Semana" e "POB por Mês".
--
-- Preenchida pela sincronização do Drake (etapa extra depois da Ficha Anual; se falhar, a
-- sincronização continua normal). Cada execução troca as linhas de quem foi consultado.
create table if not exists public.drake_logistica_embarques (
  id               uuid primary key default gen_random_uuid(),
  colaborador_id   uuid not null references public.hist_novo_colaboradores(id) on delete cascade,
  data_inicio      date not null,
  data_fim         date not null,
  unidade          text,
  execucao_id      uuid not null,
  sincronizado_em  timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index if not exists drake_logistica_embarques_colab_idx
  on public.drake_logistica_embarques (colaborador_id);
create index if not exists drake_logistica_embarques_datas_idx
  on public.drake_logistica_embarques (data_inicio, data_fim);

alter table public.drake_logistica_embarques enable row level security;

-- Leitura: exatamente quem já pode ler os períodos do Drake daquele colaborador (a subconsulta
-- roda com o RLS de hist_novo_periodos de quem consulta) — não amplia acesso de ninguém.
drop policy if exists "drake_logistica_embarques_select" on public.drake_logistica_embarques;
create policy "drake_logistica_embarques_select" on public.drake_logistica_embarques
  for select to authenticated
  using (
    public.is_operator(auth.uid())
    or exists (
      select 1 from public.hist_novo_periodos p
      where p.colaborador_id = drake_logistica_embarques.colaborador_id
    )
  );

-- Escrita: só operadores (a conta de automação da sincronização), igual a hist_novo_periodos.
drop policy if exists "drake_logistica_embarques_operadores" on public.drake_logistica_embarques;
create policy "drake_logistica_embarques_operadores" on public.drake_logistica_embarques
  for all to authenticated
  using (public.is_operator(auth.uid()))
  with check (public.is_operator(auth.uid()));
