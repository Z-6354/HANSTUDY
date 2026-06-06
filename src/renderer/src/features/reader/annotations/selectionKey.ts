/** 文本选区唯一键，用于 mouseup 去重（doc 16 / 51） */
export function buildDomSelectionKey(docPath: string, text: string, range: Range): string {
  return `${docPath}\0${text}\0${range.startContainer.compareDocumentPosition(range.endContainer)}\0${range.startOffset}\0${range.endOffset}`
}
