/** 侧栏(L) × AI 面板(R) 展开状态，用于分档保存阅读缩放 */
export type LayoutZoomProfile = 'L0R0' | 'L0R1' | 'L1R0' | 'L1R1'

export const DEFAULT_LAYOUT_ZOOM_PROFILE: LayoutZoomProfile = 'L1R1'

export function layoutZoomProfile(showSidebar: boolean, showAIPanel: boolean): LayoutZoomProfile {
  return `${showSidebar ? 'L1' : 'L0'}${showAIPanel ? 'R1' : 'R0'}`
}
