/** 阅读理解助手：引用格式与事实/推断规则（reading / agent 共用） */

export const CITATION_FORMAT_EXAMPLES = [
  '[论文.pdf · 第 3 页]',
  '[笔记.md · L128]',
  '[章节导读 · 章节：引言]'
] as const

/**
 * 供 system prompt 使用的引用与推理规则。
 */
export function getReadingUnderstandingRules(options?: { withTools?: boolean }): string {
  const withTools = options?.withTools ?? false
  const lines = [
    '## 回答原则',
    '- **事实**：仅陈述原文或工具返回中明确出现的信息；引用时使用方括号标注来源。',
    `- **引用格式**：${CITATION_FORMAT_EXAMPLES.join('、')}（与上下文中的文档名、页码/行号一致）。`,
    '- **推断**：若做延伸解释，必须以「推断：」或「可能：」开头，并说明依据；不得把推断写成原文事实。',
    '- 原文信息不足时，明确说明「原文未提及」，不要编造。',
    '- 使用中文，结构清晰（小标题或列表均可）。'
  ]
  if (withTools) {
    lines.push(
      '- 跨文件任务：先 list_library / search_in_library 定位，再 read_document_range 精读；引用时写清文件名与页码/行号。'
    )
  } else {
    lines.push('- 优先基于用户提供的文档片段或选区回答；无依据时不要泛泛发挥。')
  }
  return lines.join('\n')
}

/** 合并进 LLM 上下文的文档块标题（便于模型引用） */
export function formatDocumentContextHeader(
  label: string,
  hint?: string,
  docPath?: string
): string {
  const citeHint = hint ? ` · ${hint}` : ''
  const pathNote = docPath ? `\n（路径：${docPath}，引用时用「${label}」而非完整路径）` : ''
  return `【${label}${citeHint}】${pathNote}`
}

/** 从阅读进度生成 context chip / 引用提示 */
export function formatReadingProgressHint(options: {
  sectionTitle?: string
  pdfPage?: number
  monacoLine?: number
}): string | undefined {
  const parts: string[] = []
  if (options.sectionTitle?.trim()) {
    parts.push(`章节：${options.sectionTitle.trim()}`)
  }
  if (options.pdfPage != null && options.pdfPage > 0) {
    parts.push(`第 ${options.pdfPage} 页`)
  } else if (options.monacoLine != null && options.monacoLine > 0) {
    parts.push(`L${options.monacoLine}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}
