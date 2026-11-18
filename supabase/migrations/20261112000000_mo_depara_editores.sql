-- M.O — "Planejado x Disponível" (pedido dela, 2026-11-12). ADITIVO sobre 20261109000000:
--  1) Quem edita a M.O passa a ser uma lista de pessoas (mo_editores), não mais todo ADM:
--     Bruna (Coordenadora de Logística) e Diego (Líder de Operações). Não muda papel de ninguém.
--  2) De/Para de funções (mo_funcao_depara): Função Padrão do cliente → função do Planejamento
--     de Embarque (a mesma do card "M.O disponível x Dia"). Várias Funções Padrão podem apontar
--     pra mesma função.
--  3) RPC mo_planejado_drake_diario: planejado por dia já agrupado pela função do De/Para.
--     Mesma regra da mo_planejado_diario (qtd > 0, BSP ≠ ON HOLD, ENCERRADA conta, datas
--     inclusivas). Função sem De/Para continua aparecendo, com o nome original e
--     sem_correspondencia = true.

-- 1) Editores da M.O ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mo_editores (
  user_id uuid PRIMARY KEY,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mo_editores ENABLE ROW LEVEL SECURITY;
-- Sem policy de escrita: a lista só muda por SQL. Cada um só enxerga a própria linha.
DROP POLICY IF EXISTS mo_editores_self ON public.mo_editores;
CREATE POLICY mo_editores_self ON public.mo_editores FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT ON public.mo_editores TO authenticated;

INSERT INTO public.mo_editores (user_id, observacao) VALUES
  ('41fc1944-55ad-4c7e-88ff-dafce960bbd4', 'Bruna — Coordenadora de Logística'),
  ('14855923-ec80-4e04-b7e5-115a3aee204b', 'Diego — Líder de Operações')
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_mo_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mo_editores WHERE user_id = _user_id)
$$;

-- Pro app saber se mostra a aba M.O (sem expor a lista).
CREATE OR REPLACE FUNCTION public.mo_pode_editar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_mo_editor(auth.uid())
$$;

-- Linhas da M.O: só os editores (antes: qualquer ADM). Os totais do Dashboard continuam pelas
-- RPCs SECURITY DEFINER, pra todo mundo logado, como já era.
DROP POLICY IF EXISTS mo_planejamento_admin ON public.mo_planejamento;
DROP POLICY IF EXISTS mo_planejamento_editores ON public.mo_planejamento;
CREATE POLICY mo_planejamento_editores ON public.mo_planejamento FOR ALL TO authenticated
  USING (public.is_mo_editor(auth.uid()))
  WITH CHECK (public.is_mo_editor(auth.uid()));

-- 2) De/Para de funções ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mo_funcao_depara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_padrao text NOT NULL,
  funcao_drake text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS mo_funcao_depara_padrao_uk
  ON public.mo_funcao_depara (public.mo_norm(funcao_padrao));

CREATE OR REPLACE FUNCTION public.mo_funcao_depara_carimbo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS mo_funcao_depara_carimbo ON public.mo_funcao_depara;
CREATE TRIGGER mo_funcao_depara_carimbo
  BEFORE INSERT OR UPDATE ON public.mo_funcao_depara
  FOR EACH ROW EXECUTE FUNCTION public.mo_funcao_depara_carimbo();

ALTER TABLE public.mo_funcao_depara ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_funcao_depara TO authenticated;
DROP POLICY IF EXISTS mo_funcao_depara_editores ON public.mo_funcao_depara;
CREATE POLICY mo_funcao_depara_editores ON public.mo_funcao_depara FOR ALL TO authenticated
  USING (public.is_mo_editor(auth.uid()))
  WITH CHECK (public.is_mo_editor(auth.uid()));

-- Já liga sozinho as Funções Padrão com nome idêntico a uma função do Planejamento de Embarque
-- (ex.: RIGGER → RIGGER). As demais ficam "sem correspondência" até alguém escolher na aba M.O.
INSERT INTO public.mo_funcao_depara (funcao_padrao, funcao_drake)
SELECT DISTINCT ON (public.mo_norm(m.funcao)) m.funcao, p.funcao
FROM public.mo_planejamento m
JOIN public.planejamento_embarque p ON public.mo_norm(p.funcao) = public.mo_norm(m.funcao)
ORDER BY public.mo_norm(m.funcao), p.funcao
ON CONFLICT DO NOTHING;

-- 3) Planejado por dia × função do De/Para -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mo_planejado_drake_diario(p_inicio date, p_fim date)
RETURNS TABLE (dia date, funcao text, sem_correspondencia boolean, planejado bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d::date,
         coalesce(dp.funcao_drake, m.funcao),
         dp.id IS NULL,
         sum(m.qtd)
  FROM public.mo_planejamento m
  LEFT JOIN public.mo_funcao_depara dp ON public.mo_norm(dp.funcao_padrao) = public.mo_norm(m.funcao)
  CROSS JOIN LATERAL generate_series(
    greatest(m.data_embarque, p_inicio), least(m.data_desembarque, p_fim), interval '1 day'
  ) d
  WHERE auth.uid() IS NOT NULL
    AND p_fim - p_inicio <= 800
    AND m.qtd > 0
    AND public.mo_norm(m.bsp) <> 'ON HOLD'
  GROUP BY 1, 2, 3
  ORDER BY 1, 2
$$;

-- Data mínima de embarque / máxima de desembarque (topo do Detalhamento).
CREATE OR REPLACE FUNCTION public.mo_planejado_periodo()
RETURNS TABLE (data_min date, data_max date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT min(data_embarque), max(data_desembarque)
  FROM public.mo_planejamento
  WHERE auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.is_mo_editor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mo_editor(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mo_pode_editar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mo_pode_editar() TO authenticated;
REVOKE ALL ON FUNCTION public.mo_planejado_drake_diario(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mo_planejado_drake_diario(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.mo_planejado_periodo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mo_planejado_periodo() TO authenticated;

NOTIFY pgrst, 'reload schema';
