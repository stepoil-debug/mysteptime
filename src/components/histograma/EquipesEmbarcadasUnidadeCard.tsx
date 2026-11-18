import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Ship } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  equipeNaData,
  equipesPorUnidade,
  type EquipePorUnidade,
  type LinhaEquipe,
} from "@/lib/equipes-embarcadas";

// "Equipes Embarcadas por Unidade" (pedido dela, 2026-11-11) — no lugar do "POB por Unidade ×
// Dia" no Dashboard. Mesma base da aba Equipes Embarcadas de Nomeações (src/lib/equipes-
// embarcadas.ts): Planejamento de Embarque, Status Embarcado + Programado com embarque hoje.

const config = {
  embarcados: { label: "Embarcados", color: "#1e3a5f" },
  programados: { label: "Programados para hoje", color: "#60a5fa" },
} satisfies ChartConfig;

function Tooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: EquipePorUnidade }[];
}) {
  if (!active || !payload?.length) return null;
  const u = payload[0].payload;
  return (
    <div className="min-w-[12rem] rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{u.unidade}</p>
      <p className="text-muted-foreground">
        {u.total} pessoa(s) · {u.embarcados} embarcado(s)
        {u.programados > 0 && ` · ${u.programados} programado(s) hoje`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {u.porBsp.map((b) => (
          <li key={b.bsp} className="flex justify-between gap-4">
            <span>{b.bsp}</span>
            <span className="font-semibold tabular-nums">{b.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EquipesEmbarcadasUnidadeCard({
  linhas,
  hoje,
}: {
  linhas: LinhaEquipe[];
  hoje: string;
}) {
  const dados = useMemo(() => equipesPorUnidade(equipeNaData(linhas, hoje)), [linhas, hoje]);
  const total = dados.reduce((s, u) => s + u.total, 0);
  const temProgramado = dados.some((u) => u.programados > 0);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Equipes Embarcadas por Unidade</h3>
          <p className="text-xs text-muted-foreground">
            Hoje, pelo Planejamento de Embarque — mesma base da aba Equipes Embarcadas de Nomeações
            (Embarcados + Programados com embarque hoje).
          </p>
        </div>
        <span className="text-sm">
          Total embarcado: <b className="tabular-nums">{total}</b>
        </span>
      </div>
      {dados.length === 0 ? (
        <EmptyState icon={Ship} title="Nenhuma equipe embarcada hoje" />
      ) : (
        <ChartContainer
          config={config}
          className="mt-3 aspect-auto w-full"
          style={{ height: Math.max(180, dados.length * 34 + 50) }}
        >
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="unidade"
              width={190}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip cursor={{ fill: "var(--color-muted)" }} content={<Tooltip />} />
            {temProgramado && <ChartLegend content={<ChartLegendContent />} />}
            <Bar
              dataKey="embarcados"
              stackId="a"
              fill="var(--color-embarcados)"
              radius={temProgramado ? 0 : [0, 4, 4, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="programados"
              stackId="a"
              fill="var(--color-programados)"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              <LabelList
                dataKey="total"
                position="right"
                className="fill-foreground text-[11px] font-bold"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
}
