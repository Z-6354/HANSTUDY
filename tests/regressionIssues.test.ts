/**
 * 整合回归测试 — 对应 docs/questions 01–51 去重后的可测项
 * 每项以 R{编号} 标识，运行 `npm run test:all` 可批量验证
 */
import { describe, expect, it, vi } from 'vitest'
import { IPC } from '../src/shared/ipc/channels'
import { DEFAULT_APP_SETTINGS } from '../src/shared/appSettings'
import {
  guestUrlsEquivalent,
  isBlankGuestUrl,
  isWebNavigableUrl,
  normalizeGuestBounds,
  readWebGuestBounds,
  shouldStartGuestNavigation,
  WEB_LAYOUT_RAIL_GUTTER
} from '../src/shared/webGuestBounds'
import { buildDomSelectionKey } from '../src/renderer/src/features/reader/annotations/selectionKey'
import { resolveStoredMarkupColor } from '../src/renderer/src/features/reader/annotations/annotationMarkup'
import {
  applyDomAnnotation,
  findTextRangeInRoot,
  refreshTextMarkup,
  scrollToAnnotationText
} from '../src/renderer/src/features/reader/annotations/textUtils'
import { isZoomPreviewing, SCALE_COMMIT_DEBOUNCE_MS } from '../src/renderer/src/features/reader/viewers/pdfViewerPerf'
import { fitStaleCanvasToSlot } from '../src/renderer/src/features/reader/viewers/pdfLazyRender'
import type { PdfPageSlot } from '../src/renderer/src/features/reader/viewers/pdfLazyRender'

// @vitest-environment happy-dom

describe('R-IPC webGuest channels (doc 01/09)', () => {
  it('registers destroy, destroyDoc, event, prepareDoc', () => {
    expect(IPC.webGuest.prepareDoc).toBe('webGuest:prepareDoc')
    expect(IPC.webGuest.destroy).toBe('webGuest:destroy')
    expect(IPC.webGuest.destroyDoc).toBe('webGuest:destroyDoc')
    expect(IPC.webGuest.event).toBe('webGuest:event')
  })
})

describe('R-HITL settings (doc 09)', () => {
  it('hitlAutoApprove defaults false', () => {
    expect(DEFAULT_APP_SETTINGS.hitlAutoApprove).toBe(false)
  })
})

describe('R-WEB attach bounds (doc 52)', () => {
  it('readWebGuestBounds reserves left rail gutter', () => {
    const b = readWebGuestBounds({ left: 100, top: 50, width: 800, height: 600 }, { left: true, right: false })
    expect(b.x).toBe(100 + WEB_LAYOUT_RAIL_GUTTER)
    expect(b.width).toBe(800 - WEB_LAYOUT_RAIL_GUTTER)
    expect(b.height).toBeGreaterThanOrEqual(64)
  })

  it('normalizeGuestBounds clamps tiny sizes', () => {
    expect(normalizeGuestBounds({ x: -1, y: 0, width: 10, height: 10 })).toEqual({
      x: 0,
      y: 0,
      width: 64,
      height: 64
    })
  })

  it('isBlankGuestUrl treats about:blank as empty', () => {
    expect(isBlankGuestUrl('about:blank')).toBe(true)
    expect(isBlankGuestUrl('https://example.com')).toBe(false)
  })
})

describe('R-WEB navigate dedup (doc 06/52)', () => {
  it('guestUrlsEquivalent ignores trailing slash', () => {
    expect(guestUrlsEquivalent('https://a.com/', 'https://a.com')).toBe(true)
  })

  it('shouldStartGuestNavigation skips same href', () => {
    expect(shouldStartGuestNavigation('https://a.com', 'https://a.com/')).toBe(false)
    expect(shouldStartGuestNavigation('about:blank', 'https://a.com')).toBe(true)
  })

  it('isWebNavigableUrl accepts http/https only', () => {
    expect(isWebNavigableUrl('https://x.com')).toBe(true)
    expect(isWebNavigableUrl('file:///x')).toBe(false)
  })
})

describe('R-ANNOT selection key dedup (doc 16/51)', () => {
  it('buildDomSelectionKey is stable for same range', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    document.body.appendChild(root)
    const range = document.createRange()
    range.setStart(root.firstChild!, 0)
    range.setEnd(root.firstChild!, 5)
    const k1 = buildDomSelectionKey('/a.md', 'hello', range)
    const k2 = buildDomSelectionKey('/a.md', 'hello', range)
    expect(k1).toBe(k2)
    expect(buildDomSelectionKey('/a.md', 'world', range)).not.toBe(k1)
    root.remove()
  })
})

describe('R-ANNOT cross-node markup (doc 47/49/51)', () => {
  it('findTextRangeInRoot matches across element boundaries', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>foo <strong>bar</strong> baz</p>'
    const range = findTextRangeInRoot(root, 'foo bar')
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('foo bar')
  })

  it('applyDomAnnotation wraps highlight and refresh restores', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>alpha beta gamma</p>'
    expect(applyDomAnnotation(root, 'highlight', 'beta', null, '#ff0')).toBe(true)
    expect(root.querySelector('mark.annotation-highlight')).not.toBeNull()
    root.innerHTML = '<p>alpha beta gamma</p>'
    refreshTextMarkup(root, [
      {
        id: '1',
        docPath: '/x',
        type: 'highlight',
        color: '#ff0',
        selectedText: 'beta',
        createdAt: '2026-01-01'
      }
    ])
    expect(root.querySelector('mark.annotation-highlight')).not.toBeNull()
  })

  it('applyDomAnnotation on PDF textLayer uses span class', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div class="textLayer"><span>one</span><span> two</span><span> three</span></div>'
    const range = findTextRangeInRoot(root, 'two three')
    expect(range).not.toBeNull()
    expect(applyDomAnnotation(root, 'underline', 'two three', range, '#00f')).toBe(true)
    const spans = root.querySelectorAll('.textLayer span.annotation-underline')
    expect(spans.length).toBeGreaterThan(0)
  })

  it('scrollToAnnotationText returns false when text missing', () => {
    const root = document.createElement('div')
    root.textContent = 'nothing here'
    expect(scrollToAnnotationText(root, 'missing')).toBe(false)
  })

  it('resolveStoredMarkupColor uses annotation color', () => {
    expect(resolveStoredMarkupColor({ type: 'highlight', color: '#abc' })).toBe(
      'rgba(170, 187, 204, 0.24)'
    )
    expect(resolveStoredMarkupColor({ type: 'underline', color: undefined })).toContain('#')
  })
})

describe('R-PDF zoom preview (doc 50)', () => {
  it('isZoomPreviewing when display differs from committed scale', () => {
    expect(isZoomPreviewing(1.5, 1.2)).toBe(true)
    expect(isZoomPreviewing(1.2, 1.2)).toBe(false)
  })

  it('SCALE_COMMIT_DEBOUNCE_MS is 420ms', () => {
    expect(SCALE_COMMIT_DEBOUNCE_MS).toBe(420)
  })
})

describe('R-PDF stale canvas fit (doc 48)', () => {
  it('fitStaleCanvasToSlot stretches canvas to 100%', () => {
    const wrap = document.createElement('div')
    const canvas = document.createElement('canvas')
    canvas.className = 'pdf-page'
    wrap.appendChild(canvas)
    const slot: PdfPageSlot = {
      pageNo: 1,
      wrap,
      baseWidth: 100,
      baseHeight: 100,
      rendered: true,
      rendering: false,
      textHandle: null
    }
    fitStaleCanvasToSlot(slot, 1.5, 1.0)
    expect(canvas.style.width).toBe('100%')
    expect(canvas.style.height).toBe('100%')
  })
})

describe('R-KNOWN-GAP toolSteps after finishStream (doc 46)', () => {
  it('finishStream writes toolSteps onto ChatMessage', async () => {
    const { useChatStore } = await import('../src/renderer/src/stores/chatStore')
    const s = useChatStore.getState()
    const sessionId = s.createSession()
    s.addMessage(sessionId, {
      id: 'a1',
      role: 'assistant',
      content: 'done',
      createdAt: new Date().toISOString()
    })
    s.startStream(sessionId, 'r1', 'a1')
    s.updateStreamToolSteps(sessionId, () => [
      { id: 't1', name: 'load_skill', status: 'done', output: 'skill body' }
    ])
    s.finishStream('r1')
    const saved = s.loadForDoc(sessionId).find((m) => m.id === 'a1')
    expect(saved?.toolSteps?.[0]?.name).toBe('load_skill')
  })
})
