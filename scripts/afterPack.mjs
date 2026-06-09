import { copyFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { rcedit } from 'rcedit'

const require = createRequire(import.meta.url)

/** Electron/Chromium 运行时必需文件（部分环境下 electron-builder 会漏拷） */
const RUNTIME_FILES = [
  'icudtl.dat',
  'resources.pak',
  'v8_context_snapshot.bin',
  'vk_swiftshader.dll'
]

function resolveElectronDist() {
  try {
    return join(dirname(require.resolve('electron/package.json')), 'dist')
  } catch {
    return null
  }
}

function ensureRuntimeFiles(appOutDir) {
  const electronDist = resolveElectronDist()
  if (!electronDist) {
    console.warn('[打包] 未找到 electron dist，跳过运行时文件补全')
    return
  }
  for (const name of RUNTIME_FILES) {
    const src = join(electronDist, name)
    const dest = join(appOutDir, name)
    if (existsSync(dest)) continue
    if (!existsSync(src)) {
      console.warn('[打包] 缺少源文件，无法补全:', name)
      continue
    }
    copyFileSync(src, dest)
    console.log('[打包] 已补全运行时文件:', name)
  }
}

/** 补全运行时文件并写入 exe 图标（signAndEditExecutable 关闭以避免 winCodeSign 符号链接问题） */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  ensureRuntimeFiles(context.appOutDir)

  const projectDir = context.packager.projectDir
  const iconPath = join(projectDir, 'build', 'icon.ico')
  const exePath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  )

  if (!existsSync(exePath)) {
    console.warn('[打包] 未找到 exe:', exePath)
    return
  }

  if (!existsSync(iconPath)) {
    console.warn('[打包] 未找到 build/icon.ico，跳过图标写入')
    return
  }

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: context.packager.appInfo.productName,
      ProductName: context.packager.appInfo.productName,
      InternalFilename: context.packager.appInfo.productFilename
    }
  })

  console.log('[打包] 已写入应用图标:', exePath)
}
