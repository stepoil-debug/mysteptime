-- Caixa de entrada TEMPORÁRIA da migração Lovable -> Intranet (apagar ao fim: drop schema mysteptime_import cascade + drop function).
create schema if not exists mysteptime_import;
revoke all on schema mysteptime_import from public, anon, authenticated;
create table if not exists mysteptime_import.tokens (token text primary key, expires_at timestamptz not null);
create table if not exists mysteptime_import.inbox (
  tbl text not null, page int not null, rows jsonb not null, received_at timestamptz not null default now(),
  primary key (tbl, page));
create table if not exists mysteptime_import.files (
  bucket text not null, path text not null, content_type text, b64 text not null, received_at timestamptz default now(),
  primary key (bucket, path));
create or replace function mysteptime._import_page(p_token text, p_table text, p_page int, p_rows jsonb)
returns int language plpgsql security definer set search_path = mysteptime_import, pg_catalog as $$
begin
  if not exists (select 1 from mysteptime_import.tokens where token = p_token and expires_at > now()) then
    raise exception 'token inválido' using errcode = '42501';
  end if;
  if p_table !~ '^[a-z0-9_]+$' or jsonb_typeof(p_rows) <> 'array' then raise exception 'payload inválido'; end if;
  insert into mysteptime_import.inbox(tbl, page, rows) values (p_table, p_page, p_rows)
  on conflict (tbl, page) do update set rows = excluded.rows, received_at = now();
  return jsonb_array_length(p_rows);
end $$;
create or replace function mysteptime._import_file(p_token text, p_bucket text, p_path text, p_content_type text, p_b64 text)
returns int language plpgsql security definer set search_path = mysteptime_import, pg_catalog as $$
begin
  if not exists (select 1 from mysteptime_import.tokens where token = p_token and expires_at > now()) then
    raise exception 'token inválido' using errcode = '42501';
  end if;
  insert into mysteptime_import.files(bucket, path, content_type, b64) values (p_bucket, p_path, p_content_type, p_b64)
  on conflict (bucket, path) do update set b64 = excluded.b64, content_type = excluded.content_type, received_at = now();
  return length(p_b64);
end $$;
revoke all on function mysteptime._import_page(text,text,int,jsonb) from public;
revoke all on function mysteptime._import_file(text,text,text,text,text) from public;
grant execute on function mysteptime._import_page(text,text,int,jsonb) to anon, authenticated;
grant execute on function mysteptime._import_file(text,text,text,text,text) to anon, authenticated;
-- token: gerar na hora (insert into mysteptime_import.tokens values (encode(extensions.gen_random_bytes(24),'hex'), now() + interval '6 hours'));
notify pgrst, 'reload schema';
