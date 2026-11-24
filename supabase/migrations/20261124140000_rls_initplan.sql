-- Performance: as policies chamavam has_role/is_operator(auth.uid()) LINHA A LINHA
-- (ex.: hist_novo_periodos 22 mil linhas x 9 checagens = 2,7 s). Envolver em (select ...)
-- faz o Postgres calcular uma vez por consulta (InitPlan). Mesma regra de acesso, só mais rápido.
-- Rollback: reverter cada policy trocando "(select mysteptime.f(auth.uid() ...))" por "mysteptime.f(auth.uid() ...)"
-- (definições antigas guardadas em mysteptime.rls_policy_backup_20261124).
create table if not exists mysteptime.rls_policy_backup_20261124 as
  select schemaname, tablename, policyname, cmd, qual, with_check, now() as saved_at
  from pg_policies where schemaname = 'mysteptime';
alter table mysteptime.rls_policy_backup_20261124 enable row level security;
revoke all on mysteptime.rls_policy_backup_20261124 from anon, authenticated;

do $$
declare
  r record;
  q text;
  w text;
  fx text := '(mysteptime\.[a-z_]+)\(auth\.uid\(\)((, *''[a-z_]+''::mysteptime\.app_role)?)\)';
begin
  for r in select * from pg_policies where schemaname = 'mysteptime' loop
    q := r.qual; w := r.with_check;
    if q is not null and q !~ '\(\s*select\s+mysteptime\.' then
      q := regexp_replace(q, fx, '(select \1(auth.uid()\2))', 'g');
    end if;
    if w is not null and w !~ '\(\s*select\s+mysteptime\.' then
      w := regexp_replace(w, fx, '(select \1(auth.uid()\2))', 'g');
    end if;
    if q is distinct from r.qual then
      execute format('alter policy %I on mysteptime.%I using (%s)', r.policyname, r.tablename, q);
    end if;
    if w is distinct from r.with_check then
      execute format('alter policy %I on mysteptime.%I with check (%s)', r.policyname, r.tablename, w);
    end if;
  end loop;
end $$;
