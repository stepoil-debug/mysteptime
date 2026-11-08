-- [mysteptime@intranet] Colunas que existem no banco real do Lovable mas não em nenhuma migration do repo
-- (levantadas comparando com src/integrations/supabase/types.ts e com os dados reais).
ALTER TABLE public.hist_novo_colaboradores ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.drake_sync_runs ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'drake';
ALTER TABLE public.drake_sync_runs ADD COLUMN IF NOT EXISTS source_file_name text;
ALTER TABLE public.drake_sync_runs ADD COLUMN IF NOT EXISTS base_inserted integer;
ALTER TABLE public.drake_sync_runs ADD COLUMN IF NOT EXISTS base_ignored integer;
ALTER TABLE public.drake_sync_runs ADD COLUMN IF NOT EXISTS base_not_found integer;
