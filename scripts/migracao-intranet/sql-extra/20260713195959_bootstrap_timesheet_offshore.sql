-- [mysteptime@intranet] Tabelas criadas direto no banco do Lovable (sem migration no repo).
-- Recriadas a partir de src/integrations/supabase/types.ts + amostra dos dados reais, na forma
-- ANTERIOR às migrations que acrescentam colunas (bsp, bsp_2, source_event_key, evento, *_extra, funcao_override).
CREATE TABLE IF NOT EXISTS public.timesheet_embarques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.hist_novo_colaboradores(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES public.hist_novo_periodos(id) ON DELETE SET NULL,
  data_inicio_embarque date NOT NULL,
  data_fim_embarque date NOT NULL,
  funcao_embarque text,
  unidade_operacional text,
  status_entrega text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.timesheet_semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.timesheet_embarques(id) ON DELETE CASCADE,
  data_inicio_semana date NOT NULL,
  data_fim_semana date NOT NULL,
  recebido_fisico boolean NOT NULL DEFAULT false,
  data_recebimento date,
  recebido_em timestamptz,
  recebido_por text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.timesheet_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES public.timesheet_semanas(id) ON DELETE CASCADE,
  data date NOT NULL,
  dia_semana text,
  hora_entrada text,
  hora_saida text,
  horas_normais numeric DEFAULT 0,
  horas_extras numeric DEFAULT 0,
  total_horas numeric DEFAULT 0,
  numero_tarefa text,
  descricao_tarefa text,
  adicional_noturno boolean DEFAULT false,
  feriado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheet_embarques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_dias ENABLE ROW LEVEL SECURITY;
