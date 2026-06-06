import {
  ChevronUp,
  Eraser,
  GripVertical,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  StickyNote,
  Underline
} from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { IconButton } from '../../../components/IconButton'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { AnnotationTool } from '../../../types/global.d'

const TOOLS: { id: AnnotationTool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: '选择' },
  { id: 'pen', icon: Pencil, label: '画笔（左键绘制，右键撤销）' },
  { id: 'rect', icon: Square, label: '方框（左键绘制，右键撤销）' },
  { id: 'highlight', icon: Highlighter, label: '高亮（左键拖选，右键撤销）' },
  { id: 'underline', icon: Underline, label: '下划线（左键拖选，右键撤销）' },
  { id: 'note', icon: StickyNote, label: '便签（左键添加，右键撤销）' },
  { id: 'eraser', icon: Eraser, label: '橡皮擦（左键擦除，右键撤销）' }
]

const COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

export function AnnotationToolbar(): JSX.Element | null {
  const {
    showAnnotationToolbar,
    floatingToolbar,
    setFloatingToolbar,
    annotationTool,
    annotationColor,
    annotationStrokeWidth,
    setAnnotationTool,
    setAnnotationColor,
    setAnnotationStrokeWidth
  } = useWorkspaceStore()

  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  )
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    if (floatingToolbar.x === 0 && floatingToolbar.y === 0) {
      setFloatingToolbar({
        x: Math.round(window.innerWidth / 2),
        y: 72
      })
    }
  }, [floatingToolbar.x, floatingToolbar.y, setFloatingToolbar])

  const handlePointerMove = useCallback(
    (e: PointerEvent): void => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setFloatingToolbar({
        x: Math.max(60, Math.min(window.innerWidth - 60, dragRef.current.originX + dx)),
        y: Math.max(40, Math.min(window.innerHeight - 40, dragRef.current.originY + dy))
      })
    },
    [setFloatingToolbar]
  )

  const handlePointerUp = useCallback((): void => {
    dragRef.current = null
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  }, [handlePointerMove])

  const handleDragStart = (e: React.PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: floatingToolbar.x,
      originY: floatingToolbar.y
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  useEffect(() => () => handlePointerUp(), [handlePointerUp])

  if (!showAnnotationToolbar) return null

  return (
    <div
      className={`annotation-toolbar floating${floatingToolbar.minimized ? ' minimized' : ''}`}
      style={{
        left: floatingToolbar.x,
        top: floatingToolbar.y,
        transform: 'translateX(-50%)'
      }}
      role="toolbar"
      aria-label="标注工具"
    >
      <div className="annotation-toolbar-header" onPointerDown={handleDragStart}>
        <GripVertical size={14} className="annotation-toolbar-grip" aria-hidden />
        <span className="annotation-toolbar-title">标注工具</span>
        <button
          type="button"
          className="annotation-toolbar-window-btn"
          title={floatingToolbar.minimized ? '展开' : '最小化'}
          aria-label={floatingToolbar.minimized ? '展开' : '最小化'}
          onClick={() => setFloatingToolbar({ minimized: !floatingToolbar.minimized })}
        >
          {floatingToolbar.minimized ? <ChevronUp size={14} /> : <Minus size={14} />}
        </button>
      </div>

      {!floatingToolbar.minimized && (
        <div className="annotation-toolbar-body">
          <div className="annotation-toolbar-tools">
            {TOOLS.map(({ id, icon, label }) => (
              <IconButton
                key={id}
                icon={icon}
                label={label}
                size={16}
                className={annotationTool === id ? 'active' : undefined}
                onClick={() => setAnnotationTool(id)}
              />
            ))}
          </div>
          <div className="annotation-toolbar-divider" />
          <div className="annotation-toolbar-colors">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`annotation-color-swatch${annotationColor === color ? ' active' : ''}`}
                style={{ backgroundColor: color }}
                title={`颜色 ${color}`}
                aria-label={`颜色 ${color}`}
                onClick={() => setAnnotationColor(color)}
              />
            ))}
          </div>
          {(annotationTool === 'pen' || annotationTool === 'rect') && (
            <>
              <div className="annotation-toolbar-divider" />
              <label className="annotation-stroke-control">
                <span>粗细</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={annotationStrokeWidth}
                  onChange={(e) => setAnnotationStrokeWidth(Number(e.target.value))}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  )
}
