export interface AtlasIndustry {
  id: string
  mapId?: string
  foldedInto?: string
  [key: string]: unknown
}

/** Resolve catalog aliases to the key used by the flow-map datasets. */
export function resolveFlowMapId(
  industry: AtlasIndustry | null | undefined,
  flowMaps?: Record<string, unknown> | null,
): string | undefined {
  if (!industry) return undefined
  const candidates = [industry.mapId, industry.foldedInto, industry.id].filter(Boolean) as string[]
  return candidates.find((id) => !flowMaps || flowMaps[id] !== undefined) ?? candidates[0]
}

export function getIndustryById(industries: AtlasIndustry[], industryId: string) {
  return industries.find((industry) => industry.id === industryId) ?? industries[0]
}
