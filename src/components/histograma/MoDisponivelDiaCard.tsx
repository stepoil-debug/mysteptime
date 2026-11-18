import { useMemo, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  composicaoEfetivo,
  disponivelPorFuncaoNosDias,
  moDisponivelPorDia,
  type LinhaDisponibilidade,
} from "@/lib/mo-disponivel";
import {
  CABECALHO_PLANILHA,
  ESTILO_PXD,
  agruparPlanejado,
  corPlanejadoDisponivel,
  mediaDisponivelSemana,
  mediaSemana,
  mesesAPartirDe,
  normFuncao,
} from "@/lib/mo-planejado-x-disponivel";
import { roundExcel } from "@/lib/mo-planejado";
import { usePlanejadoDrakeDiario } from "@/components/histograma/mo/usePlanejadoXDisponivel";
import { ImportarPlanilhaMoBotao } from "@/components/histograma/mo/MoPlanejamentoTab";
import { LegendaPxD } from "@/components/histograma/mo/MoDetalhamentoPlanejado";

// "M.O disponível x Dia" (pedido dela, 2026-11-10) — substitui o "POB x Unidade" no Dashboard.
// Só dados do Planejamento de Embarque; regra em src/lib/mo-disponivel.ts. Verde = tem alguém
// disponível da função no dia; vermelho = ninguém.
//
// Modo "Planejado x Disponível" (pedido dela, 2026-11-12): sem mudar o disponível, cada célula
// mostra planejado / disponível (planejado = RPC mo_planejado_drake_diario, pela aba M.O e o
// De/Para) com as cores de src/lib/mo-planejado-x-disponivel.ts. Funções que só existem no
// planejado entram com disponível 0.

const DIA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function MoDisponivelDiaCard({
  linhas,
  hoje,
  nDias = 14,
  podeImportar = false,
}: {
  linhas: LinhaDisponibilidade[];
  hoje: string;
  nDias?: number;
  /** Mesmo acesso da aba M.O (ver useMoPodeEditar). */
  podeImportar?: boolean;
}) {
  const { dias, funcoes: funcoesDisp } = useMemo(
    () => moDisponivelPorDia(linhas, hoje, nDias),
    [linhas, hoje, nDias],
  );
  // Só a visão "Planejado x Disponível" (pedido dela, 2026-11-12).
  const pxd = true;
  const composicao = useMemo(() => composicaoEfetivo(linhas), [linhas]);

  const {
    data: rpc = [],
    isLoading: carregandoPlanejado,
    error: erroPlanejado,
  } = usePlanejadoDrakeDiario(dias[0], dias[dias.length - 1], pxd);
  const planejado = useMemo(() => agruparPlanejado(rpc), [rpc]);

  // Visão por mês (pedido dela, 2026-11-12): botões lado a lado, abre sempre em "Por dia".
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const meses = useMemo(() => mesesAPartirDe(hoje, 5), [hoje]);
  const fimMeses = meses[meses.length - 1].dias.at(-1)!;
  const { data: rpcMes = [], isLoading: carregandoMes } = usePlanejadoDrakeDiario(
    meses[0].dias[0],
    fimMeses,
    vista === "mes",
  );
  const planejadoMes = useMemo(() => agruparPlanejado(rpcMes), [rpcMes]);
  const disponivelMes = useMemo(
    () =>
      vista === "mes"
        ? disponivelPorFuncaoNosDias(
            linhas,
            meses.flatMap((m) => m.dias),
            hoje,
          )
        : null,
    [vista, linhas, meses, hoje],
  );

  type Linha = (typeof funcoesDisp)[number] & { chave: string; semDepara?: boolean };
  const funcoes = useMemo<Linha[]>(() => {
    const base: Linha[] = funcoesDisp.map((f) => ({ ...f, chave: normFuncao(f.funcao) }));
    if (!pxd) return base;
    const existentes = new Set(base.map((f) => f.chave));
    const extras: Linha[] = [];
    planejado.forEach((p, chave) => {
      if (existentes.has(chave)) return;
      extras.push({
        funcao: p.funcao,
        total: 0,
        chave,
        semDepara: p.semCorrespondencia,
        porDia: dias.map((dia) => ({ dia, qtd: 0, nomes: [] })),
      });
    });
    return [...base, ...extras].sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
  }, [funcoesDisp, pxd, planejado, dias]);

  return (
    <Card className="neon-onda neon-suave p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {pxd ? "M.O Planejado x Disponível x Dia" : "M.O disponível x Dia"}
          </h3>
          {pxd && <Badge className="bg-sky-600 hover:bg-sky-600">PLANEJADO</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
            {(
              [
                ["dia", "Por dia"],
                ["mes", "Por mês"],
              ] as const
            ).map(([v, rotulo]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  vista === v
                    ? "bg-background font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {/* Botão temporário (pedido dela, 2026-11-12) — tirar depois que ela importar. */}
          {podeImportar && <ImportarPlanilhaMoBotao />}
        </div>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        {pxd
          ? vista === "mes"
            ? "Por mês, igual à planilha da liderança: planejado = soma de dias trabalhados do mês (demandas da aba M.O, exceto BSP ON HOLD) ÷ dias do mês. Disponível = média dos dias de hoje em diante, pela regra atual do Planejamento de Embarque."
            : "Planejado = soma das demandas da aba M.O (Líder de Operações) ativas no dia, exceto BSP ON HOLD. Disponível = regra atual do Planejamento de Embarque."
          : 'Tudo pelo Planejamento de Embarque: hoje = Status "Disponível" (igual ao cartão Disponíveis); nos próximos dias, entra quem termina o ciclo pelas datas (embarque, folga, férias, programado) e sai quem tem embarque marcado. Indisponível, Bloqueados e Terceirizados ficam de fora.'}
      </p>
      {/* Quais Status compõem o efetivo offshore do Total M.O (pedido dela, 2026-11-12). */}
      <div className="mb-3 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        <p>
          <b>Efetivo offshore do Total M.O = {composicao.total}</b>, soma dos Status{" "}
          {composicao.dentro.map((s, i) => (
            <span key={s.status}>
              {i > 0 && (i === composicao.dentro.length - 1 ? " e " : ", ")}
              <b>{s.status}</b> ({s.qtd})
            </span>
          ))}{" "}
          do Planejamento de Embarque.
        </p>
        {composicao.fora.length > 0 && (
          <p className="mt-0.5 text-sky-900/80 dark:text-sky-200/80">
            Ficam fora:{" "}
            {composicao.fora.map((s, i) => (
              <span key={s.status}>
                {i > 0 && ", "}
                {s.status} ({s.qtd})
              </span>
            ))}
            .
          </p>
        )}
      </div>
      {pxd ? (
        <div className="mb-3">
          <LegendaPxD />
          {erroPlanejado && (
            <p className="mt-1 text-xs text-destructive">
              Não foi possível ler o planejado (o SQL do De/Para da M.O já foi rodado?).
            </p>
          )}
          {carregandoPlanejado && (
            <p className="mt-1 text-xs text-muted-foreground">Carregando planejado…</p>
          )}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Com
            disponível
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> Nenhum disponível
          </span>
        </div>
      )}
      {vista === "mes" ? (
        carregandoMes ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Carregando planejado…</p>
        ) : (
          <div className="max-h-[352px] overflow-auto rounded-md">
            <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-xs">
              <colgroup>
                <col className="w-[190px] sm:w-[250px]" />
                {meses.map((m) => (
                  <col key={m.mes} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-card">
                <tr>
                  <th className="sticky left-0 z-30 bg-card pr-3 text-left align-bottom font-medium">
                    <div className="flex items-end justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>Função</span>
                      <span title="Total de M.O da função no Planejamento de Embarque (sem Terceirizado, Indisponível e Bloqueados)">
                        Total M.O
                      </span>
                    </div>
                  </th>
                  {meses.map((m) => (
                    <th
                      key={m.mes}
                      className="rounded px-1 py-1 text-center text-[11px] font-semibold text-black"
                      style={{ backgroundColor: CABECALHO_PLANILHA.semana }}
                    >
                      {m.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chaves = new Map<string, { funcao: string; sem: boolean; total: number }>();
                  funcoes.forEach((f) =>
                    chaves.set(f.chave, { funcao: f.funcao, sem: !!f.semDepara, total: f.total }),
                  );
                  planejadoMes.forEach((p, k) => {
                    if (!chaves.has(k))
                      chaves.set(k, { funcao: p.funcao, sem: p.semCorrespondencia, total: 0 });
                  });
                  return Array.from(chaves.entries())
                    .sort((a, b) => a[1].funcao.localeCompare(b[1].funcao, "pt-BR"))
                    .map(([k, f]) => (
                      <tr key={k}>
                        <td className="sticky left-0 z-10 bg-card pr-3 font-medium">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate" title={f.funcao}>
                              {f.funcao}
                            </span>
                            {/* Mesmo Total M.O da visão "Por dia" (pedido dela, 2026-11-12). */}
                            <span
                              className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              title={`${f.total} pessoa(s) de ${f.funcao} no Planejamento (sem Terceirizado, Indisponível e Bloqueados)`}
                            >
                              {f.total}
                            </span>
                          </div>
                        </td>
                        {meses.map((m) => {
                          const p = mediaSemana(planejadoMes.get(k)?.porDia, m.dias);
                          const d = f.sem
                            ? 0
                            : (mediaDisponivelSemana(disponivelMes?.get(k)?.porDia, m.dias) ?? 0);
                          const e = ESTILO_PXD[corPlanejadoDisponivel(p, d)];
                          return (
                            <td key={m.mes} className="p-0">
                              <div
                                className="flex h-8 items-center justify-center gap-1 rounded-md border font-semibold tabular-nums"
                                style={{
                                  backgroundColor: e.bg,
                                  borderColor: e.border,
                                  color: e.text,
                                }}
                                title={`${f.funcao} · ${m.rotulo}: planejado ${p} (média diária) · disponível ${d} (média dos dias de hoje em diante) — ${e.rotulo}`}
                              >
                                {p}
                                <span className="text-[10px] font-normal opacity-75">/ {d}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ));
                })()}
              </tbody>
              {/* Total no fim (pedido dela, 2026-11-12). */}
              <tfoot className="sticky bottom-0 z-20 bg-card">
                <tr>
                  <td className="sticky left-0 z-30 bg-card pr-3">
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>TOTAL</span>
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
                        {funcoes.reduce((s, f) => s + f.total, 0)}
                      </span>
                    </div>
                  </td>
                  {meses.map((m) => {
                    // Igual à planilha ("Histograma MO", linhas MÊS / SOMA DE DIAS TRABALHADOS /
                    // MÉDIA TRABALHADA DE FUNCIONÁRIOS): soma do planejado de todos os dias do mês
                    // ÷ dias corridos do mês (conferido: Nov/26 = 5430 ÷ 30 = 181).
                    let somaDias = 0;
                    planejadoMes.forEach((g) =>
                      m.dias.forEach((dia) => (somaDias += g.porDia.get(dia) ?? 0)),
                    );
                    const p = roundExcel(somaDias / m.dias.length);
                    // Disponível do mês: média dos dias de hoje em diante, somando as funções.
                    let somaDisp = 0;
                    let nDisp = 0;
                    m.dias.forEach((dia) => {
                      if (dia < hoje) return;
                      nDisp++;
                      disponivelMes?.forEach((g) => (somaDisp += g.porDia.get(dia) ?? 0));
                    });
                    const d = nDisp ? roundExcel(somaDisp / nDisp) : 0;
                    return (
                      <td key={m.mes} className="p-0">
                        <div
                          className="flex h-8 items-center justify-center gap-1 rounded-md bg-slate-800 font-bold tabular-nums text-white"
                          title={`${m.rotulo}: soma de dias trabalhados ${somaDias.toLocaleString("pt-BR")} ÷ ${m.dias.length} dias = média ${p} planejado(s) · disponível médio ${d}`}
                        >
                          {p}
                          <span className="text-[10px] font-normal opacity-80">/ {d}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : funcoes.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum colaborador no Planejamento de Embarque" />
      ) : (
        // Ocupa a largura do card (colunas de dia dividem o espaço) e mostra 8 funções por vez;
        // as demais rolam dentro do quadro, com o cabeçalho de dias e a coluna de função fixos
        // (pedido dela, 2026-11-10). Em tela estreita, rola na horizontal também.
        <div className="max-h-[352px] overflow-auto rounded-md">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-xs">
            <colgroup>
              <col className="w-[190px] sm:w-[250px]" />
              {dias.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-card">
              <tr>
                <th className="sticky left-0 z-30 bg-card pr-3 text-left align-bottom font-medium">
                  <div className="flex items-end justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Função</span>
                    <span title="Total de M.O da função no Planejamento de Embarque (sem Terceirizado, Indisponível e Bloqueados)">
                      Total M.O
                    </span>
                  </div>
                </th>
                {dias.map((d) => {
                  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
                  return (
                    <th key={d} className="bg-card px-0.5 text-center font-medium">
                      <div className="text-muted-foreground">{DIA_SEMANA[dow]}</div>
                      <div>{d.slice(8, 10)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {funcoes.map((f) => (
                <tr key={f.chave}>
                  <td className="sticky left-0 z-10 bg-card pr-3 font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={f.funcao}>
                        {f.funcao}
                        {f.semDepara && (
                          <AlertTriangle
                            className="ml-1 inline h-3 w-3 text-amber-600"
                            aria-label="Função sem correspondência no Drake"
                          />
                        )}
                      </span>
                      {/* Total de M.O da função no Planejamento (pedido dela, 2026-11-11). */}
                      <span
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={`${f.total} pessoa(s) de ${f.funcao} no Planejamento (sem Terceirizado, Indisponível e Bloqueados)`}
                      >
                        {f.total}
                      </span>
                    </div>
                  </td>
                  {f.porDia.map((c) => {
                    const p = planejado.get(f.chave)?.porDia.get(c.dia) ?? 0;
                    const estilo = pxd ? ESTILO_PXD[corPlanejadoDisponivel(p, c.qtd)] : null;
                    return (
                      <td key={c.dia} className="p-0">
                        <HoverCard openDelay={120} closeDelay={60}>
                          <HoverCardTrigger asChild>
                            <div
                              className={cn(
                                "flex h-8 cursor-default items-center justify-center gap-1 rounded-md border font-semibold tabular-nums",
                                estilo
                                  ? ""
                                  : c.qtd > 0
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
                              )}
                              style={
                                estilo
                                  ? {
                                      backgroundColor: estilo.bg,
                                      borderColor: estilo.border,
                                      color: estilo.text,
                                    }
                                  : undefined
                              }
                            >
                              {estilo ? (
                                <>
                                  {p}
                                  <span className="text-[10px] font-normal opacity-75">
                                    / {c.qtd}
                                  </span>
                                </>
                              ) : (
                                c.qtd
                              )}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-60 p-2.5" side="top">
                            <p className="text-xs font-semibold">
                              {f.funcao} · {c.dia.slice(8, 10)}/{c.dia.slice(5, 7)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {pxd && `${p} planejado(s) · `}
                              {c.qtd} disponível(is)
                              {estilo && ` — ${estilo.rotulo}`}
                            </p>
                            {c.nomes.length > 0 && (
                              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-[11px]">
                                {c.nomes.map((n) => (
                                  <li key={n}>{n}</li>
                                ))}
                              </ul>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* Total no fim (pedido dela, 2026-11-12): soma do Total M.O e, por dia, planejado /
                disponível de todas as funções. */}
            <tfoot className="sticky bottom-0 z-20 bg-card">
              <tr>
                <td className="sticky left-0 z-30 bg-card pr-3">
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <span>TOTAL</span>
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
                      {funcoes.reduce((s, f) => s + f.total, 0)}
                    </span>
                  </div>
                </td>
                {dias.map((dia, i) => {
                  const p = funcoes.reduce(
                    (s, f) => s + (planejado.get(f.chave)?.porDia.get(dia) ?? 0),
                    0,
                  );
                  const d = funcoes.reduce((s, f) => s + (f.porDia[i]?.qtd ?? 0), 0);
                  return (
                    <td key={dia} className="p-0">
                      <div
                        className="flex h-8 items-center justify-center gap-1 rounded-md bg-slate-800 font-bold tabular-nums text-white"
                        title={`Total ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${p} planejado(s) · ${d} disponível(is)`}
                      >
                        {p}
                        <span className="text-[10px] font-normal opacity-80">/ {d}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
