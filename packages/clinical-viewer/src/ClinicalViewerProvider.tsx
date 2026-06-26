import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const ClientContext = createContext<SupabaseClient | null>(null)

const internalQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

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
    <QueryClientProvider client={internalQueryClient}>
      <ClientContext.Provider value={client}>
        {children}
      </ClientContext.Provider>
    </QueryClientProvider>
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
