-- Bug do Brandão (2026-10-29): "Could not find the table 'public.nomination_fixed_teams'" ao
-- criar solicitação com "Equipe fixa" marcada — a migration 20261006100000 nunca foi aplicada
-- no banco. Recria tudo de forma idempotente (pode rodar mais de uma vez) e libera também o
-- PM a registrar a PRÓPRIA equipe fixa: quem vê a opção no formulário é o Solicitante, e as
-- policies antigas só aceitavam solicitante_master/operador.
CREATE TABLE IF NOT EXISTS public.nomination_fixed_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
  unidade text NOT NULL,
  bsp text NOT NULL,
  client text,
  notes text,
  periodo_dias integer CHECK (periodo_dias IS NULL OR periodo_dias >= 0),
  pm_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pm_name text,
  proxima_troca date NOT NULL,
  ciclo_dias integer NOT NULL DEFAULT 14 CHECK (ciclo_dias > 0),
  antecedencia_dias_uteis integer NOT NULL DEFAULT 7 CHECK (antecedencia_dias_uteis >= 0),
  ativo boolean NOT NULL DEFAULT true,
  ultima_nomeacao_id uuid REFERENCES public.nominations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS nomination_fixed_teams_updated_at ON public.nomination_fixed_teams;
CREATE TRIGGER nomination_fixed_teams_updated_at
  BEFORE UPDATE ON public.nomination_fixed_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.nomination_fixed_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixed_teams_select" ON public.nomination_fixed_teams;
CREATE POLICY "fixed_teams_select" ON public.nomination_fixed_teams
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'solicitante_master') OR public.is_operator(auth.uid())
         OR (public.has_role(auth.uid(), 'pm') AND pm_user_id = auth.uid()));

DROP POLICY IF EXISTS "fixed_teams_insert" ON public.nomination_fixed_teams;
CREATE POLICY "fixed_teams_insert" ON public.nomination_fixed_teams
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'solicitante_master') OR public.is_operator(auth.uid())
              OR (public.has_role(auth.uid(), 'pm') AND pm_user_id = auth.uid()));

DROP POLICY IF EXISTS "fixed_teams_update" ON public.nomination_fixed_teams;
CREATE POLICY "fixed_teams_update" ON public.nomination_fixed_teams
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'solicitante_master') OR public.is_operator(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'solicitante_master') OR public.is_operator(auth.uid()));

-- Faz o PostgREST enxergar a tabela nova na hora (o erro era justamente "schema cache").
NOTIFY pgrst, 'reload schema';
