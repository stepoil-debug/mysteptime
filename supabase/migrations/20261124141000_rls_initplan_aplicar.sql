-- A 20261124140000 rodou com search_path=mysteptime: o texto das policies veio sem o prefixo
-- "mysteptime." e a troca não casou (nada mudou). Aqui fixa o search_path para o prefixo aparecer.
set local search_path = public, extensions;
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
set local search_path = mysteptime, public, extensions;
