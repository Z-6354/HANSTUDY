import type { Annotation, AnnotationTool } from '../../../types/global.d'

/** 除「选择」外，标注工具均为：左键执行、右键撤销上一步 */
export function toolUsesRightClickUndo(tool: AnnotationTool): boolean {
  return tool !== 'select'
}

export function findLastAnnotationByType(
  annotations: Annotation[],
  type: Annotation['type']
): Annotation | undefined {
  return [...annotations].reverse().find((a) => a.type === type)
}

export function annotationCreateInput(
  ann: Annotation
): Omit<Annotation, 'id' | 'createdAt' | 'docPath'> {
  const { id: _id, createdAt: _at, docPath: _path, ...rest } = ann
  return rest
}
