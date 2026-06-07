/** 缩放提交防抖（毫秒）— 连续缩放停止后再提交高清重绘 */
export const SCALE_COMMIT_DEBOUNCE_MS = 420

/** 工具栏按钮缩放步进 */
export const WHEEL_ZOOM_STEP = 0.1

/** 滚轮 delta 指数灵敏度（像素归一化后） */
export const WHEEL_ZOOM_SENSITIVITY = 0.0012

/** 单帧最大缩放幅度（约 ±5%） */
export const WHEEL_ZOOM_MAX_FRAME_FACTOR = 1.05

/** 同时渲染页面上限 */
export const MAX_CONCURRENT_PAGE_RENDERS = 2

/** 懒加载预加载边距 */
export const LAZY_ROOT_MARGIN = '320px 0px'

export function clampPdfScale(scale: number): number {
  return Math.min(3, Math.max(0.5, scale))
}

/** 将 WheelEvent delta 归一化为像素量级 */
export function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * (typeof window !== 'undefined' ? window.innerHeight : 800)
  return deltaY
}

/** 归一化 delta → 缩放倍率（>1 放大），单帧带软上限避免鼠标一格跳太大 */
export function wheelDeltaToZoomFactor(normalizedDeltaY: number): number {
  const raw = Math.exp(-normalizedDeltaY * WHEEL_ZOOM_SENSITIVITY)
  return Math.min(WHEEL_ZOOM_MAX_FRAME_FACTOR, Math.max(1 / WHEEL_ZOOM_MAX_FRAME_FACTOR, raw))
}

export function applyWheelZoom(currentScale: number, deltaY: number, deltaMode: number): number {
  const normalized = normalizeWheelDelta(deltaY, deltaMode)
  if (normalized === 0) return currentScale
  return clampPdfScale(currentScale * wheelDeltaToZoomFactor(normalized))
}
export function previewScaleRatio(displayScale: number, renderScale: number): number {
  if (renderScale <= 0) return 1
  const ratio = displayScale / renderScale
  return Math.abs(ratio - 1) < 0.001 ? 1 : ratio
}

/** 是否处于 CSS 模糊预览阶段（displayScale 尚未提交到 layout scale） */
export function isZoomPreviewing(displayScale: number, committedScale: number): boolean {
  return Math.abs(displayScale - committedScale) > 0.001
}

/** 缩放锚点在 pages-root 布局坐标系中的 transform-origin（不受 CSS preview scale 影响） */
export function computePagesRootTransformOrigin(
  clientX: number,
  clientY: number,
  containerScrollLeft: number,
  containerScrollTop: number,
  containerRect: Pick<DOMRect, 'left' | 'top'>,
  pagesRootOffsetLeft: number,
  pagesRootOffsetTop: number
): string {
  const layoutX = containerScrollLeft + (clientX - containerRect.left)
  const layoutY = containerScrollTop + (clientY - containerRect.top)
  const originX = layoutX - pagesRootOffsetLeft
  const originY = layoutY - pagesRootOffsetTop
  return `${originX}px ${originY}px`
}

/** 布局缩放后保持视口内锚点不动 */
export function computeZoomFocalScroll(params: {
  scrollLeft: number
  scrollTop: number
  containerRect: Pick<DOMRect, 'left' | 'top'>
  focalClientX: number
  focalClientY: number
  scaleFactor: number
}): { scrollLeft: number; scrollTop: number } {
  const contentX = params.scrollLeft + (params.focalClientX - params.containerRect.left)
  const contentY = params.scrollTop + (params.focalClientY - params.containerRect.top)
  return {
    scrollLeft: Math.max(
      0,
      contentX * params.scaleFactor - (params.focalClientX - params.containerRect.left)
    ),
    scrollTop: Math.max(
      0,
      contentY * params.scaleFactor - (params.focalClientY - params.containerRect.top)
    )
  }
}

/** 在 scroll 容器内定位子元素（避免 scrollIntoView 受 transform / 缩放预览干扰） */
export function scrollContainerToChild(
  container: HTMLElement,
  child: HTMLElement,
  insetTop = 0
): void {
  const delta = child.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTop = Math.max(0, container.scrollTop + delta - insetTop)
}

/** 向上查找首个可纵向滚动的祖先 */
export function findScrollableParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/** 在可滚动父容器内定位元素；找不到则 fallback 到 scrollIntoView */
export function scrollElementIntoScrollParent(el: HTMLElement, insetTop = 0): void {
  const container = findScrollableParent(el)
  if (container) {
    scrollContainerToChild(container, el, insetTop)
    return
  }
  el.scrollIntoView({ behavior: 'auto', block: 'nearest' })
}

export function getPdfOutputScale(): number {
  if (typeof window !== 'undefined' && window.devicePixelRatio) {
    return Math.max(1, window.devicePixelRatio)
  }
  return 1
}

export function isPriorityPdfPage(page: number, currentPage: number): boolean {
  return Math.abs(page - currentPage) <= 1
}

export function pageRenderPriority(page: number, currentPage: number): number {
  return Math.abs(page - currentPage)
}

/** 读取元素上经典滚动条占用的 layout 宽度（overlay 滚动条时为 0） */
export function readScrollbarGutter(el: HTMLElement): number {
  return Math.max(0, el.offsetWidth - el.clientWidth)
}
