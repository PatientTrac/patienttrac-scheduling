-- 024b_record_request_fee_estimator — APPLIED to mskormozwekezjmtcylv.
-- HIPAA-aware fee estimator. Idempotent (CREATE OR REPLACE). Full source below.
CREATE OR REPLACE FUNCTION cr.estimate_record_request_fee(
  p_org_id uuid, p_requestor_type text, p_delivery_method text DEFAULT NULL,
  p_record_format text DEFAULT 'electronic', p_page_count integer DEFAULT 0,
  p_jurisdiction text DEFAULT NULL, p_is_patient_directed boolean DEFAULT false,
  p_certification boolean DEFAULT false, p_affidavit boolean DEFAULT false, p_rush boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = cr, public AS $$
DECLARE
  v_sched cr.record_request_fee_schedules%ROWTYPE;
  v_rule  cr.record_request_fee_rules%ROWTYPE;
  v_pages integer := GREATEST(COALESCE(p_page_count,0),0);
  v_fee numeric := 0; v_capped boolean := false; v_cap_reason text := NULL; v_breakdown jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_sched FROM cr.record_request_fee_schedules s
   WHERE s.org_id=p_org_id AND s.active IS TRUE
     AND (s.effective_start_date IS NULL OR s.effective_start_date<=CURRENT_DATE)
     AND (s.effective_end_date   IS NULL OR s.effective_end_date>=CURRENT_DATE)
     AND (s.jurisdiction=p_jurisdiction OR s.jurisdiction IS NULL)
   ORDER BY (s.jurisdiction=p_jurisdiction) DESC NULLS LAST, s.effective_start_date DESC NULLS LAST LIMIT 1;
  IF v_sched.record_request_fee_schedule_id IS NULL THEN
    RETURN jsonb_build_object('fee',NULL,'currency','USD','schedule_id',NULL,'rule_id',NULL,'capped',false,
      'no_schedule',true,'compliance_note','No active fee schedule configured for this org. Fee must be set manually.');
  END IF;
  SELECT * INTO v_rule FROM cr.record_request_fee_rules r
   WHERE r.record_request_fee_schedule_id=v_sched.record_request_fee_schedule_id
     AND (r.requestor_type=p_requestor_type OR r.requestor_type IS NULL)
     AND (r.delivery_method=p_delivery_method OR r.delivery_method IS NULL)
     AND (r.record_format=p_record_format OR r.record_format IS NULL)
   ORDER BY (r.requestor_type=p_requestor_type)::int DESC,(r.delivery_method=p_delivery_method)::int DESC,
            (r.record_format=p_record_format)::int DESC LIMIT 1;
  IF v_rule.record_request_fee_rule_id IS NULL THEN
    RETURN jsonb_build_object('fee',NULL,'currency','USD','schedule_id',v_sched.record_request_fee_schedule_id,
      'rule_id',NULL,'capped',false,'no_rule',true,'compliance_note','Schedule found but no matching fee rule. Fee must be set manually.');
  END IF;
  IF v_rule.flat_fee IS NOT NULL AND p_record_format='electronic' THEN
    v_fee := v_rule.flat_fee; v_breakdown := jsonb_build_object('flat_fee',v_rule.flat_fee);
  ELSE
    v_fee := COALESCE(v_rule.base_fee,0)
      + (LEAST(v_pages,NULLIF(v_rule.page_threshold,0))*COALESCE(v_rule.per_page_fee,0))
      + (GREATEST(v_pages-COALESCE(v_rule.page_threshold,0),0)*COALESCE(v_rule.per_page_fee_after,v_rule.per_page_fee,0))
      + COALESCE(v_rule.postage_fee,0)+COALESCE(v_rule.supplies_fee,0)
      + CASE WHEN p_certification THEN COALESCE(v_rule.certification_fee,0) ELSE 0 END
      + CASE WHEN p_affidavit THEN COALESCE(v_rule.affidavit_fee,0) ELSE 0 END
      + CASE WHEN p_rush THEN COALESCE(v_rule.rush_fee,0) ELSE 0 END;
    v_breakdown := jsonb_build_object('base_fee',COALESCE(v_rule.base_fee,0),'pages',v_pages,
      'per_page_fee',COALESCE(v_rule.per_page_fee,0),'per_page_fee_after',COALESCE(v_rule.per_page_fee_after,0),
      'postage_fee',COALESCE(v_rule.postage_fee,0),'supplies_fee',COALESCE(v_rule.supplies_fee,0),
      'certification_fee',CASE WHEN p_certification THEN COALESCE(v_rule.certification_fee,0) ELSE 0 END,
      'affidavit_fee',CASE WHEN p_affidavit THEN COALESCE(v_rule.affidavit_fee,0) ELSE 0 END,
      'rush_fee',CASE WHEN p_rush THEN COALESCE(v_rule.rush_fee,0) ELSE 0 END);
  END IF;
  IF v_rule.minimum_fee IS NOT NULL AND v_fee<v_rule.minimum_fee THEN v_fee:=v_rule.minimum_fee; END IF;
  IF p_is_patient_directed AND v_rule.patient_directed_cap IS NOT NULL AND v_fee>v_rule.patient_directed_cap THEN
    v_fee:=v_rule.patient_directed_cap; v_capped:=true; v_cap_reason:='patient_directed_cap'; END IF;
  IF v_rule.maximum_fee IS NOT NULL AND v_fee>v_rule.maximum_fee THEN
    v_fee:=v_rule.maximum_fee; v_capped:=true; v_cap_reason:=COALESCE(v_cap_reason,'maximum_fee'); END IF;
  RETURN jsonb_build_object('fee',ROUND(v_fee,2),'currency',COALESCE(v_rule.currency,'USD'),
    'schedule_id',v_sched.record_request_fee_schedule_id,'rule_id',v_rule.record_request_fee_rule_id,
    'capped',v_capped,'cap_reason',v_cap_reason,'is_patient_directed',p_is_patient_directed,
    'breakdown',v_breakdown,'compliance_note',v_rule.compliance_note);
END; $$;
