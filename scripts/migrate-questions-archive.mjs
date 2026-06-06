import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = 'docs/questions'
const CONSOL = join(ROOT, 'consolidated')
const ARCHIVE = join(ROOT, 'archive')
const TODAY = '20260606'
const HOT_ZONE = 10
const MAX_NN = 43
const HOT_FROM = MAX_NN - HOT_ZONE + 1 // 34

mkdirSync(CONSOL, { recursive: true })
mkdirSync(ARCHIVE, { recursive: true })

const files = readdirSync(ROOT).filter(
  (f) => f.endsWith('.md') && f !== 'README.md' && f !== 'INDEX.md'
)

const parsed = files
  .map((f) => {
    const m = f.match(/^(\d+)-(.+)-(\d{8})\.md$/)
    return m ? { f, nn: +m[1], topic: m[2], date: m[3] } : null
  })
  .filter(Boolean)
  .sort((a, b) => a.nn - b.nn || a.date.localeCompare(b.date) || a.f.localeCompare(b.f))

function readBody(filename) {
  return readFileSync(join(ROOT, filename), 'utf8')
}

function buildBatch(batchNo, from, to, items) {
  const bbb = String(batchNo).padStart(3, '0')
  const fromStr = String(from).padStart(2, '0')
  const toStr = String(to).padStart(2, '0')
  const outName = `batch-${bbb}-${fromStr}-${toStr}-${TODAY}.md`
  const indexRows = items
    .map((it) => `| ${String(it.nn).padStart(2, '0')} | \`${it.f}\` | ${it.topic.replace(/-/g, ' ')} | ${it.date.slice(0, 4)}-${it.date.slice(4, 6)}-${it.date.slice(6, 8)} |`)
    .join('\n')
  const bodies = items
    .map((it) => {
      const body = readBody(it.f)
      return `### 问答 ${String(it.nn).padStart(2, '0')} · ${it.topic}\n\n> 原文件：\`${it.f}\`\n\n${body.trim()}\n`
    })
    .join('\n---\n\n')

  const content = `# 问答归档批次 · batch-${bbb} · ${fromStr}–${toStr}

| 项 | 值 |
|----|-----|
| 批次号 | batch-${bbb} |
| 序号范围 | ${fromStr}–${toStr} |
| 条数 | ${items.length} |
| 整合日期 | ${TODAY.slice(0, 4)}-${TODAY.slice(4, 6)}-${TODAY.slice(6, 8)} |
| 类型 | consolidated（冷区） |

---

## 批次摘要

本批涵盖 NN ${fromStr}–${toStr} 的全部问答归档（含同序号不同日期的条目），共 ${items.length} 篇。

---

## 条目索引

| NN | 原文件名 | 主题 | 日期 |
|----|----------|------|------|
${indexRows}

---

## 合并正文

${bodies}

---

## 归档说明

原独立文件已移至 \`docs/questions/archive/\`。
`

  writeFileSync(join(CONSOL, outName), content, 'utf8')
  for (const it of items) {
    renameSync(join(ROOT, it.f), join(ARCHIVE, it.f))
  }
  return { outName, count: items.length, from, to }
}

const batches = []
for (let k = 1; k <= 3; k++) {
  const from = (k - 1) * 10 + 1
  const to = k * 10
  const items = parsed.filter((p) => p.nn >= from && p.nn <= to)
  if (items.length === 0) continue
  batches.push(buildBatch(k, from, to, items))
}

const hot = parsed.filter((p) => p.nn >= HOT_FROM)
const remainder = parsed.filter((p) => p.nn > 30 && p.nn < HOT_FROM)

const batchRows = batches
  .map(
    (b) =>
      `| batch-${String(batches.indexOf(b) + 1).padStart(3, '0')} | ${String(b.from).padStart(2, '0')}–${String(b.to).padStart(2, '0')} | [consolidated/${b.outName}](consolidated/${b.outName}) | ${TODAY.slice(0, 4)}-${TODAY.slice(4, 6)}-${TODAY.slice(6, 8)} | ${b.count} |`
  )
  .join('\n')

const index = `# 问题归档结构索引

> 冷区批次全文的**目录地图**；热区（最近 ${HOT_ZONE} 条）见 [README.md](README.md) 近期表。

---

## 一、热区（未压缩，最近 ${HOT_ZONE} 条）

| 序号范围 | 存放位置 | 说明 |
|----------|----------|------|
| ${String(HOT_FROM).padStart(2, '0')}–${String(MAX_NN).padStart(2, '0')} | \`docs/questions/{NN}-*.md\` | 始终独立文件，禁止并入批次 |

---

## 二、冷区余数（未满整批）

| NN | 文件 | 说明 |
|----|------|------|
${remainder.map((r) => `| ${String(r.nn).padStart(2, '0')} | [${r.f}](${r.f}) | 待凑满 ${Math.ceil(r.nn / 10) * 10} 批次 |`).join('\n')}

---

## 三、冷区批次（每 10 序号一档）

| 批次 | 序号范围 | 文件 | 整合日期 | 条数 |
|------|----------|------|----------|------|
${batchRows}

---

## 四、统计

| 项 | 值 |
|----|-----|
| 总归档序号上限 | ${MAX_NN} |
| 热区条数 | ${hot.length} |
| 冷区余数 | ${remainder.length} |
| 冷区批次数 | ${batches.length} |
| 根目录独立文件 | ${hot.length + remainder.length} |
| archive 原文 | ${batches.reduce((s, b) => s + b.count, 0)} |

**迁移日期**：${TODAY.slice(0, 4)}-${TODAY.slice(4, 6)}-${TODAY.slice(6, 8)}（doc-maintenance v1.12.0 §7.9）
`

writeFileSync(join(ROOT, 'INDEX.md'), index, 'utf8')

const hotSummaries = {
  34: '左右感应条；书签目录+页码；缩略图拖动滚动',
  35: 'PDF/Java/Store 泄漏修复；设置页内存检测',
  36: 'WebView 边距；Allotment 重挂载；CSS 与 resize 同步',
  37: '滚动/页码/标签会话；批注沿用原有存储',
  38: '修复拖动拦截；延迟关面板；即时 scrollIntoView',
  39: '最大化自动关左右栏；显示 SidebarRail/AIRail；还原恢复',
  40: 'HiDPI canvas；当前±1 高清优先；远端预览后升级',
  41: 'L1–L6 分层；ToolRegistry/Agent/MCP；Renderer 重组',
  42: 'PathGuard/MCP/HITL/Agent 中止；McpPanel 乱码',
  43: 'Skill v1.12.0：热区10条 + 每10条batch + INDEX'
}

const hotTable = hot
  .sort((a, b) => a.nn - b.nn)
  .map((h) => {
    const topic = h.f.replace(/^\d+-/, '').replace(/-\d{8}\.md$/, '').replace(/-/g, ' ')
    const summary = hotSummaries[h.nn] ?? topic.slice(0, 40)
    return `| ${String(h.nn).padStart(2, '0')} | ${topic} | 2026-06-06 | ${summary} |`
  })
  .join('\n')

const readme = `# 问题归档（总库）

本项目技术问答归档（doc-maintenance **v1.12.0** 热区/冷区模型）。

## 分区说明

| 分区 | 说明 |
|------|------|
| **热区** | 最近 ${HOT_ZONE} 条（NN ${String(HOT_FROM).padStart(2, '0')}–${String(MAX_NN).padStart(2, '0')}）→ 根目录独立文件 |
| **冷区余数** | NN 31–33 → 独立文件，待凑满整批 |
| **冷区批次** | NN 01–30 → [consolidated/](consolidated/)（3 个 batch） |
| **结构索引** | [INDEX.md](INDEX.md) |
| **原文备份** | [archive/](archive/) |

---

## 近期记录（热区）

| NN | 主题 | 日期 | 摘要 |
|----|------|------|------|
${hotTable}

---

## 冷区批次速查

| 批次 | 范围 | 条数 | 文件 |
|------|------|------|------|
${batches.map((b, i) => `| batch-${String(i + 1).padStart(3, '0')} | ${String(b.from).padStart(2, '0')}–${String(b.to).padStart(2, '0')} | ${b.count} | [consolidated/${b.outName}](consolidated/${b.outName}) |`).join('\n')}

冷区余数：31、32、33 仍为独立文件，见 [INDEX.md §二](INDEX.md)。
`

writeFileSync(join(ROOT, 'README.md'), readme, 'utf8')

console.log('Migration done:')
console.log('  batches:', batches.length)
console.log('  archived:', batches.reduce((s, b) => s + b.count, 0))
console.log('  hot:', hot.length)
console.log('  remainder:', remainder.length)
console.log('  root files:', readdirSync(ROOT).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'INDEX.md').length)
