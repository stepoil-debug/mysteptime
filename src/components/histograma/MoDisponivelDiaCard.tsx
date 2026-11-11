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
        Tudo pelo Planejamento de Embarque: hoje = Status "Disponível" (igual ao cartão Stand By);
        nos próximos dias, entra quem termina o ciclo pelas datas (embarque, folga, férias,
        programado) e sai quem tem embarque marcado. Demais Status não contam.
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
                    <span title="Total de M.O da função no Planejamento de Embarque (todos os Status, menos Terceirizado)">
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
                <tr key={f.funcao}>
                  <td className="sticky left-0 z-10 bg-card pr-3 font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={f.funcao}>
                        {f.funcao}
                      </span>
                      {/* Total de M.O da função no Planejamento (pedido dela, 2026-11-11). */}
                      <span
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={`${f.total} pessoa(s) de ${f.funcao} no Planejamento (todos os Status, menos Terceirizado)`}
                      >
                        {f.total}
                      </span>
                    </div>
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
