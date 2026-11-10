-- M.O — Mão de Obra Planejada (pedido dela, 2026-11-09): a liderança preenche a mão de obra
-- PLANEJADA por contrato/unidade (antes na aba "M.O" de uma planilha Excel) e o Dashboard do
-- Histograma Offshore ganha os gráficos de planejado da "Apresentação 1 - Planejado".
-- Dados planejados NUNCA se misturam com o realizado (Drake/Lançamentos).
--
-- Permissão: qualquer ADM (administrador ou diretoria — mesmo grupo de hasSystemAdminAccess em
-- src/lib/access-roles.ts) vê e edita. Não cria papel nem altera o papel de ninguém. Os demais
-- só enxergam os totais pelo Dashboard, via RPC, nunca as linhas.

CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('administrador', 'diretoria')
  )
$$;

CREATE TABLE IF NOT EXISTS public.mo_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qtd integer NOT NULL DEFAULT 0 CHECK (qtd >= 0),
  funcao text NOT NULL,
  unidade text NOT NULL,
  pm text,
  bsp text,
  data_embarque date NOT NULL,
  data_desembarque date NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT mo_planejamento_datas CHECK (data_desembarque >= data_embarque)
);

CREATE OR REPLACE FUNCTION public.mo_planejamento_carimbo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mo_planejamento_carimbo ON public.mo_planejamento;
CREATE TRIGGER mo_planejamento_carimbo
  BEFORE INSERT OR UPDATE ON public.mo_planejamento
  FOR EACH ROW EXECUTE FUNCTION public.mo_planejamento_carimbo();

ALTER TABLE public.mo_planejamento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_planejamento TO authenticated;

DROP POLICY IF EXISTS mo_planejamento_admin ON public.mo_planejamento;
CREATE POLICY mo_planejamento_admin ON public.mo_planejamento FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Comparação "contém", sem caixa/acento — os filtros do Dashboard usam os nomes do Drake
-- ("FPSO - ANNA NERY") e o M.O usa texto livre ("ANNA NERY"). BSP sem o prefixo "BSP".
CREATE OR REPLACE FUNCTION public.mo_norm(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(upper(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.mo_casa(valor text, filtros text[], tira_bsp boolean DEFAULT false)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length(filtros, 1), 0) = 0 OR EXISTS (
    SELECT 1 FROM unnest(filtros) f
    CROSS JOIN LATERAL (
      SELECT CASE WHEN tira_bsp THEN regexp_replace(public.mo_norm(valor), '^BSP\s*', '') ELSE public.mo_norm(valor) END AS v,
             CASE WHEN tira_bsp THEN regexp_replace(public.mo_norm(f), '^BSP\s*', '') ELSE public.mo_norm(f) END AS q
    ) n
    WHERE length(n.q) >= 3 AND length(n.v) >= 3
      AND (n.v LIKE '%' || n.q || '%' OR n.q LIKE '%' || n.v || '%')
  )
$$;

-- Headcount planejado por dia e função. Mesma regra de src/lib/mo-planejado.ts: só qtd > 0 e
-- BSP diferente de "ON HOLD" (ENCERRADA conta); embarque e desembarque inclusivos.
CREATE OR REPLACE FUNCTION public.mo_planejado_diario(
  p_inicio date, p_fim date, p_unidades text[] DEFAULT NULL, p_bsps text[] DEFAULT NULL
)
RETURNS TABLE (dia date, funcao text, qtd_total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d::date, m.funcao, sum(m.qtd)
  FROM public.mo_planejamento m
  CROSS JOIN LATERAL generate_series(
    greatest(m.data_embarque, p_inicio), least(m.data_desembarque, p_fim), interval '1 day'
  ) d
  WHERE auth.uid() IS NOT NULL
    AND p_fim - p_inicio <= 800
    AND m.qtd > 0
    AND public.mo_norm(m.bsp) <> 'ON HOLD'
    AND public.mo_casa(m.unidade, p_unidades)
    AND public.mo_casa(m.bsp, p_bsps, true)
  GROUP BY 1, 2
  ORDER BY 1, 2
$$;

CREATE OR REPLACE FUNCTION public.mo_planejado_ultima_atualizacao()
RETURNS TABLE (atualizado_em timestamptz, atualizado_por text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.updated_at, coalesce(p.full_name, p.email)
  FROM public.mo_planejamento m
  LEFT JOIN public.profiles p ON p.id = m.updated_by
  WHERE auth.uid() IS NOT NULL
  ORDER BY m.updated_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.mo_planejado_diario(date, date, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mo_planejado_diario(date, date, text[], text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.mo_planejado_ultima_atualizacao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mo_planejado_ultima_atualizacao() TO authenticated;
REVOKE ALL ON FUNCTION public.is_system_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
