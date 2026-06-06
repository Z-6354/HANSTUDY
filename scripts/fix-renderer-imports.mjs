import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = 'src/renderer/src'

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(tsx?|ts)$/.test(name)) files.push(p)
  }
  return files
}

function fixFile(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const depth = rel.split('/').length - 1
  const toRoot = '../'.repeat(depth)

  let content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  const out = lines.map((line) => {
    const m = line.match(/^import (.+) from ['"](\.[^'"]+)['"]/)
    if (!m) return line
    let imp = m[2]
    if (imp.startsWith('./layout/') || imp === './layout') {
      imp = imp.replace('./layout', `${toRoot}ui/layout`)
    } else if (imp.startsWith('../layout/')) {
      imp = imp.replace('../layout', `${toRoot}ui/layout`)
    } else if (imp.startsWith('./viewers/') || imp.startsWith('../viewers/')) {
      imp = imp.replace(/\.\.?\/viewers/, `${toRoot}features/reader/viewers`)
    } else if (imp.startsWith('./annotations/') || imp.startsWith('../annotations/')) {
      imp = imp.replace(/\.\.?\/annotations/, `${toRoot}features/reader/annotations`)
    } else if (imp.startsWith('./settings/') || imp.startsWith('../settings/')) {
      imp = imp.replace(/\.\.?\/settings/, `${toRoot}features/settings`)
    } else if (imp.includes('/components/AIMessageBubble') || imp.includes('/components/ChatModeSelector') || imp.includes('/components/ContextUsageRing')) {
      imp = imp.replace(/\.\.?\/components\/(AIMessageBubble|ChatModeSelector|ContextUsageRing)/, `${toRoot}features/ai/$1`)
    } else if (imp.startsWith('./AIPanel') || imp.endsWith('/AIPanel')) {
      imp = `${toRoot}features/ai/AIPanel`
    } else if (imp.startsWith('../stores/') || imp.startsWith('./stores/')) {
      imp = imp.replace(/\.\.?\/stores/, `${toRoot}stores`)
    } else if (imp.startsWith('../components/') || imp.startsWith('./components/')) {
      imp = imp.replace(/\.\.?\/components/, `${toRoot}components`)
    } else if (imp.startsWith('../types/') || imp.startsWith('./types/')) {
      imp = imp.replace(/\.\.?\/types/, `${toRoot}types`)
    } else if (imp.startsWith('../hooks/') || imp.startsWith('./hooks/')) {
      imp = imp.replace(/\.\.?\/hooks/, `${toRoot}hooks`)
    } else if (imp.startsWith('../utils/') || imp.startsWith('./utils/')) {
      imp = imp.replace(/\.\.?\/utils/, `${toRoot}utils`)
    }
    return `import ${m[1]} from '${imp}'`
  })
  writeFileSync(file, out.join('\n'), 'utf8')
}

for (const file of walk(ROOT)) {
  fixFile(file)
}

console.log('import paths fixed')
