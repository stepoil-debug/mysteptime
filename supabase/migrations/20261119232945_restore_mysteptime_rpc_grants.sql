-- Preserve the RPC permissions from the source schema after copying to mysteptime.
revoke execute on function mysteptime.cost_simulator_trajetos_conhecidos(text)
  from public, anon;
revoke execute on function mysteptime.nomination_bsps_unidade(text)
  from public, anon;
revoke execute on function mysteptime.nomination_funcoes_planejamento()
  from public, anon;

-- This helper is invoked by the SECURITY DEFINER nomination triggers.
revoke execute on function mysteptime.nomination_notificar_logistica_inserir(mysteptime.nominations, text, text)
  from public, anon, authenticated;
