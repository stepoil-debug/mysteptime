-- M.O: ajuste manual do DISPONÍVEL por função (coluna "M.O Disponível" do Detalhamento – Planejado).
-- Um ajuste (funcao, a_partir, qtd) substitui o disponível calculado da função do dia a_partir em
-- diante (até o próximo ajuste). Sem ajuste, vale a regra automática do card "M.O disponível x Dia".
-- Rollback: drop table mysteptime.mo_disponivel_ajuste;
create table if not exists mysteptime.mo_disponivel_ajuste (
  funcao text not null,
  a_partir date not null,
  qtd integer not null check (qtd >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (funcao, a_partir)
);
alter table mysteptime.mo_disponivel_ajuste enable row level security;
drop policy if exists mo_disp_ajuste_select on mysteptime.mo_disponivel_ajuste;
create policy mo_disp_ajuste_select on mysteptime.mo_disponivel_ajuste for select to authenticated using (true);
drop policy if exists mo_disp_ajuste_write on mysteptime.mo_disponivel_ajuste;
create policy mo_disp_ajuste_write on mysteptime.mo_disponivel_ajuste for all to authenticated
  using ((select mysteptime.is_mo_editor((select auth.uid()))))
  with check ((select mysteptime.is_mo_editor((select auth.uid()))));
grant select, insert, update, delete on mysteptime.mo_disponivel_ajuste to authenticated;
