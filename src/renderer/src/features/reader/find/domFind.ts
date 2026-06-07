import { scrollElementIntoScrollParent } from '../viewers/pdfViewerPerf'

const MARK_CLASS = 'hanstudy-find-match'
const ACTIVE_CLASS = 'hanstudy-find-match-active'

export interface DomFindResult {
  count: number
  index: number
}

function clearMarks(root: HTMLElement): void {
  root.querySelectorAll(`mark.${MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    parent.normalize()
  })
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('script, style, noscript, svg, mark.hanstudy-find-match')) {
        return NodeFilter.FILTER_REJECT
      }
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

function highlightMatches(root: HTMLElement, query: string): HTMLElement[] {
  clearMarks(root)
  if (!query.trim()) return []

  const needle = query.toLowerCase()
  const marks: HTMLElement[] = []

  for (const textNode of collectTextNodes(root)) {
    const source = textNode.nodeValue ?? ''
    const lower = source.toLowerCase()
    let from = 0
    let hit = lower.indexOf(needle, from)
    if (hit < 0) continue

    const fragments: (string | HTMLElement)[] = []
    while (hit >= 0) {
      if (hit > from) fragments.push(source.slice(from, hit))
      const mark = document.createElement('mark')
      mark.className = MARK_CLASS
      mark.textContent = source.slice(hit, hit + query.length)
      fragments.push(mark)
      marks.push(mark)
      from = hit + query.length
      hit = lower.indexOf(needle, from)
    }
    if (from < source.length) fragments.push(source.slice(from))

    const parent = textNode.parentNode
    if (!parent) continue
    for (const fragment of fragments) {
      parent.insertBefore(typeof fragment === 'string' ? document.createTextNode(fragment) : fragment, textNode)
    }
    parent.removeChild(textNode)
  }

  return marks
}

function setActiveMark(marks: HTMLElement[], index: number): void {
  marks.forEach((mark, i) => {
    mark.classList.toggle(ACTIVE_CLASS, i === index)
  })
  const active = marks[index]
  if (active) scrollElementIntoScrollParent(active, 16)
}

export function runDomFind(
  root: HTMLElement | null,
  query: string,
  index: number,
  forward: boolean
): DomFindResult {
  if (!root) return { count: 0, index: 0 }
  const marks = highlightMatches(root, query)
  if (marks.length === 0) return { count: 0, index: 0 }

  let nextIndex = index
  if (forward) nextIndex = index < 0 ? 0 : (index + 1) % marks.length
  else nextIndex = index < 0 ? marks.length - 1 : (index - 1 + marks.length) % marks.length

  setActiveMark(marks, nextIndex)
  return { count: marks.length, index: nextIndex }
}

export function clearDomFind(root: HTMLElement | null): void {
  if (root) clearMarks(root)
}

export function selectAllInElement(root: HTMLElement | null): void {
  if (!root) return
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(root)
  sel.removeAllRanges()
  sel.addRange(range)
  root.focus({ preventScroll: true })
}
