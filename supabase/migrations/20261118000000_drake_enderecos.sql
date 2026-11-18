-- Endereço dos colaboradores do Planejamento de Embarque, vindo do Drake (pedido dela,
-- 2026-11-18 — logística de deslocamento). Endpoint do Drake: /api/v1/Worker/{id}/Address.
--
-- Separado do Planejamento de Embarque de propósito: a sincronização do Drake grava aqui (etapa
-- extra; se falhar, a sincronização continua), e a tela só lê para mostrar a coluna "Endereço".
-- Endereço é dado pessoal (LGPD): leitura e escrita SÓ para operadores/administradores.
create table if not exists public.drake_enderecos (
  matricula_norm   text primary key,   -- matrícula sem zeros à esquerda
  matricula        text not null,
  endereco         text not null,
  atualizado_em    timestamptz not null default now()
);

alter table public.drake_enderecos enable row level security;

drop policy if exists "drake_enderecos_operadores" on public.drake_enderecos;
create policy "drake_enderecos_operadores" on public.drake_enderecos
  for all to authenticated
  using (public.is_operator(auth.uid()))
  with check (public.is_operator(auth.uid()));
