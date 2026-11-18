import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { disponivelPorFuncaoNosDias } from "@/lib/mo-disponivel";
import {
  CABECALHO_PLANILHA,
  ESTILO_PXD,
  agruparPlanejado,
  corPlanejadoDisponivel,
  diaDaSemana,
  fmtDdMmAaaa,
  mediaDisponivelSemana,
  mediaSemana,
  normFuncao,
  semanasAPartirDe,
} from "@/lib/mo-planejado-x-disponivel";
import { addDiasIso, domingoDaSemana, rotuloSemana } from "@/lib/mo-planejado";
import { usePlanejamentoEmbarqueQuery } from "@/components/histograma/PlanejamentoEmbarqueTab";
import {
  QK_DEPARA,
  salvarDepara,
  useMoDepara,
  useMoPeriodo,
  usePlanejadoDrakeDiario,
  type MoDepara,
} from "@/components/histograma/mo/usePlanejadoXDisponivel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Aba M.O — "De/Para de Funções" e "Detalhamento – Planejado" (pedido dela, 2026-11-12).
// Planejado vem da RPC mo_planejado_drake_diario (servidor, já pelo De/Para); Disponível é a
// mesma regra do card "M.O disponível x Dia" (src/lib/mo-disponivel.ts), sem mudar nada nele.

const SEM_DEPARA = "Função sem correspondência no Drake";

/** Funções Padrão sem De/Para (chave normalizada) — usado também no aviso da grade de registros. */
export function funcoesSemDepara(funcoes: string[], depara: MoDepara[]): Set<string> {
  const ligadas = new Set(depara.map((d) => normFuncao(d.funcao_padrao)));
  return new Set(funcoes.map(normFuncao).filter((f) => f && !ligadas.has(f)));
}

export function DeParaFuncoesSection({ funcoesMo }: { funcoesMo: string[] }) {
  const qc = useQueryClient();
  const { data: depara = [], isLoading, error } = useMoDepara();
  const { data: planejamento = [] } = usePlanejamentoEmbarqueQuery();
  const funcoesDrake = useMemo(
    () =>
      Array.from(
        new Set(planejamento.map((r) => r.funcao?.trim()).filter((f): f is string => !!f)),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [planejamento],
  );
  const linhas = useMemo(() => {
    const porChave = new Map<string, { padrao: string; registro?: MoDepara }>();
    funcoesMo.forEach((f) => porChave.set(normFuncao(f), { padrao: f }));
    depara.forEach((d) => {
      const k = normFuncao(d.funcao_padrao);
      porChave.set(k, { padrao: porChave.get(k)?.padrao ?? d.funcao_padrao, registro: d });
    });
    return Array.from(porChave.values()).sort(
      (a, b) =>
        Number(!!a.registro) - Number(!!b.registro) || a.padrao.localeCompare(b.padrao, "pt-BR"),
    );
  }, [funcoesMo, depara]);
  const semCorrespondencia = linhas.filter((l) => !l.registro).length;

  const salvar = useMutation({
    mutationFn: (v: { padrao: string; drake: string | null; id?: string }) =>
      salvarDepara(v.padrao, v.drake, v.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_DEPARA });
      qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
    },
    onError: (e: Error) => notify.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-sky-700" />
        <h3 className="text-sm font-semibold">De/Para de Funções</h3>
        {semCorrespondencia > 0 && (
          <Badge className="bg-amber-100 font-normal text-amber-900 hover:bg-amber-100">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {semCorrespondencia} sem correspondência
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Liga cada Função Padrão do cliente a uma função do Planejamento de Embarque (a mesma do card
        "M.O disponível x Dia"). Várias Funções Padrão podem apontar para a mesma função. Sem
        De/Para, a função continua no Detalhamento numa linha própria, com disponível 0.
      </p>
      {error ? (
        <p className="text-xs text-destructive">
          Não foi possível ler o De/Para — o SQL 20261112000000_mo_depara_editores.sql já foi
          rodado?
        </p>
      ) : isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Função Padrão (M.O)</th>
                <th className="px-2 py-1.5 text-left font-medium">
                  Função no Drake / Planejamento
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.padrao} className="border-t">
                  <td className="px-2 py-1">
                    <span className="font-medium">{l.padrao}</span>
                    {!l.registro && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> {SEM_DEPARA}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="h-7 w-full max-w-[340px] rounded border bg-background px-1.5 text-xs"
                      value={l.registro?.funcao_drake ?? ""}
                      disabled={salvar.isPending}
                      onChange={(e) =>
                        salvar.mutate({
                          padrao: l.padrao,
                          drake: e.target.value || null,
                          id: l.registro?.id,
                        })
                      }
                    >
                      <option value="">— sem correspondência —</option>
                      {l.registro && !funcoesDrake.some((f) => f === l.registro!.funcao_drake) && (
                        <option value={l.registro.funcao_drake}>{l.registro.funcao_drake}</option>
                      )}
                      {funcoesDrake.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CelulaPxD({ planejado, disponivel }: { planejado: number; disponivel: number | null }) {
  const cor =
    disponivel == null && planejado > 0 ? null : corPlanejadoDisponivel(planejado, disponivel);
  const e = cor ? ESTILO_PXD[cor] : { bg: "#ffffff", border: "#e2e8f0", text: "#334155" };
  return (
    <div
      className="flex h-8 items-center justify-center gap-1 rounded-md border text-xs font-semibold tabular-nums"
      style={{ backgroundColor: e.bg, borderColor: e.border, color: e.text }}
      title={
        disponivel == null
          ? `Planejado ${planejado} (dia que já passou — sem disponível)`
          : `Planejado ${planejado} · Disponível ${disponivel}`
      }
    >
      {planejado || (disponivel == null ? "" : 0)}
      {disponivel != null && (
        <span className="text-[10px] font-normal opacity-75">/ {disponivel}</span>
      )}
    </div>
  );
}

export function LegendaPxD() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      {(Object.keys(ESTILO_PXD) as (keyof typeof ESTILO_PXD)[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border"
            style={{ backgroundColor: ESTILO_PXD[k].bg, borderColor: ESTILO_PXD[k].border }}
          />
          {ESTILO_PXD[k].rotulo}
        </span>
      ))}
    </div>
  );
}

export function DetalhamentoPlanejadoSection({
  funcoesMo,
  hoje,
}: {
  funcoesMo: string[];
  hoje: string;
}) {
  const [inicio, setInicio] = useState(hoje);
  const [nDias, setNDias] = useState(14);
  const diasDiario = useMemo(
    () => Array.from({ length: nDias }, (_, i) => addDiasIso(inicio || hoje, i)),
    [inicio, nDias, hoje],
  );
  const semanas = useMemo(() => semanasAPartirDe(hoje, 18), [hoje]);
  const janela = useMemo(() => {
    const ini = [diasDiario[0], semanas[0].inicio].sort()[0];
    const fim = [diasDiario[diasDiario.length - 1], semanas[semanas.length - 1].fim].sort()[1];
    return { ini, fim };
  }, [diasDiario, semanas]);

  const { data: rpc = [], isLoading, error } = usePlanejadoDrakeDiario(janela.ini, janela.fim);
  const { data: depara = [] } = useMoDepara();
  const { data: periodo } = useMoPeriodo();
  const { data: planejamento = [] } = usePlanejamentoEmbarqueQuery();

  const planejado = useMemo(() => agruparPlanejado(rpc), [rpc]);

  // Linhas = toda função que tem registro na M.O, já pelo De/Para (sem De/Para: linha própria).
  const linhas = useMemo(() => {
    const ligacao = new Map(depara.map((d) => [normFuncao(d.funcao_padrao), d.funcao_drake]));
    const m = new Map<string, { funcao: string; sem: boolean }>();
    funcoesMo.forEach((f) => {
      const drake = ligacao.get(normFuncao(f));
      const nome = drake ?? f;
      const chave = normFuncao(nome) + (drake ? "" : "|sem");
      if (!m.has(chave)) m.set(chave, { funcao: nome, sem: !drake });
    });
    // Garante que nada da RPC fique de fora (ex.: De/Para recém-criado ainda não refletido aqui).
    planejado.forEach((p, chave) => {
      if (!m.has(chave)) m.set(chave, { funcao: p.funcao, sem: p.semCorrespondencia });
    });
    return Array.from(m.entries())
      .map(([chave, v]) => ({ chave, ...v }))
      .sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
  }, [funcoesMo, depara, planejado]);

  const todosDias = useMemo(() => {
    const s = new Set<string>(diasDiario);
    semanas.forEach((w) => w.dias.forEach((d) => s.add(d)));
    return Array.from(s).sort();
  }, [diasDiario, semanas]);
  const disponivel = useMemo(
    () => disponivelPorFuncaoNosDias(planejamento, todosDias, hoje),
    [planejamento, todosDias, hoje],
  );
  const dispDe = (l: { chave: string; sem: boolean }) =>
    l.sem ? undefined : disponivel.get(l.chave)?.porDia;
  const dispNoDia = (l: { chave: string; sem: boolean }, dia: string): number | null =>
    dia < hoje ? null : l.sem ? 0 : (dispDe(l)?.get(dia) ?? 0);

  // Cabeçalho agrupado por semana (dias contíguos com o mesmo nº).
  const gruposSemana = useMemo(() => {
    const out: { rotulo: string; n: number }[] = [];
    diasDiario.forEach((d) => {
      const r = rotuloSemana(domingoDaSemana(d));
      if (out.length && out[out.length - 1].rotulo === r) out[out.length - 1].n++;
      else out.push({ rotulo: r, n: 1 });
    });
    return out;
  }, [diasDiario]);

  const thFixo = "sticky left-0 z-10 bg-muted";
  const tdFixo = "sticky left-0 z-[5] bg-background";

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Detalhamento – Planejado</h3>
        <Badge className="bg-sky-600 hover:bg-sky-600">PLANEJADO</Badge>
        {periodo?.data_min && (
          <span className="text-xs text-muted-foreground">
            Data mínima de embarque: <b>{fmtDdMmAaaa(periodo.data_min)}</b> · Data máxima de
            desembarque: <b>{periodo.data_max ? fmtDdMmAaaa(periodo.data_max) : "—"}</b>
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Planejado = soma das demandas da aba M.O ativas no dia (embarque e desembarque contam),
        exceto BSP ON HOLD. Disponível = regra do card "M.O disponível x Dia" (de hoje em diante).
        Cada célula: planejado / disponível.
      </p>
      <LegendaPxD />

      {error ? (
        <p className="text-xs text-destructive">
          Não foi possível calcular o planejado — o SQL 20261112000000_mo_depara_editores.sql já foi
          rodado?
        </p>
      ) : isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…
        </p>
      ) : (
        <>
          {/* a) Acompanhamento Diário */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acompanhamento Diário
              </h4>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase text-muted-foreground/70">
                  Data inicial
                </Label>
                <Input
                  type="date"
                  className="h-7 w-auto text-xs"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value || hoje)}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase text-muted-foreground/70">Dias</Label>
                <select
                  className="h-7 rounded border bg-background px-1.5 text-xs"
                  value={nDias}
                  onChange={(e) => setNDias(Number(e.target.value))}
                >
                  {[7, 14, 21, 30].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto rounded border">
              <table className="w-max min-w-full border-separate border-spacing-1 text-xs">
                <thead className="sticky top-0 z-20 bg-muted">
                  <tr>
                    <th
                      rowSpan={2}
                      className={`${thFixo} min-w-[220px] px-2 text-left font-medium`}
                    >
                      Função
                    </th>
                    <th rowSpan={2} className="bg-muted px-2 text-center font-medium">
                      M.O Disponível
                      <br />
                      <span className="text-[10px] font-normal text-muted-foreground">hoje</span>
                    </th>
                    {gruposSemana.map((g, i) => (
                      <th
                        key={`${g.rotulo}-${i}`}
                        colSpan={g.n}
                        className="rounded px-1 py-0.5 text-center text-[10px] font-semibold text-black"
                        style={{ backgroundColor: CABECALHO_PLANILHA.semana }}
                      >
                        {g.rotulo}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {diasDiario.map((d) => (
                      <th
                        key={d}
                        className="min-w-[64px] rounded px-1 py-0.5 text-center text-[10px] font-medium text-black"
                        style={{
                          backgroundColor:
                            d === hoje ? CABECALHO_PLANILHA.hoje : CABECALHO_PLANILHA.dia,
                        }}
                      >
                        {diaDaSemana(d)}
                        <br />
                        <span className="font-normal">{fmtDdMmAaaa(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.chave}>
                      <td className={`${tdFixo} px-2 font-medium`}>
                        {l.funcao}
                        {l.sem && (
                          <span
                            className="ml-1 inline-flex align-middle text-amber-600"
                            title={SEM_DEPARA}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                      <td
                        className="text-center font-bold tabular-nums"
                        style={{ color: CABECALHO_PLANILHA.disponivelTexto }}
                      >
                        {l.sem ? 0 : (dispDe(l)?.get(hoje) ?? 0)}
                      </td>
                      {diasDiario.map((d) => (
                        <td key={d}>
                          <CelulaPxD
                            planejado={planejado.get(l.chave)?.porDia.get(d) ?? 0}
                            disponivel={dispNoDia(l, d)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className={`${tdFixo} px-2 font-bold`}>TOTAL PLANEJADO</td>
                    <td />
                    {diasDiario.map((d) => (
                      <td key={d} className="text-center font-bold tabular-nums">
                        {linhas.reduce(
                          (s, l) => s + (planejado.get(l.chave)?.porDia.get(d) ?? 0),
                          0,
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* b) Acompanhamento Semanal */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acompanhamento Semanal
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Média dos 7 dias (domingo a sábado), arredondada — planejado / disponível médio da
              semana (o disponível só conta os dias de hoje em diante).
            </p>
            <div className="max-h-[480px] overflow-auto rounded border">
              <table className="w-max min-w-full border-separate border-spacing-1 text-xs">
                <thead className="sticky top-0 z-20 bg-muted">
                  <tr>
                    <th
                      className={`${thFixo} min-w-[220px] px-2 text-left text-[10px] font-medium`}
                    >
                      Prim. dia sem.
                    </th>
                    {semanas.map((w) => (
                      <th
                        key={w.inicio}
                        className={`min-w-[72px] rounded px-1 py-0.5 text-center text-[10px] font-normal ${w.dias.includes(hoje) ? "bg-sky-600 text-white" : ""}`}
                      >
                        {fmtDdMmAaaa(w.inicio)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className={`${thFixo} px-2 text-left text-[10px] font-medium`}>Semana</th>
                    {semanas.map((w) => (
                      <th
                        key={w.inicio}
                        className="px-1 py-0.5 text-center text-[10px] font-semibold"
                      >
                        {w.rotulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.chave}>
                      <td className={`${tdFixo} px-2 font-medium`}>
                        {l.funcao}
                        {l.sem && (
                          <span
                            className="ml-1 inline-flex align-middle text-amber-600"
                            title={SEM_DEPARA}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                      {semanas.map((w) => {
                        const p = mediaSemana(planejado.get(l.chave)?.porDia, w.dias);
                        const dispSemana = l.sem
                          ? 0
                          : mediaDisponivelSemana(
                              new Map(w.dias.map((d) => [d, dispNoDia(l, d)])),
                              w.dias,
                            );
                        return (
                          <td key={w.inicio}>
                            <CelulaPxD planejado={p} disponivel={dispSemana} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className={`${tdFixo} px-2 font-bold`}>TOTAL PLANEJADO</td>
                    {semanas.map((w) => (
                      <td key={w.inicio} className="text-center font-bold tabular-nums">
                        {linhas.reduce(
                          (s, l) => s + mediaSemana(planejado.get(l.chave)?.porDia, w.dias),
                          0,
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
