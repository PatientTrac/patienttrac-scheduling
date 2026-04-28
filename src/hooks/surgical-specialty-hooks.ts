// =====================================================
// CUSTOM HOOKS - 4 SURGICAL SPECIALTIES
// React + TypeScript + TanStack Query + Supabase
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// =====================================================
// ORTHOPEDIC HOOKS
// =====================================================

/**
 * Hook to track ROM measurements for a procedure with real-time updates
 */
export function useROMTracking(procedureId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rom', procedureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rom_measurements')
        .select('*')
        .eq('procedure_id', procedureId)
        .order('measurement_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });

  // Real-time subscription for ROM updates
  useEffect(() => {
    if (!procedureId) return;

    const channel: RealtimeChannel = supabase
      .channel(`rom:${procedureId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'rom_measurements',
          filter: `procedure_id=eq.${procedureId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rom', procedureId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [procedureId, queryClient]);

  return query;
}

/**
 * Hook to record new ROM measurement
 */
export function useRecordROM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (measurement: {
      procedure_id: number;
      patient_id: number;
      org_id: string;
      joint: string;
      movement_type: string;
      degrees: number;
      pain_during_movement?: number;
      measurement_date: string;
    }) => {
      const { data, error } = await supabase
        .from('rom_measurements')
        .insert(measurement)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rom', data.procedure_id] });
    },
  });
}

/**
 * Hook to calculate ROM improvement
 */
export function useROMImprovement(procedureId: number) {
  return useQuery({
    queryKey: ['rom-improvement', procedureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('calculate_rom_improvement', { p_procedure_id: procedureId });
      
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });
}

/**
 * Hook to track outcome scores (KOOS, DASH, WOMAC)
 */
export function useOutcomeScores(patientId: number, scoreType?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['outcome-scores', patientId, scoreType],
    queryFn: async () => {
      let query = supabase
        .from('orthopedic_outcome_scores')
        .select('*')
        .eq('patient_id', patientId)
        .order('score_date', { ascending: true });
      
      if (scoreType) {
        query = query.eq('score_type', scoreType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`outcome-scores:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'orthopedic_outcome_scores',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['outcome-scores', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

/**
 * Hook to calculate KOOS score
 */
export function useCalculateKOOS() {
  return useMutation({
    mutationFn: async (responses: {
      pain_responses: number[];
      symptoms_responses: number[];
      adl_responses: number[];
      sport_responses: number[];
      qol_responses: number[];
    }) => {
      const { data, error } = await supabase.rpc('calculate_koos_score', responses);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to get orthopedic evaluations (surgeon notes)
 */
export function useOrthopedicEvaluations(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ortho-evaluations', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orthopedic_evaluation')
        .select('*')
        .eq('patient_id', patientId)
        .order('evaluation_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`ortho-eval:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'orthopedic_evaluation',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ortho-evaluations', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

// =====================================================
// CARDIAC HOOKS
// =====================================================

/**
 * Hook to get cardiac catheterization procedures
 */
export function useCardiacCathProcedures(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cardiac-cath', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardiac_catheterization')
        .select('*, cardiac_intervention(*)')
        .eq('patient_id', patientId)
        .order('procedure_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`cardiac-cath:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'cardiac_catheterization',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cardiac-cath', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

/**
 * Hook to get stent registry for a patient (all implanted stents)
 */
export function useStentRegistry(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stent-registry', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardiac_intervention')
        .select('*, cardiac_catheterization(procedure_date, provider_id)')
        .eq('patient_id', patientId)
        .eq('stent_implanted', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`stent-registry:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'cardiac_intervention',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stent-registry', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

/**
 * Hook to calculate cardiac output (Fick method)
 */
export function useCalculateCardiacOutput() {
  return useMutation({
    mutationFn: async (params: {
      oxygen_consumption_ml_min: number;
      arterial_o2_content_ml_dl: number;
      venous_o2_content_ml_dl: number;
      body_surface_area_m2?: number;
    }) => {
      const { data, error } = await supabase.rpc('calculate_cardiac_output_fick', params);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to get MACE rate for organization
 */
export function useMACERate(orgId: string, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['mace-rate', orgId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_mace_rate', {
        p_org_id: orgId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!dateFrom && !!dateTo,
  });
}

/**
 * Hook to get cardiac evaluations (surgeon notes)
 */
export function useCardiacEvaluations(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cardiac-evaluations', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardiac_evaluation')
        .select('*')
        .eq('patient_id', patientId)
        .order('evaluation_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`cardiac-eval:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'cardiac_evaluation',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cardiac-evaluations', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

// =====================================================
// OPHTHALMIC HOOKS
// =====================================================

/**
 * Hook to track visual acuity over time
 */
export function useVATracking(procedureId: number, eye: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['va-tracking', procedureId, eye],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visual_acuity_log')
        .select('*')
        .eq('procedure_id', procedureId)
        .eq('eye', eye)
        .order('measurement_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId && !!eye,
  });

  // Real-time subscription
  useEffect(() => {
    if (!procedureId || !eye) return;

    const channel = supabase
      .channel(`va:${procedureId}:${eye}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'visual_acuity_log',
          filter: `procedure_id=eq.${procedureId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['va-tracking', procedureId, eye] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [procedureId, eye, queryClient]);

  return query;
}

/**
 * Hook to convert visual acuity formats
 */
export function useConvertVisualAcuity() {
  return useMutation({
    mutationFn: async (params: {
      from_format: string;
      from_value: string;
      to_format: string;
    }) => {
      const { data, error } = await supabase.rpc('convert_visual_acuity', params);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to get IOL calculations
 */
export function useIOLCalculations(preOpId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iol-calculations', preOpId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iol_calculations')
        .select('*')
        .eq('pre_op_id', preOpId)
        .order('calculation_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!preOpId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!preOpId) return;

    const channel = supabase
      .channel(`iol:${preOpId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'iol_calculations',
          filter: `pre_op_id=eq.${preOpId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['iol-calculations', preOpId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [preOpId, queryClient]);

  return query;
}

/**
 * Hook to calculate refractive surprise
 */
export function useRefractiv eSurprise(procedureId: number) {
  return useQuery({
    queryKey: ['refractive-surprise', procedureId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_refractive_surprise', {
        p_procedure_id: procedureId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!procedureId,
  });
}

/**
 * Hook to get ophthalmic evaluations (surgeon notes)
 */
export function useOphthalmicEvaluations(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ophthalmic-evaluations', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ophthalmic_evaluation')
        .select('*')
        .eq('patient_id', patientId)
        .order('evaluation_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`ophthalmic-eval:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'ophthalmic_evaluation',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ophthalmic-evaluations', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

// =====================================================
// ENDOSCOPY HOOKS
// =====================================================

/**
 * Hook to get endoscopy reports for a patient
 */
export function useEndoscopyReports(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['endoscopy-reports', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('endoscopy_report')
        .select('*, endoscopy_findings(*), endoscopy_pathology(*)')
        .eq('patient_id', patientId)
        .order('procedure_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`endoscopy-reports:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'endoscopy_report',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['endoscopy-reports', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

/**
 * Hook to calculate Boston bowel prep score
 */
export function useCalculateBostonScore() {
  return useMutation({
    mutationFn: async (params: {
      right_colon: number;
      transverse_colon: number;
      left_colon: number;
    }) => {
      const { data, error } = await supabase.rpc('calculate_boston_score', params);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to calculate colonoscopy surveillance interval
 */
export function useSurveillanceCalculator() {
  return useMutation({
    mutationFn: async (params: {
      polyp_count: number;
      largest_polyp_mm: number;
      has_advanced_adenoma?: boolean;
      has_high_grade_dysplasia?: boolean;
      has_serrated_polyp?: boolean;
      family_history_crc?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('calculate_surveillance_interval', params);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to get adenoma detection rate for provider
 */
export function useAdenomaDetectionRate(providerId: number, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['adr', providerId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_adenoma_detection_rate', {
        p_provider_id: providerId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!providerId && !!dateFrom && !!dateTo,
  });
}

/**
 * Hook to get endoscopy evaluations (surveillance follow-ups)
 */
export function useEndoscopyEvaluations(patientId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['endoscopy-evaluations', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('endoscopy_evaluation')
        .select('*')
        .eq('patient_id', patientId)
        .order('evaluation_date', { ascending: false});
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`endoscopy-eval:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cr',
          table: 'endoscopy_evaluation',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['endoscopy-evaluations', patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  return query;
}

// =====================================================
// CROSS-SPECIALTY HOOKS
// =====================================================

/**
 * Hook to get unified patient surgical timeline across all specialties
 */
export function usePatientSurgicalTimeline(patientId: number, orgId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['surgical-timeline', patientId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_patient_surgical_timeline', {
        p_patient_id: patientId,
        p_org_id: orgId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!patientId && !!orgId,
  });

  // Real-time subscription on all relevant tables
  useEffect(() => {
    if (!patientId) return;

    const tables = [
      'orthopedic_procedure',
      'cardiac_catheterization',
      'ophthalmic_procedure',
      'endoscopy_report',
    ];

    const channels = tables.map((table) =>
      supabase
        .channel(`timeline:${table}:${patientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'cr',
            table,
            filter: `patient_id=eq.${patientId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['surgical-timeline', patientId] });
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [patientId, queryClient]);

  return query;
}

/**
 * Generic hook for real-time presence tracking (who's viewing a patient chart)
 */
export function usePresenceTracking(roomId: string, userId: string) {
  useEffect(() => {
    const channel = supabase.channel(`presence:${roomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Users viewing:', state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);
}

// Export all hooks
export {
  // Orthopedic
  useROMTracking,
  useRecordROM,
  useROMImprovement,
  useOutcomeScores,
  useCalculateKOOS,
  useOrthopedicEvaluations,
  
  // Cardiac
  useCardiacCathProcedures,
  useStentRegistry,
  useCalculateCardiacOutput,
  useMACERate,
  useCardiacEvaluations,
  
  // Ophthalmic
  useVATracking,
  useConvertVisualAcuity,
  useIOLCalculations,
  useRefractiveSurprise,
  useOphthalmicEvaluations,
  
  // Endoscopy
  useEndoscopyReports,
  useCalculateBostonScore,
  useSurveillanceCalculator,
  useAdenomaDetectionRate,
  useEndoscopyEvaluations,
  
  // Cross-specialty
  usePatientSurgicalTimeline,
  usePresenceTracking,
};
