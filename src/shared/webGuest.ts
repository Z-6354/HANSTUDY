export type WebGuestEvent =
  | { type: 'dom-ready'; docId: string }
  | { type: 'did-start-loading'; docId: string }
  | {
      type: 'did-stop-loading'
      docId: string
      url: string
      canGoBack: boolean
      canGoForward: boolean
    }
  | { type: 'did-navigate'; docId: string; url: string }
  | { type: 'page-title-updated'; docId: string; title: string; url: string }
  | {
      type: 'did-fail-load'
      docId: string
      errorCode: number
      errorDescription: string
      url: string
    }
  | { type: 'zoom-changed'; docId: string; url: string; zoomFactor: number }

export interface WebGuestBounds {
  x: number
  y: number
  width: number
  height: number
}
