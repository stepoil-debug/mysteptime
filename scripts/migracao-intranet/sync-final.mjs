// My Step Time: lê lovable_export e sincroniza mysteptime no mesmo banco.
// ROLLBACK por padrão. Carregue o staging com load-export.mjs antes deste passo.
// node --env-file=.env.local scripts/migracao-intranet/sync-final.mjs
// --id-map <digest> libera somente o conjunto aprovado de equivalências de Auth e Drake.
// Origem prevalece em divergência. Períodos Drake remapeados preservam UUID e created_at
// do destino. Presença com UUID remapeado preserva a versão mais recente por last_seen.
// Snapshots usam (snapshot_date, colaborador_nome) e mantêm o ID já atribuído no destino.
// Repetir o mesmo comando com --commit <digest do teste> apenas na janela aprovada.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const STAGING = "lovable_export";
export const STAGING_USERS = "__migration_source_users";
export const DESTINATION_ONLY = new Set(["bm_dias_overrides"]);
export const TARGET = { ref: "knzszyxsspdjzgqkfrdt", schema: "mysteptime", env: "MYSTEPTIME_DB_URL" };
const PAGE_SIZE = 3000;
const SNAPSHOTS = "planejamento_embarque_snapshots";
const SNAPSHOT_KEY = ["snapshot_date", "colaborador_nome"];
const syncKey = (table) => table.name === SNAPSHOTS ? SNAPSHOT_KEY : table.pk;
const valueColumns = (table) => table.name === SNAPSHOTS
  ? table.cols.filter((column) => column !== "id")
  : table.cols;
const sameRow = (left, right) => left?.hash === right?.hash && left?.rowId === right?.rowId;
export class MigrationError extends Error {}
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const accountColumns = new Map(Object.entries({
  profiles: ["id"], user_roles: ["user_id"], notifications: ["user_id"],
  flow_track_events: ["registro", "user_id"], flow_track_presence: ["user_id"],
}));
const drakeColumns = new Map(Object.entries({ hist_novo_periodos: ["id"], timesheet_embarques: ["periodo_id"] }));
const ZERO = "0".repeat(32);
export const ident = (value) => '"' + value.replaceAll('"', '""') + '"';
export const relation = (schema, table) => ident(schema) + "." + ident(table);
const sha = (value) => createHash("sha256").update(value).digest("hex");

export function classify(source, target, remappedPresence = false) {
  if (!source) return "targetOnly";
  if (!target) return "insert";
  if (source.hash === target.hash) return "equal";
  if (remappedPresence && target.lastSeen !== null &&
      (source.lastSeen === null || target.lastSeen >= source.lastSeen)) return "keepTarget";
  return "update";
}

export function connectionConfig(scope) {
  const raw = process.env[scope.env];
  if (!raw) throw new MigrationError("Variável ausente: " + scope.env);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new MigrationError("Formato inválido da variável " + scope.env);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !(url.hostname === "db." + scope.ref + ".supabase.co" ||
      (url.hostname.endsWith(".pooler.supabase.com") && url.username === "postgres." + scope.ref))) {
    throw new MigrationError("Projeto inesperado para " + scope.env);
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)) || "postgres",
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
  };
}

async function catalog(db, schema) {
  const { rows } = await db.query(`
    select c.relname as name,
      array(select a.attname::text from pg_attribute a
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
        order by a.attname collate "C") as cols,
      array(select a.attname::text from pg_attribute a
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated=''
        order by a.attname collate "C") as writable,
      array(select a.attname::text from pg_index i
        cross join lateral unnest(i.indkey) with ordinality k(n,pos)
        join pg_attribute a on a.attrelid=c.oid and a.attnum=k.n
        where i.indrelid=c.oid and i.indisprimary order by k.pos) as pk,
      exists(select from pg_index i where i.indrelid=c.oid and i.indisunique
        and i.indisvalid and i.indimmediate and i.indpred is null and i.indexprs is null
        and i.indnkeyatts=cardinality($2::text[])
        and array(select a.attname::text
          from unnest(i.indkey) with ordinality k(n,pos)
          join pg_attribute a on a.attrelid=c.oid and a.attnum=k.n and a.attnotnull
          where k.pos<=i.indnkeyatts order by k.pos)=$2::text[]
      ) as snapshot_key_ready,
      array(select distinct d.relname::text from pg_constraint f
        join pg_class d on d.oid=f.confrelid
        where f.contype='f' and f.conrelid=c.oid and d.relnamespace=n.oid
          and f.confrelid<>c.oid order by 1) as parents
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=$1 and c.relkind in ('r','p') and not c.relispartition
    order by c.relname collate "C"`, [schema, SNAPSHOT_KEY]);
  return new Map(rows.map((row) => [row.name, row]));
}

const rowShape = (columns) => "(select v from (select " +
  columns.map((c) => "r." + ident(c)).join(", ") + ") v)";
const keyExpr = (pk) => "jsonb_build_array(" + pk.map((c) => "r." + ident(c)).join(", ") + ")::text";

function sqlJson(value) {
  return "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
}

function sourceRelation(schema, table, mapping) {
  const raw = relation(schema, table);
  const mapped = [
    [mapping?.accounts, accountColumns.get(table)],
    [mapping?.events, drakeColumns.get(table)],
  ];
  const entries = mapped.flatMap(([values, columns]) => {
    if (!values || !columns || !Object.keys(values).length) return [];
    // Os mapas são construídos exclusivamente de UUIDs validados pelo preflight.
    const lookup = sqlJson(values);
    return columns.flatMap((column) => {
      const field = "original." + ident(column);
      return ["'" + column + "'", "coalesce(" + lookup + "->>" + field +
        "::text, " + field + "::text)"];
    });
  });
  if (table === "hist_novo_periodos" && mapping && Object.keys(mapping.eventCreatedAt).length) {
    const lookup = sqlJson(mapping.eventCreatedAt);
    entries.push("'created_at'", "coalesce(" + lookup + "->>original.id::text, original.created_at::text)");
  }
  if (!entries.length) return raw;
  return "(select (jsonb_populate_record(original, jsonb_build_object(" +
    entries.join(", ") + "))).* from " + raw + " original)";
}

async function scan(db, schema, table, pk, columns, mapping) {
  const rows = new Map();
  const key = keyExpr(pk);
  const lastSeen = table === "flow_track_presence"
    ? `, to_char(r.last_seen at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as last_seen`
    : "";
  const rowId = table === SNAPSHOTS ? ", r.id::text as row_id" : "";
  const invalidKey = schema === STAGING
    ? ", (" + pk.map((column) => "r." + ident(column) + " is null").join(" or ") + ") as invalid_key"
    : "";
  await db.query(`
    declare migration_rows no scroll cursor for
    select ${key} k, md5(row_to_json(${rowShape(columns)})::text) hash${lastSeen}${rowId}${invalidKey}
    from ${sourceRelation(schema, table, mapping)} r
    order by (${key}) collate "C"`);
  for (;;) {
    const result = await db.query("fetch forward " + PAGE_SIZE + " from migration_rows");
    for (const { k, hash, last_seen, row_id, invalid_key } of result.rows) {
      if (invalid_key) throw new MigrationError("Chave nula no staging");
      if (rows.has(k)) throw new MigrationError("Chave duplicada no instantâneo");
      rows.set(k, { hash, lastSeen: last_seen ?? null, rowId: row_id ?? null });
    }
    if (result.rowCount < PAGE_SIZE) break;
  }
  await db.query("close migration_rows");
  return rows;
}

function orderedChanges(changes, catalogMap) {
  const remaining = new Set(changes.keys());
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) =>
      catalogMap.get(table).parents.every((parent) => !remaining.has(parent)));
    if (!ready.length) throw new MigrationError("Dependências cíclicas entre tabelas alteradas");
    for (const table of ready) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

async function orderedRowWrites(db, table, operations, mapping) {
  const columns = table.writable;
  const list = columns.map(ident).join(", ");
  const keysForWrite = syncKey(table);
  const pk = keysForWrite.map(ident).join(", ");
  const sets = columns.filter((column) => !keysForWrite.includes(column) && !table.pk.includes(column))
    .map((column) => ident(column) + "=excluded." + ident(column)).join(", ");
  const action = sets ? "do update set " + sets : "do nothing";
  const key = keyExpr(keysForWrite);
  const hash = "md5(row_to_json(" + rowShape(valueColumns(table)) + ")::text)";
  const sourceTable = sourceRelation(STAGING, table.name, mapping);
  const targetTable = relation(TARGET.schema, table.name);
  for (let offset = 0; offset < operations.length; offset += 200) {
    const batch = operations.slice(offset, offset + 200);
    const expected = new Map(batch.map(({ key, hash }) => [key, hash]));
    const keys = [...expected.keys()];
    const result = await db.query(`
      select ${key} k, row_to_json(${rowShape(columns)})::text payload
      from ${sourceTable} r where (${key}) = any($1::text[])`, [keys]);
    if (result.rowCount !== expected.size) throw new MigrationError("Mudança no instantâneo da origem");
    // Mantém números e timestamps na representação Postgres, sem parse JSON dos dados em JS.
    const payload = "[" + result.rows.map((row) => row.payload).join(",") + "]";
    const write = await db.query(`
      insert into ${targetTable} (${list}) overriding system value
      select ${list} from jsonb_populate_recordset(null::${targetTable}, $1::jsonb)
      on conflict (${pk}) ${action}`, [payload]);
    const verify = await db.query(`
      select ${key} k, ${hash} hash from ${targetTable} r
      where (${key}) = any($1::text[])`, [keys]);
    if (verify.rowCount !== expected.size ||
        verify.rows.some((row) => expected.get(row.k) !== row.hash)) {
      throw new MigrationError("Valores gravados divergem da origem");
    }
    console.log(JSON.stringify({ table: table.name, batch: offset / 200 + 1, rows: write.rowCount }));
  }
}

async function blockers(db) {
  const accountSql = "select id::text, lower(trim(email)) email from auth.users where email is not null";
  const eventSql = (schema) =>
    "select id::text, drake_event_key key, created_at::text from " + relation(schema, "hist_novo_periodos") +
    " where drake_event_key is not null";
  const [oa, ta, oh, th] = await Promise.all([
    db.query("select id::text, lower(trim(email)) as email from " +
      relation(STAGING, STAGING_USERS) + " where email is not null"), db.query(accountSql),
    db.query(eventSql(STAGING)), db.query(eventSql(TARGET.schema)),
  ]);
  const accounts = new Map(ta.rows.map((row) => [row.email, row.id]));
  const events = new Map(th.rows.map((row) => [row.key, row]));
  const accountPairs = oa.rows.flatMap((row) => {
    const mapped = accounts.get(row.email);
    return mapped && mapped !== row.id ? [[row.id, mapped]] : [];
  }).sort();
  const eventPairs = oh.rows.flatMap((row) => {
    const mapped = events.get(row.key);
    return mapped && mapped.id !== row.id ? [[row.id, mapped.id]] : [];
  }).sort();
  if ([...accountPairs, ...eventPairs].flat().some((id) => !uuid.test(id))) {
    throw new MigrationError("Mapa contém identificador inválido");
  }
  const eventCreatedAt = Object.fromEntries(oh.rows.flatMap((row) => {
    const mapped = events.get(row.key);
    return mapped && mapped.id !== row.id ? [[row.id, mapped.created_at]] : [];
  }));
  const staleTargetLinks = accountPairs.length ? await db.query(`
    select
      (select count(*) from mysteptime.flow_track_events where user_id=any($1::uuid[])) as events,
      (select count(*) from jsonb_each_text($2::jsonb) m
       join mysteptime.flow_track_presence o on o.user_id=m.key::uuid
       left join mysteptime.flow_track_presence t on t.user_id=m.value::uuid
       where t.user_id is null or (o.last_seen is not null and
         (t.last_seen is null or o.last_seen>t.last_seen))) as unhandled_presence`,
    [accountPairs.map(([old]) => old), JSON.stringify(Object.fromEntries(accountPairs))])
    : { rows: [{ events: 0, unhandled_presence: 0 }] };
  const targetAuthIds = new Set(ta.rows.map((row) => row.id));
  return {
    mapDigest: sha(JSON.stringify({ accountPairs, eventPairs })),
    mapping: { accounts: Object.fromEntries(accountPairs), events: Object.fromEntries(eventPairs), eventCreatedAt },
    conflicts: {
    missingAccounts: oa.rows.filter((row) => !accounts.has(row.email)).length,
    staleTargetLinks: Number(staleTargetLinks.rows[0].events) + Number(staleTargetLinks.rows[0].unhandled_presence),
    oldIdsInTargetAuth: accountPairs.some(([old]) => targetAuthIds.has(old)),
    conflictingAccounts: oa.rows.filter((row) => accounts.get(row.email) !== row.id).length,
    duplicatesInAuth: new Set(oa.rows.map((row) => row.email)).size !== oa.rowCount ||
      accounts.size !== ta.rowCount || new Set(oa.rows.map((row) => row.id)).size !== oa.rowCount,
    conflictingDrakeIds: oh.rows.filter((row) => events.has(row.key) && events.get(row.key).id !== row.id).length,
    duplicateDrakeKeys: new Set(oh.rows.map((row) => row.key)).size !== oh.rowCount || events.size !== th.rowCount,
    },
  };
}

async function checkMappedColumns(db, tables, mapping) {
  for (const [values, allowlist] of [[mapping.accounts, accountColumns], [mapping.events, drakeColumns]]) {
    const ids = Object.keys(values);
    if (!ids.length) continue;
    for (const [table] of tables) {
      const allowed = allowlist.get(table) ?? [];
      const result = await db.query(`
        select exists (
          select 1 from ${relation(STAGING, table)} r
          cross join lateral jsonb_each_text(to_jsonb(r)) e
          where e.value=any($1::text[]) and e.key<>all($2::text[])
        ) as unexpected`, [ids, allowed]);
      if (result.rows[0].unexpected) throw new MigrationError("UUID antigo em coluna sem mapeamento aprovado");
    }
  }
}

function parseArguments(args) {
  let digest, mapDigest;
  for (let i = 0; i < args.length; i += 2) {
    const option = args[i];
    const value = args[i + 1];
    if (!value || !["--commit", "--id-map"].includes(option)) throw new MigrationError("Opção inválida");
    if (option === "--commit") {
      if (!/^[a-f0-9]{64}$/.test(value) || digest) throw new MigrationError("Forneça o digest do ROLLBACK");
      digest = value;
    } else if (option === "--id-map") {
      if (!/^[a-f0-9]{64}$/.test(value) || mapDigest) throw new MigrationError("Digest de mapa inválido");
      mapDigest = value;
    }
  }
  return { digest, mapDigest };
}

async function main() {
  let db, targetTransaction = false, context = "configuração";
  try {
    const { digest, mapDigest } = parseArguments(process.argv.slice(2));
    const config = connectionConfig(TARGET);
    const { default: pg } = await import("pg").catch(() => {
      throw new MigrationError("Dependência pg indisponível");
    });
    db = new pg.Client(config);
    await db.connect();
    context = "staging e bloqueios";
    await db.query("begin");
    targetTransaction = true;
    await db.query("set local timezone='UTC'; set local datestyle='ISO, YMD'; set local intervalstyle='postgres'");
    await db.query("set local lock_timeout='5s'; set local statement_timeout='120s'");
    // READ COMMITTED: toda leitura de dados vem depois dos bloqueios.
    await db.query("lock table " + relation(STAGING, STAGING_USERS) + " in share mode nowait");
    const [original, destination] = await Promise.all([
      catalog(db, STAGING), catalog(db, TARGET.schema),
    ]);
    original.delete(STAGING_USERS);
    if (!original.size || [...destination.keys()].some((name) =>
      !DESTINATION_ONLY.has(name) && !original.has(name))) {
      throw new MigrationError("Export ausente ou incompleto");
    }
    // O staging é carregado sem índices ou restrições operacionais. A PK vem do destino.
    for (const [name, table] of original) {
      const dest = destination.get(name);
      if (!dest || dest.pk.some((column) => !table.cols.includes(column)) ||
          (name === SNAPSHOTS && SNAPSHOT_KEY.some((column) => !table.cols.includes(column)))) {
        throw new MigrationError("Chave do staging incompatível com o destino");
      }
      table.pk = dest.pk;
      await db.query("lock table " + relation(STAGING, name) + " in share mode nowait");
    }
    for (const name of destination.keys()) {
      await db.query("lock table " + relation(TARGET.schema, name) + " in share row exclusive mode nowait");
    }
    await db.query("lock table auth.users in share row exclusive mode nowait");
    const preflight = await blockers(db);
    const approvedMap = Boolean(mapDigest && mapDigest === preflight.mapDigest);
    // No ROLLBACK, simula os remapeamentos aprovados para montar o plano real.
    // Na repetição com COMMIT o operador precisa indicar o mesmo mapa conferido.
    const mapping = (!digest || approvedMap) ? preflight.mapping : undefined;
    const remappedPresenceKeys = new Set(Object.values(mapping?.accounts ?? {})
      .map((id) => JSON.stringify([id])));
    console.log(JSON.stringify({ preflight: preflight.conflicts, mapDigest: preflight.mapDigest, approvedMap }));
    if (mapDigest && !approvedMap) throw new MigrationError("O conjunto de remapeamentos mudou");
    if (mapping) await checkMappedColumns(db, original, mapping);
    const changes = new Map();
    const targetSnapshot = new Map();
    let conflicts = 0;
    const plan = createHash("sha256").update(mapping ? preflight.mapDigest : "sem-mapa");
    for (const [name, table] of original) {
      context = name;
      const dest = destination.get(name);
      const counts = { equal: 0, insert: 0, update: 0, targetOnly: 0, keepTarget: 0, conflict: 0 };
      if (!dest || !table.pk.length || table.pk.join() !== dest.pk.join() ||
          table.cols.some((c) => !dest.cols.includes(c)) ||
          table.writable.some((c) => !dest.writable.includes(c)) ||
          (name === SNAPSHOTS && !dest.snapshot_key_ready)) {
        conflicts++;
        console.log(JSON.stringify({ table: name, structureConflict: true }));
        continue;
      }
      const columns = valueColumns(table);
      const left = await scan(db, STAGING, name, syncKey(table), columns, mapping);
      const right = await scan(db, TARGET.schema, name, syncKey(table), columns);
      targetSnapshot.set(name, right);
      const operations = [];
      for (const key of new Set([...left.keys(), ...right.keys()])) {
        const o = left.get(key), t = right.get(key);
        const keyHash = sha(key);
        const state = classify(o, t, name === "flow_track_presence" && remappedPresenceKeys.has(key));
        counts[state]++;
        plan.update(JSON.stringify([name, keyHash, o?.hash ?? ZERO, t?.hash ?? ZERO, o?.rowId, t?.rowId, state]));
        if (state === "insert" || state === "update") {
          operations.push({ key, hash: o.hash, rowId: t?.rowId ?? o.rowId });
        }
      }
      if (operations.length) changes.set(name, operations);
      console.log(JSON.stringify({ table: name, ...counts, source: left.size, target: right.size }));
    }
    for (const name of destination.keys()) {
      if (!original.has(name)) {
        const table = destination.get(name);
        if (!table.pk.length) throw new MigrationError("Tabela exclusiva do destino sem chave primária");
        const rows = await scan(db, TARGET.schema, name, syncKey(table), valueColumns(table));
        targetSnapshot.set(name, rows);
        for (const [key, row] of rows) plan.update(JSON.stringify([name, sha(key), row.hash, "targetOnly"]));
        console.log(JSON.stringify({ table: name, targetOnlyTable: true, targetOnly: rows.size }));
      }
    }
    const hash = plan.digest("hex");
    const { conflictingAccounts, conflictingDrakeIds, ...remaining } = preflight.conflicts;
    if (conflicts || Object.values(remaining).some(Boolean) ||
        (!mapping && (conflictingAccounts || conflictingDrakeIds))) {
      throw new MigrationError("Há conflitos pendentes");
    }
    if (digest && digest !== hash) throw new MigrationError("O plano mudou desde o ROLLBACK aprovado");

    for (const name of orderedChanges(changes, destination)) {
      context = name;
      await orderedRowWrites(db, original.get(name), changes.get(name), mapping);
    }
    await db.query("set constraints all immediate");
    for (const [name, table] of destination) {
      context = name;
      const expected = targetSnapshot.get(name);
      for (const { key, hash, rowId } of changes.get(name) ?? []) expected.set(key, { hash, rowId });
      const compareColumns = valueColumns(original.get(name) ?? table);
      const after = await scan(db, TARGET.schema, name, syncKey(table), compareColumns);
      if (expected.size !== after.size || [...expected].some(([key, row]) => !sameRow(after.get(key), row))) {
        throw new MigrationError("Efeito de gravação fora do plano aprovado");
      }
    }
    await db.query(digest ? "commit" : "rollback");
    targetTransaction = false;
    console.log(JSON.stringify({ result: digest ? "COMMIT" : "ROLLBACK", digest: hash, mapDigest: preflight.mapDigest }));
  } catch (error) {
    const outcome = targetTransaction
      ? await db.query("rollback").then(() => "ROLLBACK", () => "TRANSACTION_STATUS_UNKNOWN")
      : "PRECHECK_BLOCKED";
    // Mensagens do driver e SQL bruto podem conter credenciais ou dados empresariais.
    const sqlstate = /^[0-9A-Z]{5}$/.test(error?.code ?? "") ? error.code : undefined;
    const reason = error instanceof MigrationError ? error.message : undefined;
    console.error(JSON.stringify({ result: outcome, context, sqlstate, reason }));
    process.exitCode = 1;
  } finally {
    await db?.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
