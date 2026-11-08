// Converte as migrations do mysteptime (Lovable, schema public) para o schema `mysteptime`
// no Supabase da Intranet. Uso: node build-schema.mjs <dir-migrations> <saida.sql>
// Gera <saida>_types.sql (fase 1: schema + enums, precisa de commit próprio) e <saida>.sql (fase 2).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { splitSql } from "./split.mjs";

const [dir, out] = process.argv.slice(2);
const INTRANET_FN = "https://qxmxtbjxkhecqilpnhgq.supabase.co/functions/v1/mysteptime-";

export function transform(sql) {
  let s = sql;
  // 1) trigger em auth.users não vem: acesso é concedido pelo admin da Intranet
  s = s.replace(/CREATE TRIGGER\s+on_auth_user_created[\s\S]*?ON auth\.users[\s\S]*?;/gi,
    "-- [mysteptime@intranet] trigger on_auth_user_created removido (acesso via admin da Intranet)\n");
  // 2) search_path das funções
  s = s.replace(/search_path\s*(=|TO)\s*'?public'?(?:\s*,\s*'?[a-z_]+'?)*/gi, "search_path = mysteptime, public, extensions");
  // 3) public.X -> mysteptime.X
  s = s.replace(/\bpublic\./gi, "mysteptime.");
  // 4) Edge Functions e jobs de cron do Lovable -> Intranet
  s = s.replace(/https:\/\/lzahnaekoiervgqxmouv\.functions\.supabase\.co\//g, INTRANET_FN);
  s = s.replace(/https:\/\/lzahnaekoiervgqxmouv\.supabase\.co\/functions\/v1\//g, INTRANET_FN);
  s = s.replace(/cron\.(schedule|unschedule)\(\s*'([^']+)'/g, (_m, fn, name) =>
    `cron.${fn}('${name.startsWith("mysteptime-") ? name : "mysteptime-" + name}'`);
  return s;
}

const PRELUDE = `
create schema if not exists mysteptime;
grant usage on schema mysteptime to anon, authenticated, service_role;
alter default privileges in schema mysteptime grant all on tables to anon, authenticated, service_role;
alter default privileges in schema mysteptime grant all on functions to anon, authenticated, service_role;
alter default privileges in schema mysteptime grant all on sequences to anon, authenticated, service_role;
set search_path = mysteptime, public, extensions;
`;

const stripComments = (st) => st.replace(/^(\s*--[^\n]*\n)*/g, "").trim();
const isDml = (st) => /^(with\s[\s\S]*?\)\s*)?(insert\s+into|update|delete\s+from)\s+mysteptime\./i.test(stripComments(st));
const isType = (st) => /^(create\s+type|alter\s+type\s+[\w.]+\s+add\s+value|do\s+\$\$\s*begin\s+create\s+type\s+[\w.]+\s+as\s+enum[^;]*;\s*exception\s+when\s+duplicate_object\s+then\s+null;\s*end\s+\$\$$)/i.test(stripComments(st));

if (dir && out) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const parts = [PRELUDE];
  const typeStmts = [];
  const dml = [];
  const cron = [];
  for (const f of files) {
    const stmts = splitSql(transform(readFileSync(path.join(dir, f), "utf8")));
    for (const st of stmts) if (isType(st)) typeStmts.push(stripComments(st));
    const keep = stmts.filter((st) => !isType(st)).filter((st) => {
      if (isDml(st)) { dml.push(`${f}: ${stripComments(st).slice(0, 70).replace(/\s+/g, " ")}`); return false; }
      // nunca mexer em auth.users da Intranet (ex.: seed de usuário com senha fixa)
      if (/(insert\s+into|update)\s+auth\.(users|identities)/i.test(st)) { dml.push(`${f}: [AUTH BLOQUEADO]`); return false; }
      // cron só depois que as Edge Functions mysteptime-* existirem na Intranet
      if (/cron\.(schedule|unschedule)\(/i.test(st)) { cron.push(`-- ${f}\n${stripComments(st)};`); return false; }
      return true;
    });
    parts.push(`\n-- >>> FILE ${f}\n` + keep.map((st) => st + ";").join("\n"));
  }
  const typesSql = PRELUDE + "\n-- >>> FILE 00_types\n" + typeStmts.map((st) =>
    /^create\s+type/i.test(st)
      ? `DO $t$ BEGIN ${st}; EXCEPTION WHEN duplicate_object THEN NULL; END $t$;`
      : st.replace(/add\s+value\s+(?!if\s)/i, "ADD VALUE IF NOT EXISTS ") + ";",
  ).join("\n");
  writeFileSync(out.replace(/\.sql$/, "_types.sql"), typesSql);
  writeFileSync(out, parts.join("\n"));
  writeFileSync(out.replace(/\.sql$/, "_dml_ignorado.txt"), dml.join("\n"));
  console.log(`DML de dados ignorado (vem da importação): ${dml.length}`);
  writeFileSync(out.replace(/\.sql$/, "_cron.sql"), cron.join("\n\n"));
  console.log(`cron adiado: ${cron.length}`);
  const left = parts.join("\n").match(/lzahnaekoiervgqxmouv/g)?.length ?? 0;
  console.log(`${files.length} migrations -> ${out}; tipos: ${typeStmts.length}; refs Lovable restantes: ${left}`);
}
