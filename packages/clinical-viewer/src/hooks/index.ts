import { useQuery } from '@tanstack/react-query'
import { useClient } from '../ClinicalViewerProvider'

export function useDiagnoses(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-diagnoses', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('patient_diagnosis')
        .select('*')
        .eq('patient_id', patientId)
        .order('is_primary', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}

export function useClinicalEncounters(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-encounters', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('encounter')
        .select('*')
        .eq('patient_id', patientId)
        .order('encounter_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}

export function useMedications(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-medications', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('patient_medications')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}

export function useLabResults(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-labs', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('lab_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('lab_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}

export function useImagingOrders(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-imaging', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('imaging_orders')
        .select('*')
        .eq('patient_id', patientId)
        .order('order_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}

export function useSurgical(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-surgical', patientId],
    queryFn: async () => {
      const [{ data: history, error: e1 }, { data: notes, error: e2 }] = await Promise.all([
        client
          .schema('cr')
          .from('patient_surghist')
          .select('*')
          .eq('patient_id', patientId)
          .order('surgery_date', { ascending: true }),
        client
          .schema('cr')
          .from('operative_notes')
          .select('*')
          .eq('patient_id', patientId),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return { history: history ?? [], notes: notes ?? [] }
    },
    enabled: !!patientId,
  })
}

export function useOncology(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-oncology', patientId],
    queryFn: async () => {
      const { data: evaluation, error: e1 } = await client
        .schema('cr')
        .from('oncology_initial_evaluation')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle()
      if (e1) throw e1
      if (!evaluation) return null
      const { data: events, error: e2 } = await client
        .schema('cr')
        .from('oncology_treatment_events')
        .select('*')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq('evaluation_id', (evaluation as any).evaluation_id)
        .order('event_date', { ascending: true })
      if (e2) throw e2
      return { evaluation, events: events ?? [] }
    },
    enabled: !!patientId,
  })
}

export function useEndoscopy(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-endoscopy', patientId],
    queryFn: async () => {
      // endoscopy_pre_procedure links via encounter_id (no report_id column) —
      // fetch separately and merge client-side.
      const [{ data: reports, error: e1 }, { data: pre, error: e2 }] = await Promise.all([
        client
          .schema('cr')
          .from('endoscopy_report')
          .select(
            '*, endoscopy_findings(*), endoscopy_pathology(*), endoscopy_interventions(*), endoscopy_post_procedure(*)'
          )
          .eq('patient_id', patientId),
        client
          .schema('cr')
          .from('endoscopy_pre_procedure')
          .select('*')
          .eq('patient_id', patientId),
      ])
      if (e1) throw e1
      if (e2) throw e2

      const preByEncounter: Record<number, unknown> = {}
      for (const row of (pre ?? [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((row as any).encounter_id != null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preByEncounter[(row as any).encounter_id] = row
        }
      }

      return (reports ?? []).map(report => ({
        ...report,
        endoscopy_pre_procedure:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (report as any).encounter_id != null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (preByEncounter[(report as any).encounter_id] ?? null)
            : null,
      }))
    },
    enabled: !!patientId,
  })
}

export function useAllergies(patientId: number) {
  const client = useClient()
  return useQuery({
    queryKey: ['cv-allergies', patientId],
    queryFn: async () => {
      const { data, error } = await client
        .schema('cr')
        .from('patient_allergies')
        .select('*')
        .eq('patient_id', patientId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!patientId,
  })
}
