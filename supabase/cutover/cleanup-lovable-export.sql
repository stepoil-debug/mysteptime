-- Supabase de destino, após aprovação específica e conferência por valor.
-- Ensaio padrão: a última linha reverte a limpeza.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP SCHEMA IF EXISTS lovable_export CASCADE;

SELECT to_regnamespace('lovable_export') IS NULL AS staging_removido;

ROLLBACK;
