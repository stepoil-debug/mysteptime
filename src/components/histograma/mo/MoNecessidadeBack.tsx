import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import type { LinhaDisponibilidade } from "@/lib/mo-disponivel";
import { necessidadeDaSemana, pessoasPorFuncaoNosDias, type NecessidadeFuncao } from "@/lib/mo-necessidade";
import type { SemanaPxD } from "@/lib/mo-planejado-x-disponivel";

// Necessidade de M.O x Back (pedido dela, 2026-11-27). Cálculo em src/lib/mo-necessidade.ts.

const config = {
  apontadas: { label: "Apontadas (a bordo)", color: "#16A34A" },
  faltaFixos: { label: "Falta fixos", color: "#DC2626" },
  backCoberto: { label: "Back com cobertura", color: "#2E8CAB" },
  backPendente: { label: "Back pendente", color: "#F59E0B" },
  necessidade: { label: "Necessidade", color: "#1E293B" },
} satisfies ChartConfig;

const PERIODO = "__periodo__";
const semZero = (v: unknown) => (Number(v) ? String(v) : "");

interface Props {
  linhas: { chave: string; funcao: string; sem: boolean }[];
  planejado: Map<string, { porDia: Map<string, number> }>;
  semanas: SemanaPxD[];
  planejamento: LinhaDisponibilidade[];
  hoje: string;
  /** Dias do filtro De/Até do Detalhamento. */
  dias: string[];
}

export function MoNecessidadeBack({ linhas, planejado, semanas, planejamento, hoje, dias }: Props) {
  const futuras = useMemo(() => semanas.filter((w) => w.fim >= hoje), [semanas, hoje]);
  const pessoas = useMemo(() => {
    const dias = futuras.flatMap((w) => w.dias);
    return pessoasPorFuncaoNosDias(planejamento, dias, hoje);
  }, [planejamento, futuras, hoje]);
  const funcoes = useMemo(
    () =>
      linhas
        .filter((l) => !l.sem)
        .map((l) => ({ chave: l.chave, funcao: l.funcao, porDia: planejado.get(l.chave)?.porDia })),
    [linhas, planejado],
  );
  const porSemana = useMemo(
    () =>
      futuras.map((w) => {
        const fs = necessidadeDaSemana(funcoes, pessoas, w.dias);
        const soma = (k: keyof NecessidadeFuncao) =>
          fs.reduce((s, f) => s + (f[k] as number), 0);
        const necessidade = soma("necessidade");
        const faltaFixos = soma("faltaFixos");
        const backPendente = soma("backPendente");
        return {
          semana: w,
          rotulo: w.rotulo,
          funcoes: fs,
          necessidade,
          apontadas: necessidade - faltaFixos,
          faltaFixos,
          backCoberto: soma("backNecessario") - backPendente,
          backPendente,
        };
      }),
    [futuras, funcoes, pessoas],
  );
  // Resumo do período inteiro do filtro (de hoje em diante): média diária no período.
  const diasPeriodo = useMemo(() => dias.filter((d) => d >= hoje), [dias, hoje]);
  const resumoPeriodo = useMemo(() => {
    if (!diasPeriodo.length) return null;
    const fs = necessidadeDaSemana(funcoes, pessoas, diasPeriodo);
    const soma = (k: keyof NecessidadeFuncao) => fs.reduce((s, f) => s + (f[k] as number), 0);
    const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    return {
      rotulo: PERIODO,
      titulo: `Período do filtro (${ddmm(diasPeriodo[0])} a ${ddmm(diasPeriodo[diasPeriodo.length - 1])}, ${diasPeriodo.length} dias)`,
      funcoes: fs,
      faltaFixos: soma('faltaFixos'),
      backPendente: soma('backPendente'),
    };
  }, [diasPeriodo, funcoes, pessoas]);
  const [sel, setSel] = useState<string>(PERIODO);
  const atual =
    (sel === PERIODO ? resumoPeriodo : porSemana.find((s) => s.rotulo === sel)) ??
    resumoPeriodo ??
    porSemana[0];

  if (!porSemana.length) return null;

  return (
    <Card className="space-y-3 border-dashed p-4">
      <div>
        <h3 className="text-sm font-semibold">NECESSIDADE DE MÃO DE OBRA x BACK</h3>
        <p className="text-xs text-muted-foreground">
          Por semana (média dos dias). Barra da esquerda: necessidade = apontadas a bordo + falta de
          fixos. Barra da direita: back necessário (1 por posição) = com cobertura (Disponível, Na Base
          ou Programado livres no dia) + pendente. O detalhe abaixo mostra, por padrão, a média diária do período do filtro De/Até (de hoje em diante); clique numa semana para ver só ela.
        </p>
      </div>
      <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
        <ComposedChart
          data={porSemana}
          margin={{ top: 20, right: 8, bottom: 4, left: 8 }}
          onClick={(e) => e?.activeLabel && setSel(String(e.activeLabel))}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 10 }}
            interval={0} angle={-45} textAnchor="end" height={44} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const s = payload[0].payload as (typeof porSemana)[number];
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">Semana {s.rotulo}</p>
                  <p>Necessidade: {s.necessidade}</p>
                  <p>Apontadas: {s.apontadas}</p>
                  <p className="text-red-600">Falta fixos: {s.faltaFixos}</p>
                  <p>Back com cobertura: {s.backCoberto}</p>
                  <p className="text-amber-600">Back pendente: {s.backPendente}</p>
                  <p className="mt-1 font-semibold">
                    Pendência total: {s.faltaFixos + s.backPendente}
                  </p>
                </div>
              );
            }}
          />
          <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
          <Bar dataKey="apontadas" stackId="fixo" fill="var(--color-apontadas)" />
          <Bar dataKey="faltaFixos" stackId="fixo" fill="var(--color-faltaFixos)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="faltaFixos" position="top" formatter={semZero}
              style={{ fontSize: 10, fontWeight: 700, fill: "#DC2626" }} />
          </Bar>
          <Bar dataKey="backCoberto" stackId="back" fill="var(--color-backCoberto)" />
          <Bar dataKey="backPendente" stackId="back" fill="var(--color-backPendente)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="backPendente" position="top" formatter={semZero}
              style={{ fontSize: 10, fontWeight: 700, fill: "#B45309" }} />
          </Bar>
          <Line dataKey="necessidade" stroke="var(--color-necessidade)" strokeWidth={1.5}
            dot={{ r: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>

      {atual && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">Detalhe</span>
            <select
              className="h-7 rounded border bg-background px-2 text-xs"
              value={atual.rotulo}
              onChange={(e) => setSel(e.target.value)}
            >
              {resumoPeriodo && <option value={PERIODO}>{resumoPeriodo.titulo}</option>}
              {porSemana.map((s) => (
                <option key={s.rotulo} value={s.rotulo}>
                  Semana {s.rotulo}
                </option>
              ))}
            </select>
            {atual.faltaFixos === 0 ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
                Fixos completos{atual.backPendente ? ` · ${atual.backPendente} back pendente` : " · back coberto"}
              </span>
            ) : (
              <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                Pendência: {atual.faltaFixos} fixos + {atual.backPendente} back
              </span>
            )}
          </div>
          <div className="max-h-[420px] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Função</th>
                  <th className="px-2 py-1">Necessidade</th>
                  <th className="px-2 py-1">Apontadas</th>
                  <th className="px-2 py-1">Falta fixos</th>
                  <th className="px-2 py-1">Back nec.</th>
                  <th className="px-2 py-1">Cobertura</th>
                  <th className="px-2 py-1">Back pendente</th>
                  <th className="px-2 py-1 text-left">Quem pode cobrir</th>
                </tr>
              </thead>
              <tbody>
                {atual.funcoes.map((f) => (
                  <tr key={f.funcao} className="border-t">
                    <td className="px-2 py-1 font-medium">{f.funcao}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.necessidade}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.apontadas}</td>
                    <td className={`px-2 py-1 text-center font-bold tabular-nums ${f.faltaFixos ? "bg-red-100 text-red-700" : "text-muted-foreground"}`}>
                      {f.faltaFixos}
                    </td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.backNecessario}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.cobertura}</td>
                    <td className={`px-2 py-1 text-center font-bold tabular-nums ${f.backPendente ? "bg-amber-100 text-amber-700" : "text-muted-foreground"}`}>
                      {f.backPendente}
                    </td>
                    <td className="px-2 py-1 text-[11px] text-muted-foreground">
                      {f.nomesCobertura.length ? f.nomesCobertura.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
