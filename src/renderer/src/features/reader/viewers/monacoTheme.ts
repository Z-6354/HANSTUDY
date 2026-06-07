import type * as MonacoApi from 'monaco-editor'

/** MD / TXT 源码编辑器 — 浅色（白天）主题，与阅读区一致 */
export function defineHanstudyEditorTheme(monaco: typeof MonacoApi): void {
  monaco.editor.defineTheme('hanstudy-editor', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '333333' },
      { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0550AE' },
      { token: 'string', foreground: '0A7F0A' },
      { token: 'markup.heading', foreground: '24292F', fontStyle: 'bold' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#333333',
      'editorLineNumber.foreground': '#999999',
      'editorLineNumber.activeForeground': '#333333',
      'editor.lineHighlightBackground': '#f5f5f5',
      'editor.selectionBackground': '#add6ff99',
      'editor.inactiveSelectionBackground': '#add6ff44',
      'editorCursor.foreground': '#333333',
      'editorWidget.background': '#ffffff',
      'editorWidget.border': '#e0e0e0'
    }
  })
}

export const HANSTUDY_EDITOR_THEME = 'hanstudy-editor'
