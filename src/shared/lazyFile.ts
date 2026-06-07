/** 超过此大小的文本/PDF 等走懒加载/延迟解析路径（512 KB） */
export const LARGE_FILE_BYTES = 512 * 1024

export function isLargeFile(sizeBytes: number): boolean {
  return sizeBytes >= LARGE_FILE_BYTES
}
