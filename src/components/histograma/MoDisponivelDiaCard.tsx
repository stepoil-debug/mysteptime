import { useMemo } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { moDisponivelPorDia, type LinhaDisponibilidade } from "@/lib/mo-disponivel";

// "M.O disponível x Dia" (pedido dela, 2026-11-10) — substitui o "POB x Unidade" no Dashboard.
// Só dados do Planejamento de Embarque; regra em src/lib/mo-disponivel.ts. Verde = tem alguém
// disponível da função no dia; vermelho = ninguém.

const DIA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function MoDisponivelDiaCard({
  linhas,
  hoje,
  nDias = 14,
}: {
  linhas: LinhaDisponibilidade[];
  hoje: string;
  nDias?: number;
}) {
  const { dias, funcoes } = useMemo(
    () => moDisponivelPorDia(linhas, hoje, nDias),
    [linhas, hoje, nDias],
  );

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">M.O disponível x Dia</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Pessoas disponíveis por função nos próximos {nDias} dias, pelo Planejamento de Embarque
        (Status e datas de embarque, folga, férias e programado). Terceirizados e bloqueados não
        entram.
      </p>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Com
          disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> Nenhum disponível
        </span>
      </div>
      {funcoes.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum colaborador no Planejamento de Embarque" />
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card" />
                {dias.map((d) => {
                  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
                  return (
                    <th key={d} className="min-w-[38px] px-0.5 text-center font-medium">
                      <div className="text-muted-foreground">{DIA_SEMANA[dow]}</div>
                      <div>{d.slice(8, 10)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {funcoes.map((f) => (
                <tr key={f.funcao}>
                  <td
                    className="sticky left-0 z-10 max-w-[200px] truncate bg-card pr-3 font-medium"
                    title={f.funcao}
                  >
                    {f.funcao}
                  </td>
                  {f.porDia.map((c) => (
                    <td key={c.dia} className="p-0">
                      <HoverCard openDelay={120} closeDelay={60}>
                        <HoverCardTrigger asChild>
                          <div
                            className={cn(
                              "flex h-8 cursor-default items-center justify-center rounded-md border font-semibold tabular-nums",
                              c.qtd > 0
                                ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
                            )}
                          >
                            {c.qtd}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-60 p-2.5" side="top">
                          <p className="text-xs font-semibold">
                            {f.funcao} · {c.dia.slice(8, 10)}/{c.dia.slice(5, 7)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.qtd} disponível(is)
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
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
