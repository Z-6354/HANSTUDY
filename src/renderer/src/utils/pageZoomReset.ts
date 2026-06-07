/** 异步复位 Chromium 整页 zoom（禁止 sendSync，避免阻塞渲染线程） */
export function resetPageZoom(): void {
  void window.api.window.resetPageZoom()
}
