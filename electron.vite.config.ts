import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          webGuest: resolve(__dirname, 'src/preload/webGuest.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@ui': resolve('src/renderer/src/ui'),
        '@features': resolve('src/renderer/src/features'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
