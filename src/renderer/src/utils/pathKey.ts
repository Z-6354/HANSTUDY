export function pathKey(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase()
}
