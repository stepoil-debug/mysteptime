// "Equipes Embarcadas" — base única usada pela aba Equipes Embarcadas de Nomeações e pelo
// gráfico do Dashboard do Histograma (pedido dela, 2026-11-11: "mesma base de equipes
// embarcadas dentro de nomeações"). Puro — ver equipes-embarcadas.test.ts.
//
// Regra (a mesma que Nomeações já usava): pelo Planejamento de Embarque, Status "Embarcado" com
// unidade preenchida (e diferente de "FOLGA"); mais os "Programado" cujo Embarque é exatamente
// a data de referência (programado do dia), sem repetir quem já conta como embarcado.

export interface LinhaEquipe {
  id: string;
  nome: string;
  status: string | null;
  unidade: string | null;
  bsp: string | null;
  embarque: string | null;
}

export type EquipeTipo = "embarcado" | "programado";

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
const ehEmbarcado = (s: string | null) => norm(s) === "EMBARCADO";
const ehProgramado = (s: string | null) => norm(s) === "PROGRAMADO";
const unidadeValida = (r: LinhaEquipe) => !!r.unidade?.trim() && norm(r.unidade) !== "FOLGA";

export function equipeNaData<T extends LinhaEquipe>(
  linhas: T[],
  referencia: string,
): { row: T; tipo: EquipeTipo }[] {
  const embarcados = linhas
    .filter((r) => unidadeValida(r) && ehEmbarcado(r.status))
    .map((row) => ({ row, tipo: "embarcado" as const }));
  const ids = new Set(embarcados.map((e) => e.row.id));
  const programados = linhas
    .filter(
      (r) =>
        !ids.has(r.id) && unidadeValida(r) && ehProgramado(r.status) && r.embarque === referencia,
    )
    .map((row) => ({ row, tipo: "programado" as const }));
  return [...embarcados, ...programados];
}

export interface EquipePorUnidade {
  unidade: string;
  embarcados: number;
  programados: number;
  total: number;
  porBsp: { bsp: string; total: number }[];
}

/** Totais por unidade (mesmo agrupamento dos cartões de Nomeações), maior primeiro. */
export function equipesPorUnidade<T extends LinhaEquipe>(
  itens: { row: T; tipo: EquipeTipo }[],
): EquipePorUnidade[] {
  const m = new Map<string, EquipePorUnidade & { bsps: Map<string, number> }>();
  for (const { row, tipo } of itens) {
    const u = row.unidade!.trim();
    if (!m.has(u))
      m.set(u, {
        unidade: u,
        embarcados: 0,
        programados: 0,
        total: 0,
        porBsp: [],
        bsps: new Map(),
      });
    const g = m.get(u)!;
    if (tipo === "embarcado") g.embarcados++;
    else g.programados++;
    g.total++;
    const bsp = row.bsp?.trim() || "BSP não informado";
    g.bsps.set(bsp, (g.bsps.get(bsp) ?? 0) + 1);
  }
  return Array.from(m.values())
    .map(({ bsps, ...g }) => ({
      ...g,
      porBsp: Array.from(bsps.entries())
        .map(([bsp, total]) => ({ bsp, total }))
        .sort((a, b) => b.total - a.total || a.bsp.localeCompare(b.bsp, "pt-BR")),
    }))
    .sort((a, b) => b.total - a.total || a.unidade.localeCompare(b.unidade, "pt-BR"));
}
