import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const ClientContext = createContext<SupabaseClient | null>(null)

interface Props {
  /** The host app's already-authenticated Supabase client.
   *  The package never creates its own client or reads env vars. */
  client: SupabaseClient
  children: ReactNode
}

/** Wrap once at the patient-route level. All ClinicalChart / LabsPanel hooks
 *  inherit the session and RLS scope from this client. */
export function ClinicalViewerProvider({ client, children }: Props) {
  return (
    <ClientContext.Provider value={client}>
      {children}
    </ClientContext.Provider>
  )
}

/** Used internally by every hook in this package. */
export function useClient(): SupabaseClient {
  const client = useContext(ClientContext)
  if (!client) {
    throw new Error(
      '<ClinicalViewerProvider client={supabase}> must wrap any ClinicalChart or LabsPanel usage.'
    )
  }
  return client
}
