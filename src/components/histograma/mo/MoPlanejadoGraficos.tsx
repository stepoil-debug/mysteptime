import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
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
  type MoDiario,
  type MoSemana,
} from "@/lib/mo-planejado";
import { todayStr } from "@/lib/histogramaNovo";

// Gráficos de PLANEJADO da "Apresentação 1 - Planejado" (pedido dela, 2026-11-09). Mesmos
// cálculos em src/lib/mo-planejado.ts; aqui só desenha. Usado no fim do Dashboard (dados da
// RPC, somente leitura) e como prévia na aba M.O (dados das linhas).

// mo_planejamento/RPCs ainda não estão nos tipos gerados do Supabase.
const supabase: any = supabaseTyped;

const COR_SEMANA = "#2E8CAB";
const COR_MEDIA = "#2F5D93";
const COR_SOMA = "#4472C4";

const semanaConfig = { total: { label: "SOMA", color: COR_SEMANA } } satisfies ChartConfig;
const mesConfig = {
  media: { label: "Média trabalhada de funcionários", color: COR_MEDIA },
  somaDias: { label: "Soma de dias trabalhados", color: COR_SOMA },
} satisfies ChartConfig;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const inteiro = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString("pt-BR") : "";
};

function TooltipSemana({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload as MoSemana;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">Semana {s.rotulo}</p>
      <p className="text-muted-foreground">
        {ddmm(s.inicio)}–{ddmm(s.fim)}
      </p>
      <p className="mt-1 font-semibold">Total: {s.total}</p>
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
}: {
  diario: MoDiario[];
  hoje?: string;
}) {
  const semanas = useMemo(() => calcularSemanas(diario, hoje), [diario, hoje]);
  const meses = useMemo(
    () =>
      calcularMeses(diario, hoje).map((m) => ({
        ...m,
        media: Math.round(m.media),
        mediaExata: m.media,
      })),
    [diario, hoje],
  );

  if (diario.length === 0) {
    return <EmptyState icon={CalendarRange} title="Nenhum M.O planejado cadastrado." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-dashed p-4">
        <h3 className="text-sm font-semibold">QUANTITATIVO SEMANAL DE EMBARQUE — PLANEJADO</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          17 semanas a partir da semana passada · por semana: soma das médias diárias de cada função
          (arredondadas)
        </p>
        <ChartContainer config={semanaConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={semanas} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
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
          </BarChart>
        </ChartContainer>
      </Card>

      <Card className="border-dashed p-4">
        <h3 className="text-sm font-semibold">QUANTITATIVO MENSAL DE EMBARQUE — PLANEJADO</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          8 meses a partir do atual · soma de homem-dia e média diária de funcionários
        </p>
        <ChartContainer config={mesConfig} className="aspect-auto h-[280px] w-full">
          <ComposedChart data={meses} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
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
          </ComposedChart>
        </ChartContainer>
      </Card>
    </div>
  );
}

// Seção no fim do Dashboard: visível pra todos que veem o Dashboard, dados só pela RPC
// (agregados por dia/função, nunca as linhas). Respeita os filtros Unidade/BSP do Dashboard;
// De/Até e Colaborador não se aplicam (horizonte próprio).
export function MoPlanejadoDashboardSection({
  unidades,
  bsps,
}: {
  unidades: string[];
  bsps: string[];
}) {
  const hoje = todayStr();
  const janela = janelaGraficos(hoje);
  const { data: diario = [], isLoading } = useQuery<MoDiario[]>({
    queryKey: ["mo-planejado-diario", janela.inicio, janela.fim, unidades, bsps],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mo_planejado_diario", {
        p_inicio: janela.inicio,
        p_fim: janela.fim,
        p_unidades: unidades.length ? unidades : null,
        p_bsps: bsps.length ? bsps : null,
      });
      if (error) throw error;
      return (data ?? []).map((r: MoDiario) => ({ ...r, qtd_total: Number(r.qtd_total) }));
    },
  });
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
          {(unidades.length > 0 || bsps.length > 0) &&
            " Filtrado pela Unidade/BSP do Dashboard (De/Até e Colaborador não se aplicam)."}
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
