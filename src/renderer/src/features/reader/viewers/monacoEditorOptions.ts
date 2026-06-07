import type { editor as MonacoEditor } from 'monaco-editor'

/** Shared Monaco defaults — Chinese punctuation (e.g. U+FF0C ，) must not trigger ambiguous-character hints. */
export const HANSTUDY_MONACO_DEFAULTS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
    nonBasicASCII: false
  },
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 14
}

export const MD_SOURCE_EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  ...HANSTUDY_MONACO_DEFAULTS,
  renderLineHighlight: 'none',
  lineNumbers: 'on',
  padding: { top: 12, bottom: 12 }
}

export const TXT_SOURCE_EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  ...HANSTUDY_MONACO_DEFAULTS,
  lineNumbers: 'off',
  padding: { top: 12, bottom: 12 }
}

export const NOTE_EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  ...HANSTUDY_MONACO_DEFAULTS
}
