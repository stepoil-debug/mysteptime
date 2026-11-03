CREATE OR REPLACE FUNCTION public.nomination_dp_return(p_id uuid, p_nominee_id uuid, p_reason text, p_restore boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nom public.nominations; v_person public.nomination_nominees;
  v_new public.nominations; v_new_id uuid; v_actor text; v_group uuid;
  v_reason text := btrim(coalesce(p_reason, '')); v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_operator(auth.uid()) OR public.has_role(auth.uid(), 'rh')) THEN
    RAISE EXCEPTION 'Sem permissão para devolver colaboradores do DP';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'Descreva o motivo da devolução e o que corrigir'; END IF;
  SELECT * INTO v_nom FROM public.nominations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  SELECT * INTO v_person FROM public.nomination_nominees WHERE id = p_nominee_id AND nomination_id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não pertence a esta função'; END IF;
  IF p_restore THEN
    IF NOT public.is_operator(auth.uid()) OR v_nom.current_status <> 'simulacao'
       OR v_person.is_active OR NOT v_person.aptidao_divergence
       OR NOT EXISTS (SELECT 1 FROM public.nomination_status_history WHERE nomination_id = p_id AND nominee_id = p_nominee_id AND notes LIKE 'Divergência em %devolvida%')
       OR EXISTS (SELECT 1 FROM public.nomination_status_history WHERE nomination_id = p_id AND changed_at > v_person.aptidao_divergence_flagged_at + interval '5 seconds' AND status <> 'simulacao') THEN
      RAISE EXCEPTION 'Devolução anterior não pode ser restaurada com segurança';
    END IF;
  ELSIF v_nom.current_status <> 'validacao_rh' OR NOT v_person.is_active OR v_person.technical_selected_at IS NULL THEN
    RAISE EXCEPTION 'Colaborador não está ativo na Validação - DP';
  END IF;
  SELECT count(*) INTO v_count FROM public.nomination_nominees WHERE nomination_id = p_id AND is_active AND id <> p_nominee_id;
  SELECT coalesce(full_name, email, 'DP') INTO v_actor FROM public.profiles WHERE id = auth.uid();
  v_actor := coalesce(v_actor, 'DP');
  IF v_count > 0 AND v_nom.quantidade > 1 THEN
    v_group := coalesce(v_nom.request_group_id, gen_random_uuid());
    UPDATE public.nominations SET request_group_id = v_group, quantidade = quantidade - 1,
      current_status = CASE WHEN p_restore THEN 'validacao_rh' ELSE current_status END WHERE id = p_id;
    v_new := jsonb_populate_record(NULL::public.nominations, to_jsonb(v_nom) || jsonb_build_object(
      'id', gen_random_uuid(), 'created_at', v_nom.created_at, 'updated_at', now(),
      'request_group_id', v_group, 'quantidade', 1, 'current_status', 'simulacao',
      'colaborador_id', NULL, 'colaborador_nome', NULL, 'quality_status', 'pendente',
      'quality_validated', false, 'quality_validated_at', NULL, 'quality_validated_by', NULL,
      'quality_rejection_reason', NULL, 'briefing_sms_realizado', false,
      'briefing_sms_realizado_at', NULL, 'briefing_sms_realizado_by', NULL,
      'sequence_number', NULL, 'outcome', NULL, 'cancel_reason', NULL, 'cancelled_at', NULL, 'cancelled_by', NULL));
    INSERT INTO public.nominations SELECT v_new.* RETURNING id INTO v_new_id;
  ELSE
    IF p_restore THEN RAISE EXCEPTION 'Não há colaboradores restantes para preservar'; END IF;
    v_new_id := p_id;
    UPDATE public.nominations SET current_status = 'simulacao' WHERE id = p_id;
  END IF;
  UPDATE public.nomination_nominees SET nomination_id = v_new_id, is_active = false,
    aptidao_divergence = true, aptidao_divergence_text = v_reason,
    aptidao_divergence_flagged_at = coalesce(aptidao_divergence_flagged_at, now()),
    rh_validated = false, rh_validated_at = NULL, rh_validated_by = NULL,
    rejection_reason = v_reason, rejection_stage = 'validacao_rh'
    WHERE id = p_nominee_id;
  INSERT INTO public.nomination_status_history(nomination_id, nominee_id, status, changed_by_name, notes)
    VALUES(v_new_id, p_nominee_id, 'simulacao', v_actor,
      'Devolvida de Validação - DP para Nomeação (Simulação) — ' || v_person.colaborador_nome || ' — Motivo / o que corrigir: ' || v_reason);
  IF v_new_id <> p_id THEN
    INSERT INTO public.nomination_status_history(nomination_id, status, changed_by_name, notes)
      VALUES(p_id, 'validacao_rh', v_actor,
        CASE WHEN p_restore THEN 'Correção de devolução anterior: ' ELSE 'Devolução parcial: ' END || v_person.colaborador_nome || ' separado para substituição; demais colaboradores e aprovações preservados na Validação - DP.');
  END IF;
  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.nomination_dp_return(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nomination_dp_return(uuid, uuid, text, boolean) TO authenticated;
COMMENT ON FUNCTION public.nomination_dp_return(uuid, uuid, text, boolean) IS 'DP/operator-only atomic single-person return. Preserves unaffected nominees, quantity totals, request metadata and stage. Admin-only guarded recovery of legacy DP returns.';