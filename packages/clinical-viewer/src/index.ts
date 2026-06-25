// Public API — everything a consuming app needs
export { ClinicalViewerProvider } from './ClinicalViewerProvider'
export { ClinicalChart }          from './components/ClinicalChart'
export { LabsPanel }              from './components/LabsPanel'

// Re-export hooks for apps that want direct query access
export {
  useDiagnoses,
  useClinicalEncounters,
  useMedications,
  useLabResults,
  useImagingOrders,
  useSurgical,
  useOncology,
  useEndoscopy,
  useAllergies,
} from './hooks'
