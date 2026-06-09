import type { WorkbenchMode } from './types'
import {
  DEFAULT_LAYOUT_ZOOM_PROFILE,
  type LayoutZoomProfile
} from './layoutZoomProfile'
import type { ReadingProgress } from './readingProgress'

export function savedPdfScale(
  saved: ReadingProgress | null | undefined,
  slot: WorkbenchMode,
  layout: LayoutZoomProfile = DEFAULT_LAYOUT_ZOOM_PROFILE
): number | undefined {
  const fromLayout = saved?.pdfScaleByLayout?.[layout]
  if (fromLayout != null) return fromLayout
  if (slot === 'compose') {
    return saved?.pdfScaleCompose ?? saved?.pdfScale
  }
  if (layout === DEFAULT_LAYOUT_ZOOM_PROFILE) {
    return saved?.pdfScale
  }
  return undefined
}

export function pdfScaleProgressPatch(
  slot: WorkbenchMode,
  layout: LayoutZoomProfile,
  scale: number,
  existing?: ReadingProgress | null
): Pick<ReadingProgress, 'pdfScale' | 'pdfScaleCompose' | 'pdfScaleByLayout'> {
  const pdfScaleByLayout: Partial<Record<LayoutZoomProfile, number>> = {
    ...existing?.pdfScaleByLayout,
    [layout]: scale
  }
  const patch: Pick<ReadingProgress, 'pdfScale' | 'pdfScaleCompose' | 'pdfScaleByLayout'> = {
    pdfScaleByLayout
  }
  if (slot === 'compose' && layout === DEFAULT_LAYOUT_ZOOM_PROFILE) {
    patch.pdfScaleCompose = scale
  }
  if (slot === 'browse' && layout === DEFAULT_LAYOUT_ZOOM_PROFILE) {
    patch.pdfScale = scale
  }
  return patch
}
