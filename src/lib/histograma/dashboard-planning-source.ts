/** Cartões e indicadores de status usam sempre o planejamento vivo; média só no mensal. */
export function dashboardStatusDates(_dates: string[], _referenceDate: string, today: string): string[] {
  return [today];
}

export function dashboardPlanningRows<Live, Snapshot extends { snapshot_date: string }>(
  _day: string,
  _today: string,
  live: Live[],
  _snapshots: Snapshot[],
): { source: "live"; rows: Live[] } | { source: "snapshot"; rows: Snapshot[] } {
  return { source: "live", rows: live };
}
/**
 * Gráficos mensais (Taxa de Ocupação por mês e POB por Mês): foto do dia; num dia sem foto, a
 * foto mais recente ANTERIOR (pedido dela, 2026-11-10 — mais fiel pra dias que já passaram do
 * que a lista viva de hoje). null só antes da 1ª foto existir — aí quem chama usa a lista viva.
 */
export function criarBuscaFotoDoDia<Snapshot extends { snapshot_date: string }>(
  snapshots: Snapshot[],
): (day: string) => Snapshot[] | null {
  const porDia = new Map<string, Snapshot[]>();
  for (const s of snapshots) {
    if (!porDia.has(s.snapshot_date)) porDia.set(s.snapshot_date, []);
    porDia.get(s.snapshot_date)!.push(s);
  }
  const datas = Array.from(porDia.keys()).sort();
  return (day) => {
    // Maior data <= day (busca binária).
    let lo = 0;
    let hi = datas.length - 1;
    let achada: string | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (datas[mid] <= day) {
        achada = datas[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return achada ? porDia.get(achada)! : null;
  };
}
