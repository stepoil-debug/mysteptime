-- Preserva a semântica da origem: recebidos sem usuário associado mantêm NULL.
SET LOCAL lock_timeout = '5s';

ALTER TABLE mysteptime.timesheet_semanas
  ALTER COLUMN recebido_por TYPE uuid USING recebido_por::uuid;

ALTER TABLE mysteptime.timesheet_semanas
  ADD CONSTRAINT timesheet_semanas_recebido_por_fkey
  FOREIGN KEY (recebido_por) REFERENCES auth.users(id) ON DELETE SET NULL;
