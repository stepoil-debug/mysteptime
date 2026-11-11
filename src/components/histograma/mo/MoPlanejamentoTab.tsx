import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  History,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { todayStr } from "@/lib/histogramaNovo";
import {
  MO_STATUS_BSP,
  addDiasIso,
  ehEncerrada,
  ehOnHold,
  headcountDiario,
  janelaGraficos,
  linhaConta,
  normalizarTexto,
  totalPorDia,
} from "@/lib/mo-planejado";
import {
  parseColagemMo,
  matrizDesdeA1,
  parsePlanilhaMo,
  pareceBlocoExcel,
  type MoLinhaImportada,
} from "@/lib/mo-planejado-import";
import { StringMultiCombobox } from "@/components/histograma/HistogramaOffshoreNovo";
import { MoPlanejadoGraficos } from "@/components/histograma/mo/MoPlanejadoGraficos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Aba "M.O — Mão de Obra Planejada" (pedido dela, 2026-11-09): a liderança (qualquer ADM —
// ver canEditMoPlanejamento em access-roles.ts / is_system_admin no banco) preenche a mão de
// obra PLANEJADA como numa planilha. Alimenta os gráficos de planejado do Dashboard.

// mo_planejamento ainda não está nos tipos gerados do Supabase.
const supabase: any = supabaseTyped;
const TABELA = "mo_planejamento";
const QUERY_KEY = ["mo-planejamento"];

export interface MoRegistro {
  id: string;
  qtd: number;
  funcao: string;
  unidade: string;
  pm: string | null;
  bsp: string | null;
  data_embarque: string;
  data_desembarque: string;
  observacao: string | null;
  updated_at: string;
}

type Campos = Omit<MoRegistro, "id" | "updated_at" | "observacao">;
type NovaLinha = Campos & { observacao?: string | null };

const COLUNAS = [
  "qtd",
  "funcao",
  "unidade",
  "pm",
  "bsp",
  "data_embarque",
  "data_desembarque",
] as const;
type Coluna = (typeof COLUNAS)[number];

const fmtBr = (iso: string) => iso.split("-").reverse().join("/");

async function inserirLinhas(linhas: NovaLinha[]) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from(TABELA).insert(linhas.slice(i, i + 500));
    if (error) throw error;
  }
}

function validar(c: Campos): string | null {
  if (!Number.isInteger(c.qtd) || c.qtd < 0) return "QTD inválida";
  if (!c.funcao) return "Função vazia";
  if (!c.unidade) return "Unidade vazia";
  if (!c.data_embarque || !c.data_desembarque) return "Data vazia";
  if (c.data_desembarque < c.data_embarque) return "Desembarque antes do embarque";
  return null;
}

const importadaParaNova = (r: MoLinhaImportada): NovaLinha => ({
  qtd: r.qtd ?? 0,
  funcao: r.funcao,
  unidade: r.unidade,
  pm: r.pm,
  bsp: r.bsp,
  data_embarque: r.data_embarque!,
  data_desembarque: r.data_desembarque!,
});

function exportarXlsx(linhas: MoRegistro[]) {
  // Mesmo layout da aba "M.O" da planilha: título na linha 1, cabeçalho na 2, dados da 3, B:H.
  const aoa: (string | number | Date)[][] = [
    ["", "M.O"],
    ["", "QTD", "FUNÇÃO PADRÃO", "UNID", "PM", "BSP", "DATA EMB.", "DATA DES"],
    ...linhas.map((l) => [
      "",
      l.qtd,
      l.funcao,
      l.unidade,
      l.pm ?? "",
      l.bsp ?? "",
      fmtBr(l.data_embarque),
      fmtBr(l.data_desembarque),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 2 },
    { wch: 6 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "M.O");
  XLSX.writeFile(wb, `mo_planejado_${todayStr()}.xlsx`);
}

// Move o foco entre células como numa planilha: Enter desce na mesma coluna (Shift+Enter sobe).
function focarCelula(linha: number, coluna: number) {
  const el = document.querySelector<HTMLInputElement>(`[data-mo-cell="${linha}:${coluna}"]`);
  el?.focus();
  el?.select?.();
}

// ── Linha editável ──────────────────────────────────────────────────────────

function LinhaMo({
  registro,
  indice,
  onSalvo,
  onDuplicar,
  onExcluir,
  hoje,
}: {
  registro: MoRegistro;
  indice: number;
  onSalvo: (r: MoRegistro) => void;
  onDuplicar: (r: MoRegistro) => void;
  onExcluir: (r: MoRegistro) => void;
  hoje: string;
}) {
  const [rascunho, setRascunho] = useState({
    qtd: String(registro.qtd),
    funcao: registro.funcao,
    unidade: registro.unidade,
    pm: registro.pm ?? "",
    bsp: registro.bsp ?? "",
    data_embarque: registro.data_embarque,
    data_desembarque: registro.data_desembarque,
  });
  const [estado, setEstado] = useState<"salvo" | "pendente" | "salvando" | string>("salvo");
  const sujo = useRef(false);

  // Salvamento automático (debounce) — só manda quando a linha está válida.
  useEffect(() => {
    if (!sujo.current) return;
    setEstado("pendente");
    const t = setTimeout(async () => {
      const campos: Campos = {
        qtd: Number(rascunho.qtd),
        funcao: normalizarTexto(rascunho.funcao),
        unidade: normalizarTexto(rascunho.unidade),
        pm: normalizarTexto(rascunho.pm) || null,
        bsp:
          rascunho.bsp
            .split("\n")
            .map((l) => normalizarTexto(l))
            .filter(Boolean)
            .join("\n") || null,
        data_embarque: rascunho.data_embarque,
        data_desembarque: rascunho.data_desembarque,
      };
      const erro = rascunho.qtd.trim() === "" ? "QTD inválida" : validar(campos);
      if (erro) {
        setEstado(erro);
        return;
      }
      setEstado("salvando");
      const { data, error } = await supabase
        .from(TABELA)
        .update(campos)
        .eq("id", registro.id)
        .select()
        .single();
      if (error) {
        setEstado(error.message);
        return;
      }
      sujo.current = false;
      setEstado("salvo");
      onSalvo(data as MoRegistro);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho]);

  const set = (campo: Coluna, valor: string) => {
    sujo.current = true;
    setRascunho((r) => ({ ...r, [campo]: valor }));
  };
  const normalizarAoSair = (campo: "funcao" | "unidade" | "pm") => {
    const v = normalizarTexto(rascunho[campo]);
    if (v !== rascunho[campo]) set(campo, v);
  };

  const onHold = ehOnHold(rascunho.bsp);
  const encerrada = ehEncerrada(rascunho.bsp);
  const passou = rascunho.data_desembarque && rascunho.data_desembarque < hoje;
  const riscado = onHold ? "line-through text-muted-foreground" : "";
  const celula = `h-7 rounded-sm border-transparent bg-transparent px-1.5 text-xs shadow-none hover:border-border focus-visible:border-ring ${riscado}`;

  const teclado = (coluna: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focarCelula(indice + (e.shiftKey ? -1 : 1), coluna);
    }
  };
  const props = (coluna: number) => ({
    "data-mo-cell": `${indice}:${coluna}`,
    onKeyDown: teclado(coluna),
  });

  return (
    <tr
      className={`border-b ${onHold ? "bg-muted/60" : ""} ${encerrada ? "opacity-60" : ""}`}
      title={onHold ? "ON HOLD — não entra no planejado" : undefined}
    >
      <td className="w-16 px-1 py-0.5">
        <Input
          {...props(0)}
          type="number"
          min={0}
          inputMode="numeric"
          className={`${celula} w-14 text-right`}
          value={rascunho.qtd}
          onChange={(e) => set("qtd", e.target.value)}
        />
      </td>
      <td className="min-w-[180px] px-1 py-0.5">
        <Input
          {...props(1)}
          list="mo-lista-funcao"
          className={celula}
          value={rascunho.funcao}
          onChange={(e) => set("funcao", e.target.value)}
          onBlur={() => normalizarAoSair("funcao")}
        />
      </td>
      <td className="min-w-[150px] px-1 py-0.5">
        <Input
          {...props(2)}
          list="mo-lista-unidade"
          className={celula}
          value={rascunho.unidade}
          onChange={(e) => set("unidade", e.target.value)}
          onBlur={() => normalizarAoSair("unidade")}
        />
      </td>
      <td className="min-w-[120px] px-1 py-0.5">
        <Input
          {...props(3)}
          list="mo-lista-pm"
          className={celula}
          value={rascunho.pm}
          onChange={(e) => set("pm", e.target.value)}
          onBlur={() => normalizarAoSair("pm")}
        />
      </td>
      <td className="min-w-[140px] px-1 py-0.5">
        <Input
          {...props(4)}
          list="mo-lista-bsp"
          className={celula}
          title={rascunho.bsp || undefined}
          value={rascunho.bsp.replace(/\n/g, " / ")}
          onChange={(e) => set("bsp", e.target.value.replace(/ \/ /g, "\n"))}
        />
      </td>
      <td className="w-[132px] px-1 py-0.5">
        <Input
          {...props(5)}
          type="date"
          className={celula}
          value={rascunho.data_embarque}
          onChange={(e) => set("data_embarque", e.target.value)}
        />
      </td>
      <td className="w-[150px] px-1 py-0.5">
        <div className="flex items-center gap-1">
          <Input
            {...props(6)}
            type="date"
            className={`${celula} ${rascunho.data_desembarque < rascunho.data_embarque ? "text-destructive" : ""}`}
            value={rascunho.data_desembarque}
            onChange={(e) => set("data_desembarque", e.target.value)}
          />
          {passou && (
            <span title="Desembarque já passou">
              <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </span>
          )}
        </div>
      </td>
      <td className="w-[104px] px-1 py-0.5">
        <div className="flex items-center gap-0.5">
          <span className="w-5" title={estado === "salvo" ? "Salvo" : estado}>
            {estado === "salvo" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : estado === "salvando" || estado === "pendente" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Duplicar"
            onClick={() => onDuplicar(registro)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            title="Excluir"
            onClick={() => onExcluir(registro)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── "+ Adicionar equipe": unidade/PM/BSP/datas uma vez, várias funções ──────────

function AdicionarEquipeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [comum, setComum] = useState({
    unidade: "",
    pm: "",
    bsp: "",
    data_embarque: "",
    data_desembarque: "",
  });
  const [funcoes, setFuncoes] = useState([{ funcao: "", qtd: "1" }]);
  const salvar = useMutation({
    mutationFn: async () => {
      const linhas: NovaLinha[] = funcoes
        .filter((f) => f.funcao.trim())
        .map((f) => ({
          qtd: Number(f.qtd),
          funcao: normalizarTexto(f.funcao),
          unidade: normalizarTexto(comum.unidade),
          pm: normalizarTexto(comum.pm) || null,
          bsp: normalizarTexto(comum.bsp) || null,
          data_embarque: comum.data_embarque,
          data_desembarque: comum.data_desembarque,
        }));
      if (linhas.length === 0) throw new Error("Informe pelo menos uma função.");
      for (const l of linhas) {
        const erro = validar(l);
        if (erro) throw new Error(`${l.funcao}: ${erro}`);
      }
      await inserirLinhas(linhas);
      return linhas.length;
    },
    onSuccess: (n) => {
      notify.success(`${n} linha(s) adicionada(s).`);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
      onClose();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar equipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Unidade *</Label>
              <Input
                list="mo-lista-unidade"
                value={comum.unidade}
                onChange={(e) => setComum({ ...comum, unidade: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>PM</Label>
              <Input
                list="mo-lista-pm"
                value={comum.pm}
                onChange={(e) => setComum({ ...comum, pm: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>BSP</Label>
              <Input
                list="mo-lista-bsp"
                value={comum.bsp}
                onChange={(e) => setComum({ ...comum, bsp: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data emb. *</Label>
              <Input
                type="date"
                value={comum.data_embarque}
                onChange={(e) => setComum({ ...comum, data_embarque: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data des. *</Label>
              <Input
                type="date"
                value={comum.data_desembarque}
                onChange={(e) => setComum({ ...comum, data_desembarque: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Funções</Label>
            {funcoes.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  list="mo-lista-funcao"
                  placeholder="Função"
                  value={f.funcao}
                  onChange={(e) =>
                    setFuncoes(
                      funcoes.map((x, j) => (j === i ? { ...x, funcao: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={f.qtd}
                  onChange={(e) =>
                    setFuncoes(funcoes.map((x, j) => (j === i ? { ...x, qtd: e.target.value } : x)))
                  }
                />
                {funcoes.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setFuncoes(funcoes.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFuncoes([...funcoes, { funcao: "", qtd: "1" }])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar função
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar equipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pré-visualização de colagem / importação ─────────────────────────────────

function ImportarMoDialog({
  linhas,
  origem,
  onClose,
}: {
  linhas: MoLinhaImportada[];
  origem: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const validas = linhas.filter((l) => l.erros.length === 0);
  const importar = useMutation({
    mutationFn: () => inserirLinhas(validas.map(importadaParaNova)),
    onSuccess: () => {
      notify.success(`${validas.length} linha(s) importada(s).`);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
      onClose();
    },
    onError: (e: Error) => notify.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar M.O — {origem}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {validas.length} de {linhas.length} linha(s) válida(s).
          {linhas.length > validas.length &&
            " As linhas com erro (em vermelho) não serão importadas."}
        </p>
        <div className="max-h-[55vh] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {["Linha", "QTD", "Função", "Unid", "PM", "BSP", "Emb.", "Des.", "Situação"].map(
                  (h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.linha}
                  className={`border-t ${l.erros.length ? "bg-red-50 text-red-900" : ""}`}
                >
                  <td className="px-2 py-1">{l.linha}</td>
                  <td className="px-2 py-1">{l.qtd ?? "—"}</td>
                  <td className="px-2 py-1">{l.funcao || "—"}</td>
                  <td className="px-2 py-1">{l.unidade || "—"}</td>
                  <td className="px-2 py-1">{l.pm ?? "—"}</td>
                  <td className="whitespace-pre-line px-2 py-1">{l.bsp ?? "—"}</td>
                  <td className="px-2 py-1">{l.data_embarque ? fmtBr(l.data_embarque) : "—"}</td>
                  <td className="px-2 py-1">
                    {l.data_desembarque ? fmtBr(l.data_desembarque) : "—"}
                  </td>
                  <td className="px-2 py-1">{l.erros.length ? l.erros.join("; ") : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={validas.length === 0}
            loading={importar.isPending}
            onClick={() => importar.mutate()}
          >
            Importar {validas.length} linha(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba ──────────────────────────────────────────────────────────────────────

export function MoPlanejamentoTab() {
  const qc = useQueryClient();
  const hoje = todayStr();
  const { data: registros = [], isLoading } = useQuery<MoRegistro[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABELA)
        .select("*")
        .order("unidade")
        .order("data_embarque")
        .order("funcao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([]);
  const [filtroPm, setFiltroPm] = useState<string[]>([]);
  const [filtroBsp, setFiltroBsp] = useState<string[]>([]);
  const [filtroFuncao, setFiltroFuncao] = useState<string[]>([]);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [ocultarEncerradas, setOcultarEncerradas] = useState(false);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [adicionando, setAdicionando] = useState(false);
  const [importacao, setImportacao] = useState<{
    linhas: MoLinhaImportada[];
    origem: string;
  } | null>(null);
  const [excluindo, setExcluindo] = useState<MoRegistro | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const opcoes = useMemo(() => {
    const uniq = (v: (string | null)[]) =>
      Array.from(new Set(v.filter((x): x is string => !!x))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      );
    return {
      funcao: uniq(registros.map((r) => r.funcao)),
      unidade: uniq(registros.map((r) => r.unidade)),
      pm: uniq(registros.map((r) => r.pm)),
      bsp: uniq([...MO_STATUS_BSP, ...registros.map((r) => r.bsp)]),
    };
  }, [registros]);

  const filtrados = useMemo(
    () =>
      registros.filter(
        (r) =>
          (filtroUnidade.length === 0 || filtroUnidade.includes(r.unidade)) &&
          (filtroPm.length === 0 || (r.pm != null && filtroPm.includes(r.pm))) &&
          (filtroBsp.length === 0 || (r.bsp != null && filtroBsp.includes(r.bsp))) &&
          (filtroFuncao.length === 0 || filtroFuncao.includes(r.funcao)) &&
          (!de || r.data_desembarque >= de) &&
          (!ate || r.data_embarque <= ate) &&
          (!ocultarEncerradas || !ehEncerrada(r.bsp)),
      ),
    [registros, filtroUnidade, filtroPm, filtroBsp, filtroFuncao, de, ate, ocultarEncerradas],
  );

  const grupos = useMemo(() => {
    const m = new Map<string, MoRegistro[]>();
    filtrados.forEach((r) => {
      if (!m.has(r.unidade)) m.set(r.unidade, []);
      m.get(r.unidade)!.push(r);
    });
    return Array.from(m.entries());
  }, [filtrados]);

  const resumo = useMemo(() => {
    const ativasHoje = filtrados.filter(
      (r) => linhaConta(r) && r.data_embarque <= hoje && r.data_desembarque >= hoje,
    );
    const proximos = totalPorDia(headcountDiario(filtrados, hoje, addDiasIso(hoje, 29)));
    return {
      hoje: ativasHoje.reduce((s, r) => s + r.qtd, 0),
      pico: Math.max(0, ...proximos.values()),
      onHold: filtrados.filter((r) => ehOnHold(r.bsp)).length,
      unidades: new Set(ativasHoje.map((r) => r.unidade)).size,
    };
  }, [filtrados, hoje]);

  const previa = useMemo(() => {
    const j = janelaGraficos(hoje);
    return headcountDiario(filtrados, j.inicio, j.fim);
  }, [filtrados, hoje]);

  const atualizarCache = (r: MoRegistro) => {
    qc.setQueryData<MoRegistro[]>(QUERY_KEY, (old) => old?.map((x) => (x.id === r.id ? r : x)));
    qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
    qc.invalidateQueries({ queryKey: ["mo-planejado-ultima-atualizacao"] });
  };

  const inserir = useMutation({
    mutationFn: (linhas: NovaLinha[]) => inserirLinhas(linhas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
    },
    onError: (e: Error) => notify.error(e.message),
  });
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABELA).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setExcluindo(null);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["mo-planejado-diario"] });
      notify.success("Linha excluída.");
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const duplicar = (r: MoRegistro) =>
    inserir.mutate([
      {
        qtd: r.qtd,
        funcao: r.funcao,
        unidade: r.unidade,
        pm: r.pm,
        bsp: r.bsp,
        data_embarque: r.data_embarque,
        data_desembarque: r.data_desembarque,
        observacao: r.observacao,
      },
    ]);
  const novaLinha = () => {
    const base = filtrados[filtrados.length - 1];
    inserir.mutate([
      {
        qtd: 1,
        funcao: base?.funcao ?? "NOVA FUNÇÃO",
        unidade: base?.unidade ?? "NOVA UNIDADE",
        pm: base?.pm ?? null,
        bsp: base?.bsp ?? "EM PLANEJAMENTO",
        data_embarque: base?.data_embarque ?? hoje,
        data_desembarque: base?.data_desembarque ?? hoje,
      },
    ]);
  };

  // Colar do Excel em qualquer ponto da aba: um bloco com tabulação abre a pré-visualização
  // (colar texto simples numa célula continua normal).
  const onPaste = (e: React.ClipboardEvent) => {
    const texto = e.clipboardData.getData("text/plain");
    if (!pareceBlocoExcel(texto)) return;
    e.preventDefault();
    const linhas = parseColagemMo(texto);
    if (linhas.length === 0) {
      notify.error("Nada reconhecido no que foi colado. Copie as colunas B:H da aba M.O.");
      return;
    }
    setImportacao({ linhas, origem: "colado do Excel" });
  };

  const lerArquivo = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const nome = wb.SheetNames.find((n) => n.trim().toUpperCase() === "M.O");
      if (!nome) {
        notify.error('A planilha não tem a aba "M.O".');
        return;
      }
      const linhas = parsePlanilhaMo(matrizDesdeA1(wb.Sheets[nome]));
      if (linhas.length === 0) {
        notify.error(
          "Nenhuma linha encontrada na aba M.O (dados a partir da linha 3, colunas B:H).",
        );
        return;
      }
      setImportacao({ linhas, origem: file.name });
    } catch (err) {
      notify.error(`Não foi possível ler a planilha: ${(err as Error).message}`);
    }
  };

  let indice = 0;
  const filtroAtivo =
    filtroUnidade.length + filtroPm.length + filtroBsp.length + filtroFuncao.length > 0 ||
    !!de ||
    !!ate ||
    ocultarEncerradas;

  return (
    <div className="space-y-4" onPaste={onPaste}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">M.O — Mão de Obra Planejada</h2>
          <Badge className="bg-sky-600 hover:bg-sky-600">PLANEJADO</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Preenchimento exclusivo da liderança. Alimenta os gráficos de planejado no Dashboard.
        </p>
      </div>

      <datalist id="mo-lista-funcao">
        {opcoes.funcao.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="mo-lista-unidade">
        {opcoes.unidade.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="mo-lista-pm">
        {opcoes.pm.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="mo-lista-bsp">
        {opcoes.bsp.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Planejado hoje", resumo.hoje],
          ["Pico próximos 30 dias", resumo.pico],
          ["Linhas ON HOLD", resumo.onHold],
          ["Unidades ativas", resumo.unidades],
        ].map(([titulo, valor]) => (
          <Card key={titulo} className="border-dashed p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {titulo}
            </p>
            <p className="text-2xl font-bold">{valor}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {(
          [
            ["Unidade", opcoes.unidade, filtroUnidade, setFiltroUnidade],
            ["PM", opcoes.pm, filtroPm, setFiltroPm],
            ["BSP / status", opcoes.bsp, filtroBsp, setFiltroBsp],
            ["Função", opcoes.funcao, filtroFuncao, setFiltroFuncao],
          ] as const
        ).map(([rotulo, opts, valor, set]) => (
          <div key={rotulo} className="w-44 space-y-0.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {rotulo}
            </Label>
            <StringMultiCombobox options={opts} value={valor} onChange={set} />
          </div>
        ))}
        <div className="space-y-0.5">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/70">De</Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Até
          </Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </div>
        <label className="flex h-8 items-center gap-2 text-xs">
          <Switch checked={ocultarEncerradas} onCheckedChange={setOcultarEncerradas} />
          Ocultar ENCERRADAS
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAdicionando(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar equipe
        </Button>
        <Button size="sm" variant="outline" loading={inserir.isPending} onClick={novaLinha}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Linha
        </Button>
        <Button size="sm" variant="outline" onClick={() => arquivoRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Importar planilha (.xlsx)
        </Button>
        <input
          ref={arquivoRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void lerArquivo(f);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={filtrados.length === 0}
          onClick={() => exportarXlsx(filtrados)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar .xlsx
        </Button>
        <p className="self-center text-[11px] text-muted-foreground">
          Dica: copie as colunas B:H da aba M.O no Excel e cole aqui (Ctrl+V). Enter desce de linha;
          Tab passa de célula; tudo salva sozinho.
        </p>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {["QTD", "FUNÇÃO PADRÃO", "UNID", "PM", "BSP", "DATA EMB.", "DATA DES", ""].map(
                (h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && grupos.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  {filtroAtivo
                    ? "Nenhuma linha com esses filtros."
                    : "Nenhum M.O planejado cadastrado. Use “Adicionar equipe”, cole do Excel ou importe a planilha."}
                </td>
              </tr>
            )}
            {grupos.map(([unidade, linhas]) => {
              const fechado = recolhidas.has(unidade);
              const subtotal = linhas
                .filter((l) => !ehOnHold(l.bsp))
                .reduce((s, l) => s + l.qtd, 0);
              return (
                <Fragment key={unidade}>
                  <tr className="border-y bg-muted/40">
                    <td colSpan={8} className="px-2 py-1">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 font-semibold"
                        onClick={() =>
                          setRecolhidas((s) => {
                            const n = new Set(s);
                            if (n.has(unidade)) n.delete(unidade);
                            else n.add(unidade);
                            return n;
                          })
                        }
                      >
                        {fechado ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        {unidade}
                        <span className="font-normal text-muted-foreground">
                          · {linhas.length} linha(s) · subtotal QTD {subtotal}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!fechado &&
                    linhas.map((r) => (
                      <LinhaMo
                        key={r.id}
                        registro={r}
                        indice={indice++}
                        hoje={hoje}
                        onSalvo={atualizarCache}
                        onDuplicar={duplicar}
                        onExcluir={setExcluindo}
                      />
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Prévia dos gráficos de planejado (Dashboard)</h3>
        <p className="text-xs text-muted-foreground">
          Calculada com as linhas filtradas acima. No Dashboard aparecem exatamente estes gráficos, com
          todas as linhas (sem filtro).
        </p>
        <MoPlanejadoGraficos diario={previa} hoje={hoje} />
      </div>

      {adicionando && <AdicionarEquipeDialog onClose={() => setAdicionando(false)} />}
      {importacao && (
        <ImportarMoDialog
          linhas={importacao.linhas}
          origem={importacao.origem}
          onClose={() => setImportacao(null)}
        />
      )}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir linha do M.O?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo &&
                `${excluindo.qtd} × ${excluindo.funcao} — ${excluindo.unidade} (${fmtBr(excluindo.data_embarque)} a ${fmtBr(excluindo.data_desembarque)}). Não dá pra desfazer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
