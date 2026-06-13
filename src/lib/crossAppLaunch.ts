// ============================================================================
// Cross-app launch helper — issues a single-use session token (org-checked,
// server-side) and opens the destination app with inherited context.
// App URLs come from saas.app_routing (public view), cached per session.
// ============================================================================

import { supabase } from './supabase'

const urlCache = new Map<string, string>()

export async function getAppUrl(appKey: string, orgId: string): Promise<string | null> {
  const cacheKey = `${orgId}:${appKey}`
  if (urlCache.has(cacheKey)) return urlCache.get(cacheKey)!
  const { data } = await supabase
    .from('app_routing')
    .select('app_url')
    .eq('org_id', orgId)
    .eq('app_key', appKey)
    .eq('is_active', true)
    .not('app_url', 'is', null)
    .limit(1)
    .maybeSingle()
  const url = data?.app_url ?? null
  if (url) urlCache.set(cacheKey, url)
  return url
}

export interface LaunchContext {
  orgId: string
  patientId?: number | null
  encounterId?: number | null
  providerId?: number | null
}

export async function launchApp(appKey: string, ctx: LaunchContext): Promise<void> {
  const url = await getAppUrl(appKey, ctx.orgId)
  if (!url) return
  const { data: token, error } = await supabase.rpc('issue_cross_app_token', {
    p_app_key: appKey,
    p_org_id: ctx.orgId,
    p_patient_id: ctx.patientId ?? null,
    p_encounter_id: ctx.encounterId ?? null,
    p_provider_id: ctx.providerId ?? null,
  })
  window.open(token && !error ? `${url}/?token=${token}` : url, '_blank', 'noopener')
}
