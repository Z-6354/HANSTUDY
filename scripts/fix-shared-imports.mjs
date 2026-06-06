import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = 'src/renderer/src'

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(tsx?|ts)$/.test(name)) files.push(p)
  }
  return files
}

for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8')
  const next = content.replace(/from ['"](?:\.\.\/)+shared\//g, "from '@shared/")
  if (next !== content) {
    writeFileSync(file, next, 'utf8')
  }
}

console.log('shared imports fixed')
