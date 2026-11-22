// Divide SQL em comandos respeitando aspas, identificadores, comentários e $tag$...$tag$.
export function splitSql(sql) {
  const out = []; let cur = ""; let i = 0;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (c === "-" && n === "-") { const j = sql.indexOf("\n", i); const e = j < 0 ? sql.length : j; cur += sql.slice(i, e); i = e; continue; }
    if (c === "/" && n === "*") { const j = sql.indexOf("*/", i + 2); const e = j < 0 ? sql.length : j + 2; cur += sql.slice(i, e); i = e; continue; }
    if (c === "'" || c === '"') { let j = i + 1; while (j < sql.length) { if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; } j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === "$") { const m = sql.slice(i).match(/^\$[A-Za-z_]*\$/); if (m) { const tag = m[0]; const j = sql.indexOf(tag, i + tag.length); const e = j < 0 ? sql.length : j + tag.length; cur += sql.slice(i, e); i = e; continue; } }
    if (c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.replace(/--[^\n]*/g, "").trim()) out.push(cur.trim());
  return out;
}
