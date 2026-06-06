import { ipcMain } from 'electron'

type IpcHandler = (...args: unknown[]) => unknown | Promise<unknown>

export class IpcRegistry {
  register(channel: string, handler: IpcHandler): void {
    ipcMain.handle(channel, (_event, ...args) => handler(...args))
  }
}

export const ipcRegistry = new IpcRegistry()
