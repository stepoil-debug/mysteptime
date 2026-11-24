-- M.O: ajuste manual do planejado por função/dia (botão "Editar" do Detalhamento – Planejado).
-- Quando existe ajuste para (dia, função), ele substitui a soma calculada da aba M.O em todos os
-- lugares que usam mo_planejado_drake_diario (Acompanhamento Diário/Semanal e gráficos do Dashboard).
-- Rollback: drop function + recriar a versão anterior (em git: 20261112000000_mo_depara_editores.sql)
--           e drop table mysteptime.mo_planejado_ajuste.
create table if not exists mysteptime.mo_planejado_ajuste (
  dia date not null,
  funcao text not null,
  qtd integer not null check (qtd >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (dia, funcao)
);
alter table mysteptime.mo_planejado_ajuste enable row level security;
drop policy if exists mo_ajuste_select on mysteptime.mo_planejado_ajuste;
create policy mo_ajuste_select on mysteptime.mo_planejado_ajuste for select to authenticated using (true);
drop policy if exists mo_ajuste_write on mysteptime.mo_planejado_ajuste;
create policy mo_ajuste_write on mysteptime.mo_planejado_ajuste for all to authenticated
  using ((select mysteptime.is_mo_editor((select auth.uid()))))
  with check ((select mysteptime.is_mo_editor((select auth.uid()))));
grant select, insert, update, delete on mysteptime.mo_planejado_ajuste to authenticated;

create or replace function mysteptime.mo_planejado_drake_diario(p_inicio date, p_fim date)
returns table(dia date, funcao text, sem_correspondencia boolean, planejado bigint)
language sql stable security definer
set search_path to 'mysteptime', 'public', 'extensions'
as $function$
  with calc as (
    select d::date as dia,
           coalesce(dp.funcao_drake, m.funcao) as funcao,
           dp.id is null as sem,
           sum(m.qtd) as qtd
    from mysteptime.mo_planejamento m
    left join mysteptime.mo_funcao_depara dp on mysteptime.mo_norm(dp.funcao_padrao) = mysteptime.mo_norm(m.funcao)
    cross join lateral generate_series(
      greatest(m.data_embarque, p_inicio), least(m.data_desembarque, p_fim), interval '1 day'
    ) d
    where m.qtd > 0 and mysteptime.mo_norm(m.bsp) <> 'ON HOLD'
    group by 1, 2, 3
  ), aj as (
    select a.dia, a.funcao, a.qtd from mysteptime.mo_planejado_ajuste a
    where a.dia between p_inicio and p_fim
  )
  select coalesce(c.dia, a.dia),
         coalesce(c.funcao, a.funcao),
         coalesce(c.sem, not exists (select 1 from mysteptime.mo_funcao_depara x
                                     where mysteptime.mo_norm(x.funcao_drake) = mysteptime.mo_norm(a.funcao))),
         coalesce(a.qtd, c.qtd)::bigint
  from calc c
  full join aj a on a.dia = c.dia and mysteptime.mo_norm(a.funcao) = mysteptime.mo_norm(c.funcao)
  where auth.uid() is not null and p_fim - p_inicio <= 800
    and coalesce(a.qtd, c.qtd) > 0
  order by 1, 2
$function$;
