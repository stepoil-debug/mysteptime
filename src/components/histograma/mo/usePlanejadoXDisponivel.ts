import { useQuery } from "@tanstack/react-query";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { selectAllPages } from "@/lib/supabasePaginate";
import type { LinhaPlanejadoRpc } from "@/lib/mo-planejado-x-disponivel";

// Dados do "Planejado x Disponível" (pedido dela, 2026-11-12) — ver
// supabase/migrations/20261112000000_mo_depara_editores.sql.

// Tabelas/RPCs novas ainda não estão nos tipos gerados do Supabase.
const supabase: any = supabaseTyped;

/** Começa com "mo-planejado-diario": as mutações da aba M.O já invalidam esse prefixo. */
export const QK_PLANEJADO_DRAKE = ["mo-planejado-diario", "drake"] as const;
export const QK_DEPARA = ["mo-funcao-depara"] as const;

/**
 * Quem vê e edita a aba M.O: lista mo_editores no banco (Bruna e Diego). Enquanto o SQL novo
 * não estiver aplicado (RPC inexistente), cai na regra antiga (`fallback`, qualquer ADM).
 */
export function useMoPodeEditar(fallback: boolean) {
  const q = useQuery<boolean | null>({
    queryKey: ["mo-pode-editar"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mo_pode_editar");
      if (error) return null;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
  return { podeEditar: q.data ?? (q.isFetched ? fallback : false), carregado: q.isFetched };
}

export function usePlanejadoDrakeDiario(inicio: string, fim: string, enabled = true) {
  return useQuery<LinhaPlanejadoRpc[]>({
    queryKey: [...QK_PLANEJADO_DRAKE, inicio, fim],
    enabled: enabled && !!inicio && !!fim && inicio <= fim,
    queryFn: () =>
      selectAllPages<LinhaPlanejadoRpc>((from, to) =>
        supabase.rpc("mo_planejado_drake_diario", { p_inicio: inicio, p_fim: fim }).range(from, to),
      ),
    retry: false,
  });
}

export function useMoPeriodo(enabled = true) {
  return useQuery<{ data_min: string | null; data_max: string | null } | null>({
    queryKey: ["mo-planejado-diario", "periodo"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mo_planejado_periodo");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
    retry: false,
  });
}

export interface MoDepara {
  id: string;
  funcao_padrao: string;
  funcao_drake: string;
}

export function useMoDepara(enabled = true) {
  return useQuery<MoDepara[]>({
    queryKey: QK_DEPARA,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mo_funcao_depara")
        .select("id,funcao_padrao,funcao_drake")
        .order("funcao_padrao");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
}

export async function salvarDepara(funcaoPadrao: string, funcaoDrake: string | null, id?: string) {
  if (!funcaoDrake) {
    if (!id) return;
    const { error } = await supabase.from("mo_funcao_depara").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  if (id) {
    const { error } = await supabase
      .from("mo_funcao_depara")
      .update({ funcao_drake: funcaoDrake })
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("mo_funcao_depara")
      .insert({ funcao_padrao: funcaoPadrao, funcao_drake: funcaoDrake });
    if (error) throw error;
  }
}
