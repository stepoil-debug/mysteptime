import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange } from "lucide-react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  calcularMeses,
  calcularSemanas,
  janelaGraficos,
  addDiasIso,
  domingoDaSemana,
  type MoDiario,
  type MoSemana,
} from "@/lib/mo-planejado";
import { todayStr } from "@/lib/histogramaNovo";
import { selectAllPages } from "@/lib/supabasePaginate";
import { aplicarAjusteDisponivel, disponivelPorFuncaoNosDias } from "@/lib/mo-disponivel";
import { normFuncao, type LinhaPlanejadoRpc } from "@/lib/mo-planejado-x-disponivel";
import { usePlanejamentoEmbarqueQuery } from "@/components/histograma/PlanejamentoEmbarqueTab";
import { useDisponivelAjuste } from "@/components/histograma/mo/usePlanejadoXDisponivel";

// Gráficos de PLANEJADO da "Apresentação 1 - Planejado" (pedido dela, 2026-11-09). Mesmos
// cálculos em src/lib/mo-planejado.ts; aqui só desenha. Usado no fim do Dashboard (dados da
// RPC, somente leitura) e como prévia na aba M.O (dados das linhas).

// mo_planejamento/RPCs ainda não estão nos tipos gerados do Supabase.
const supabase: any = supabaseTyped;

const COR_SEMANA = "#2E8CAB";
const COR_MEDIA = "#2F5D93";
const COR_SOMA = "#4472C4";
const COR_DISP = "#C00000";
const MOSTRAR_DISP_NOS_GRAFICOS = false as boolean;

const semanaConfig = {
  total: { label: "Planejado (SOMA)", color: COR_SEMANA },
  disponivel: { label: "Disponível (média/dia)", color: COR_DISP },
} satisfies ChartConfig;
const mesConfig = {
  media: { label: "Média trabalhada de funcionários", color: COR_MEDIA },
  somaDias: { label: "Soma de dias trabalhados", color: COR_SOMA },
  disponivel: { label: "Disponível (média/dia)", color: COR_DISP },
} satisfies ChartConfig;

type SemanaComDisp = MoSemana & { disponivel: number | null };

/** Média (arredondada) do disponível total nos dias de hoje em diante dentro de [ini, fim]. */
function mediaDisp(disp: Map<string, number> | undefined, ini: string, fim: string, hoje: string) {
  if (!disp) return null;
  let soma = 0;
  let n = 0;
  disp.forEach((v, d) => {
    if (d >= ini && d <= fim && d >= hoje) {
      soma += v;
      n++;
    }
  });
  return n ? Math.round(soma / n) : null;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const inteiro = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString("pt-BR") : "";
};

function TooltipSemana({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload as SemanaComDisp;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">Semana {s.rotulo}</p>
      <p className="text-muted-foreground">
        {ddmm(s.inicio)}–{ddmm(s.fim)}
      </p>
      <p className="mt-1 font-semibold">Planejado: {s.total}</p>
      {s.disponivel != null && (
        <p className="font-semibold" style={{ color: COR_DISP }}>
          Disponível (média/dia): {s.disponivel}
        </p>
      )}
      {s.porFuncao.length > 0 && (
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
          {s.porFuncao.map((f) => (
            <li key={f.funcao} className="flex justify-between gap-4">
              <span>{f.funcao}</span>
              <span className="font-medium">{f.qtd}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MoPlanejadoGraficos({
  diario,
  hoje = todayStr(),
  dispPorDia,
  periodo,
}: {
  diario: MoDiario[];
  hoje?: string;
  /** Período De/Até (aba M.O). Sem ele: 17 semanas da semana passada e 8 meses do atual. */
  periodo?: Periodo;
  /** Disponível total por dia (de hoje em diante). Sem ele, os gráficos não mostram a linha. */
  dispPorDia?: Map<string, number>;
}) {
  const semanas = useMemo<SemanaComDisp[]>(
    () =>
      (periodo
        ? calcularSemanas(diario, addDiasIso(periodo.de, 7), qtdSemanas(periodo))
        : calcularSemanas(diario, hoje)
      ).map((s) => ({
        ...s,
        disponivel: mediaDisp(dispPorDia, s.inicio, s.fim, hoje),
      })),
    [diario, hoje, dispPorDia, periodo],
  );
  const meses = useMemo(
    () =>
      (periodo
        ? calcularMeses(diario, periodo.de, qtdMeses(periodo))
        : calcularMeses(diario, hoje)
      ).map((m) => ({
        ...m,
        media: Math.round(m.media),
        mediaExata: m.media,
        disponivel: mediaDisp(dispPorDia, `${m.mes}-01`, `${m.mes}-31`, hoje),
      })),
    [diario, hoje, dispPorDia, periodo],
  );

  if (diario.length === 0) {
    return <EmptyState icon={CalendarRange} title="Nenhum M.O planejado cadastrado." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-dashed p-4">
        <h3 className="text-sm font-semibold">QUANTITATIVO SEMANAL DE EMBARQUE — PLANEJADO</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {periodo ? "Semanas do período De/Até" : "17 semanas a partir da semana passada"} · por semana: soma das médias diárias de cada função
          (arredondadas)
        </p>
        <ChartContainer config={semanaConfig} className="aspect-auto h-[280px] w-full">
          <ComposedChart data={semanas} margin={{ top: 20, right: 8, bottom: 4, left: 18 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={44}
            />
            <YAxis hide />
            <ChartTooltip cursor={{ fill: "var(--color-muted)" }} content={<TooltipSemana />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={inteiro}
                style={{ fontSize: 11, fontWeight: 700 }}
              />
            </Bar>
            {dispPorDia && (
              <Line
                dataKey="disponivel"
                stroke="var(--color-disponivel)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-disponivel)" }}
                isAnimationActive={false}
              />
            )}
            {dispPorDia && <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />}
          </ComposedChart>
        </ChartContainer>
      </Card>

      <Card className="border-dashed p-4">
        <h3 className="text-sm font-semibold">QUANTITATIVO MENSAL DE EMBARQUE — PLANEJADO</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {periodo ? "Meses do período De/Até" : "8 meses a partir do atual"} · soma de homem-dia e média diária de funcionários
        </p>
        <ChartContainer config={mesConfig} className="aspect-auto h-[280px] w-full">
          <ComposedChart data={meses} margin={{ top: 20, right: 8, bottom: 4, left: 18 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis yAxisId="esq" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="dir"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as (typeof meses)[number];
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{m.rotulo}</p>
                    <p>Soma de dias trabalhados: {m.somaDias.toLocaleString("pt-BR")}</p>
                    <p>
                      Média trabalhada de funcionários:{" "}
                      {m.mediaExata.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    </p>
                    {m.disponivel != null && (
                      <p style={{ color: COR_DISP }}>Disponível (média/dia): {m.disponivel}</p>
                    )}
                  </div>
                );
              }}
            />
            <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
            <Bar yAxisId="dir" dataKey="media" fill="var(--color-media)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="media"
                position="insideTop"
                formatter={inteiro}
                style={{ fontSize: 11, fontWeight: 700, fill: "#ffffff" }}
              />
            </Bar>
            <Line
              yAxisId="esq"
              dataKey="somaDias"
              stroke="var(--color-somaDias)"
              strokeWidth={2.25}
              dot={{ r: 4, fill: "var(--color-somaDias)" }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="somaDias"
                position="top"
                formatter={inteiro}
                style={{ fontSize: 11, fontWeight: 700, fill: COR_SOMA }}
              />
            </Line>
            {dispPorDia && (
              <Line
                yAxisId="dir"
                dataKey="disponivel"
                stroke="var(--color-disponivel)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "var(--color-disponivel)" }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      </Card>
    </div>
  );
}

// Seção no fim do Dashboard: visível pra todos que veem o Dashboard, dados só pela RPC
// (agregados por dia/função, nunca as linhas). Só reflete a aba M.O (pedido dela, 2026-11-10):
// nenhum filtro do Dashboard se aplica, então mostra exatamente os gráficos da aba M.O sem filtro.
export function MoPlanejadoDashboardSection({
  unidades = [],
  bsps = [],
}: {
  unidades?: string[];
  bsps?: string[];
} = {}) {
  // Filtros do Dashboard não se aplicam (mesma base do Detalhamento – Planejado).
  void unidades;
  void bsps;
  const hoje = todayStr();
  const { diario, isLoading } = useBaseGraficosPlanejado(hoje);
  const { data: ultima } = useQuery<{
    atualizado_em: string;
    atualizado_por: string | null;
  } | null>({
    queryKey: ["mo-planejado-ultima-atualizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mo_planejado_ultima_atualizacao");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  return (
    <section className="space-y-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 p-4 dark:border-sky-800 dark:bg-sky-950/20">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">PLANEJADO — Mão de Obra (M.O)</h2>
          <Badge className="bg-sky-600 hover:bg-sky-600">PLANEJADO</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Dados planejados pela liderança. Não representam embarques realizados.
          {ultima &&
            ` Última atualização: ${new Date(ultima.atualizado_em).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}${ultima.atualizado_por ? ` por ${ultima.atualizado_por}` : ""}.`}
          {" Mesmos números do Detalhamento – Planejado da aba M.O (com as edições manuais); os filtros do Dashboard não se aplicam aqui."}
        </p>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Carregando planejado…</p>
      ) : (
        <MoPlanejadoGraficos diario={diario} hoje={hoje} />
      )}
    </section>
  );
}

/**
 * Base dos gráficos (Dashboard e aba M.O) = a do Detalhamento – Planejado: planejado pela RPC
 * mo_planejado_drake_diario (já com mo_planejado_ajuste) e disponível pela regra do card
 * "M.O disponível x Dia" com os ajustes de mo_disponivel_ajuste, somado nas funções com
 * correspondência no Drake.
 */
export function useBaseGraficosPlanejado(hoje: string, periodo?: Periodo) {
  const janela = periodo
    ? { inicio: domingoDaSemana(periodo.de), fim: fimDoPeriodo(limitar(periodo)) }
    : janelaGraficos(hoje);
  const q = useQuery<LinhaPlanejadoRpc[]>({
    queryKey: ["mo-planejado-diario", "drake", janela.inicio, janela.fim],
    queryFn: () =>
      selectAllPages<LinhaPlanejadoRpc>((from, to) =>
        supabase
          .rpc("mo_planejado_drake_diario", { p_inicio: janela.inicio, p_fim: janela.fim })
          .range(from, to),
      ),
    retry: false,
  });
  const { data: planejamento } = usePlanejamentoEmbarqueQuery();
  const { data: ajustes = [] } = useDisponivelAjuste();
  const linhas = q.data;
  const diario = useMemo<MoDiario[]>(
    () =>
      (linhas ?? []).map((r) => ({ dia: r.dia, funcao: normFuncao(r.funcao), qtd_total: Number(r.planejado) })),
    [linhas],
  );
  const dispPorDia = useMemo(() => {
    // Gráficos seguem a planilha: só planejado, sem linha de disponível.
    if (MOSTRAR_DISP_NOS_GRAFICOS === false || !planejamento?.length || !linhas) return undefined;
    const funcoes = new Set(
      linhas.filter((r) => !r.sem_correspondencia).map((r) => normFuncao(r.funcao)),
    );
    ajustes.forEach((a) => funcoes.add(normFuncao(a.funcao)));
    const dias: string[] = [];
    for (let d = hoje; d <= janela.fim && dias.length < 800; ) {
      dias.push(d);
      const t = new Date(`${d}T00:00:00Z`);
      t.setUTCDate(t.getUTCDate() + 1);
      d = t.toISOString().slice(0, 10);
    }
    const disp = aplicarAjusteDisponivel(
      disponivelPorFuncaoNosDias(planejamento, dias, hoje),
      ajustes,
      dias,
      hoje,
    );
    const total = new Map<string, number>();
    for (const d of dias) {
      let soma = 0;
      funcoes.forEach((k) => {
        soma += disp.get(k)?.porDia.get(d) ?? 0;
      });
      total.set(d, soma);
    }
    return total;
  }, [planejamento, linhas, ajustes, hoje, janela.fim]);
  return { diario, dispPorDia, isLoading: q.isLoading };
}

/** Gráficos com a base do Detalhamento (usado na aba M.O). */
export function MoPlanejadoGraficosBase({ hoje, periodo }: { hoje: string; periodo?: Periodo }) {
  const { diario, isLoading } = useBaseGraficosPlanejado(hoje, periodo);
  if (isLoading) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Carregando planejado…</p>;
  }
  return <MoPlanejadoGraficos diario={diario} hoje={hoje} periodo={periodo} />;
}

export interface Periodo {
  de: string;
  ate: string;
}

/** A RPC aceita até 800 dias: corta o Até como as tabelas do Detalhamento. */
function limitar(p: Periodo): Periodo {
  const max = addDiasIso(domingoDaSemana(p.de), 760);
  return p.ate > max ? { de: p.de, ate: max } : p;
}

/** Nº de semanas (domingo a sábado) que cobrem o período. */
function qtdSemanas(pp: Periodo) {
  const p = limitar(pp);
  const ini = Date.parse(`${domingoDaSemana(p.de)}T00:00:00Z`);
  const fim = Date.parse(`${p.ate}T00:00:00Z`);
  return Math.min(120, Math.max(1, Math.floor((fim - ini) / (7 * 86400000)) + 1));
}

/** Nº de meses que cobrem o período. */
function qtdMeses(pp: Periodo) {
  const p = limitar(pp);
  const m = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
  return Math.min(36, Math.max(1, m(p.ate) - m(p.de) + 1));
}

/** Último dia coberto pelos gráficos: fim da última semana ou do último mês do período. */
function fimDoPeriodo(p: Periodo) {
  const fimSemanas = addDiasIso(domingoDaSemana(p.de), qtdSemanas(p) * 7 - 1);
  const a = Number(p.ate.slice(0, 4));
  const mes = Number(p.ate.slice(5, 7));
  const fimMes = new Date(Date.UTC(a, mes, 0)).toISOString().slice(0, 10);
  return fimSemanas > fimMes ? fimSemanas : fimMes;
}
