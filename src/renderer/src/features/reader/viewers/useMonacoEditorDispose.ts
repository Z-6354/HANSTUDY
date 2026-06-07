import { useEffect, useRef, type MutableRefObject } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'

/** 标签关闭或退出应用时释放 Monaco 实例与模型占用的内存 */
export function useMonacoEditorDispose(): MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null> {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    return () => {
      const editor = editorRef.current
      if (!editor) return
      editorRef.current = null
      editor.dispose()
    }
  }, [])

  return editorRef
}
