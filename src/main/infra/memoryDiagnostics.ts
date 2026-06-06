import { BrowserWindow } from 'electron'

export interface ProcessMemoryInfo {
  rssMb: number
  heapUsedMb: number
  heapTotalMb: number
  externalMb: number
  arrayBuffersMb: number
}

export interface MemorySnapshot {
  main: ProcessMemoryInfo
  renderer: ProcessMemoryInfo | null
  openWebGuestCount: number
  timestamp: string
}

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

export function getMainProcessMemory(): ProcessMemoryInfo {
  const m = process.memoryUsage()
  return {
    rssMb: toMb(m.rss),
    heapUsedMb: toMb(m.heapUsed),
    heapTotalMb: toMb(m.heapTotal),
    externalMb: toMb(m.external),
    arrayBuffersMb: toMb(m.arrayBuffers ?? 0)
  }
}

export async function getRendererMemory(): Promise<ProcessMemoryInfo | null> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win?.webContents) return null
  try {
    const raw = await win.webContents.executeJavaScript(`
      (() => {
        const m = performance.memory || {};
        return {
          rssMb: 0,
          heapUsedMb: Math.round((m.usedJSHeapSize || 0) / 1024 / 1024 * 10) / 10,
          heapTotalMb: Math.round((m.totalJSHeapSize || 0) / 1024 / 1024 * 10) / 10,
          externalMb: 0,
          arrayBuffersMb: 0
        };
      })()
    `)
    return raw as ProcessMemoryInfo
  } catch {
    return null
  }
}

export async function buildFullMemorySnapshot(
  openWebGuestCount: number
): Promise<MemorySnapshot> {
  const renderer = await getRendererMemory()
  return {
    main: getMainProcessMemory(),
    renderer,
    openWebGuestCount,
    timestamp: new Date().toISOString()
  }
}
