import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdCard } from "lucide-react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { selectAllPages } from "@/lib/supabasePaginate";
import { notify } from "@/lib/notify";
import {
  normMatricula,
  sugerirMatriculas,
  type CadastroDrake,
  type SugestaoMatricula,
} from "@/lib/planejamento-drake-cadastro";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Planejamento de Embarque × cadastro do Drake (pedido dela, 2026-11-18): coluna "Endereço" e
// preenchimento das matrículas que faltam. Regras em src/lib/planejamento-drake-cadastro.ts.

// Tabelas novas ainda fora dos tipos gerados do Supabase.
const supabase = supabaseTyped as unknown as {
  from: (t: string) => any;
};

/**
 * Endereços do Drake por matrícula (sem zeros à esquerda). `null` = sem acesso (só operadores
 * e administradores leem — dado pessoal) ou tabela ainda não criada: a coluna nem aparece.
 */
export function useEnderecosDrake() {
  return useQuery<Map<string, string> | null>({
    queryKey: ["drake-enderecos"],
    queryFn: async () => {
      try {
        const linhas = await selectAllPages<{ matricula_norm: string; endereco: string }>(
          (from, to) =>
            supabase
              .from("drake_enderecos")
              .select("matricula_norm, endereco")
              .order("matricula_norm")
              .range(from, to),
        );
        // RLS devolve lista vazia para quem não é operador; trata como "sem acesso".
        return linhas.length ? new Map(linhas.map((l) => [l.matricula_norm, l.endereco])) : null;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 10 * 60_000,
  });
}

export const enderecoDaLinha = (enderecos: Map<string, string> | null | undefined, matricula: string | null) =>
  enderecos?.get(normMatricula(matricula)) ?? null;

interface LinhaPlan {
  id: string;
  nome: string;
  matricula: string | null;
}

/**
 * Botão "Preencher matrículas (N)": sugere a matrícula de quem está sem ela, pelo nome no cadastro
 * do Histograma (que espelha os ativos do Drake). Mostra a lista para conferir antes de gravar;
 * cada linha gravada entra no Desfazer e no Histórico, como uma edição normal.
 */
export function PreencherMatriculasBotao({
  registros,
  onLinhaAtualizada,
  onConcluido,
}: {
  registros: LinhaPlan[];
  onLinhaAtualizada: (linha: LinhaPlan, matricula: string) => void;
  onConcluido: (descricao: string) => void;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const { data: cadastros = [] } = useQuery<CadastroDrake[]>({
    queryKey: ["planejamento-cadastros-drake"],
    queryFn: () =>
      selectAllPages<CadastroDrake>((from, to) =>
        supabase
          .from("hist_novo_colaboradores")
          .select("nome, matricula, empresa, ativo")
          .order("id")
          .range(from, to),
      ),
    staleTime: 10 * 60_000,
  });
  const sugestoes = useMemo(
    () =>
      sugerirMatriculas(
        registros,
        cadastros,
        registros.map((r) => r.matricula ?? ""),
      ),
    [registros, cadastros],
  );
  const [desmarcadas, setDesmarcadas] = useState<Set<string> | null>(null);
  // Exatas já vêm marcadas; as de nome parecido, desmarcadas (conferir antes).
  const marcadas = useMemo(() => {
    const base = desmarcadas ?? new Set(sugestoes.filter((s) => s.tipo !== "exato").map((s) => s.id));
    return sugestoes.filter((s) => !base.has(s.id));
  }, [sugestoes, desmarcadas]);
  const alternar = (s: SugestaoMatricula) =>
    setDesmarcadas((atual) => {
      const n = new Set(
        atual ?? sugestoes.filter((x) => x.tipo !== "exato").map((x) => x.id),
      );
      if (n.has(s.id)) n.delete(s.id);
      else n.add(s.id);
      return n;
    });

  const aplicar = useMutation({
    mutationFn: async (lista: SugestaoMatricula[]) => {
      let feitas = 0;
      for (const s of lista) {
        const { error } = await supabase
          .from("planejamento_embarque")
          .update({ matricula: s.matricula })
          .eq("id", s.id)
          .or("matricula.is.null,matricula.eq.");
        if (error) throw error;
        const linha = registros.find((r) => r.id === s.id);
        if (linha) onLinhaAtualizada(linha, s.matricula);
        feitas++;
      }
      return feitas;
    },
    onSuccess: (feitas, lista) => {
      notify.success(`${feitas} matrícula(s) preenchida(s).`);
      onConcluido(
        `Preencheu ${feitas} matrícula(s) pelo cadastro do Drake: ` +
          lista.map((s) => `${s.nome} (${s.matricula})`).join(", "),
      );
      setAberto(false);
      setDesmarcadas(null);
    },
    onError: (e: Error) => notify.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["planejamento-embarque"] }),
  });

  if (sugestoes.length === 0) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setAberto(true)}>
        <IdCard className="mr-1.5 h-3.5 w-3.5" />
        Preencher matrículas ({sugestoes.length})
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !aplicar.isPending && setAberto(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preencher matrículas pelo cadastro do Drake</DialogTitle>
            <DialogDescription>
              Pessoas do Planejamento sem matrícula, com o cadastro do Drake de mesmo nome. Confira e
              desmarque o que não for a mesma pessoa. As de nome parecido vêm desmarcadas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="w-8 px-2 py-1.5" />
                  <th className="px-2 py-1.5 text-left font-medium">No Planejamento</th>
                  <th className="px-2 py-1.5 text-left font-medium">No Drake</th>
                  <th className="px-2 py-1.5 text-left font-medium">Matrícula</th>
                </tr>
              </thead>
              <tbody>
                {sugestoes.map((s) => (
                  <tr key={s.id} className={s.tipo === "parecido" ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={marcadas.some((m) => m.id === s.id)}
                        onCheckedChange={() => alternar(s)}
                        aria-label={`Preencher ${s.nome}`}
                      />
                    </td>
                    <td className="px-2 py-1">{s.nome}</td>
                    <td className="px-2 py-1">
                      {s.nomeDrake}
                      {s.tipo === "parecido" && (
                        <span className="ml-1 text-[10px] font-semibold text-amber-700">
                          nome parecido, conferir
                        </span>
                      )}
                      {s.empresa && (
                        <div className="text-[10px] text-muted-foreground">{s.empresa}</div>
                      )}
                    </td>
                    <td className="px-2 py-1 font-semibold tabular-nums">{s.matricula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={aplicar.isPending} onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={marcadas.length === 0}
              loading={aplicar.isPending}
              onClick={() => aplicar.mutate(marcadas)}
            >
              Preencher {marcadas.length} matrícula(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
