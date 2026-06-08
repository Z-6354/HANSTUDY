import {
  SLASH_CURSOR_MARKER,
  slashCommandRegistry,
  type NoteSlashCommand
} from './noteSlashRegistry'

function slash(def: Omit<NoteSlashCommand, 'label'> & { label?: string }): NoteSlashCommand {
  const id = def.id.trim().toLowerCase()
  return {
    ...def,
    id,
    label: def.label ?? `/${id}`,
    keywords: def.keywords.length > 0 ? def.keywords : [id]
  }
}

slashCommandRegistry.registerMany([
  slash({
    id: 'daima',
    description: '代码块',
    keywords: ['daima', 'daimai', 'dm', 'dai', 'code'],
    template: '```\n' + SLASH_CURSOR_MARKER + '\n```',
    blockKind: 'code',
    buildVisualHtml: (pad) => `<pre data-note-block="code"><code>${pad}</code></pre>`
  }),
  slash({
    id: 'biaoti',
    description: '二级标题',
    keywords: ['biaoti', 'bt', 'h2', 'title'],
    template: `## ${SLASH_CURSOR_MARKER}`,
    blockKind: 'heading',
    buildVisualHtml: (pad) => `<h2 data-note-block="heading">${pad}</h2>`
  }),
  slash({
    id: 'liebiao',
    description: '无序列表',
    keywords: ['liebiao', 'lb', 'list', 'ul'],
    template: `- ${SLASH_CURSOR_MARKER}`,
    blockKind: 'list',
    buildVisualHtml: (pad) => `<ul data-note-block="list"><li>${pad}</li></ul>`
  }),
  slash({
    id: 'yinyong',
    description: '引用块',
    keywords: ['yinyong', 'yy', 'quote'],
    template: `> ${SLASH_CURSOR_MARKER}`,
    blockKind: 'quote',
    buildVisualHtml: (pad) => `<blockquote data-note-block="quote"><p>${pad}</p></blockquote>`
  }),
  slash({
    id: 'b',
    description: '加粗',
    keywords: ['b', 'bold', 'jiacu', 'jc'],
    template: `**${SLASH_CURSOR_MARKER}**`,
    blockKind: 'bold',
    buildVisualHtml: (pad) => `<strong data-note-block="bold">${pad}</strong>`
  }),
  slash({
    id: 'jialuo',
    description: '加粗（中文）',
    keywords: ['jialuo', 'jl'],
    template: `**${SLASH_CURSOR_MARKER}**`,
    blockKind: 'bold',
    buildVisualHtml: (pad) => `<strong data-note-block="bold">${pad}</strong>`
  }),
  slash({
    id: 'xiahuaxian',
    description: '下划线',
    keywords: ['xiahuaxian', 'xhx', 'underline', 'u'],
    template: `<u>${SLASH_CURSOR_MARKER}</u>`,
    blockKind: 'underline',
    buildVisualHtml: (pad) => `<u data-note-block="underline">${pad}</u>`
  }),
  slash({
    id: 'red',
    description: '红色文字',
    keywords: ['red', 'hong', 'hongse', 'cs'],
    template: `<span style="color: #e53935">${SLASH_CURSOR_MARKER}</span>`,
    blockKind: 'color',
    buildVisualHtml: (pad) =>
      `<span data-note-block="color" style="color: #e53935">${pad}</span>`
  })
])
