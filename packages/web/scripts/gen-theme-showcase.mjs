/**
 * 主题橱窗生成器：从 core 主题注册表抓真实样式，生成静态首页的主题展示区 HTML。
 * 用法：cd packages/web && node scripts/gen-theme-showcase.mjs
 * 新增/修改主题后重跑一次，index.html 里标记区之间的内容会被替换。
 */
import { build } from 'esbuild'
import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const webDir = dirname(fileURLToPath(import.meta.url)) + '/..'
const tmpDir = resolve(webDir, '.tmp-gen')

// 1) 把 core 的 registry 打包成 CJS（纯数据，无副作用依赖）
mkdirSync(tmpDir, { recursive: true })
await build({
  entryPoints: [resolve(webDir, '../core/src/theme/registry.ts')],
  bundle: true,
  format: 'cjs',
  outfile: resolve(tmpDir, 'themes.cjs'),
})
const { themes } = require(resolve(tmpDir, 'themes.cjs'))

// 2) 每个场景分组取前 4 套
const groups = [
  { category: 'daily', label: '📝 日常写作' },
  { category: 'expressive', label: '🎨 个性撞色' },
  { category: 'narrative', label: '🖋 文艺叙事' },
  { category: 'dark', label: '🌙 深色沉浸' },
]

/** 从内联样式串里提取属性值 */
const pick = (style, prop) => style?.match(new RegExp(`${prop}:\\s*([^;]+)`))?.[1]?.trim() ?? ''

const isDark = (bg) => {
  const m = bg.match(/#([0-9a-fA-F]{3,6})/)
  if (!m) return false
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

function cardHtml(t) {
  const h2 = t.styles.h2 || ''
  const bq = t.styles.blockquote || ''
  const textColor = pick(t.styles.root, 'color') || '#333'

  // 标题形态：还原主题 h2 的关键视觉（色块反白 / 左竖条 / 下划线 / 纯色）
  let titleStyle = `color:${pick(h2, 'color') || textColor};`
  const h2bg = pick(h2, 'background')
  if (h2bg && h2bg !== 'transparent') {
    titleStyle += `background:${h2bg};padding:3px 10px;border-radius:4px;align-self:flex-start;`
  } else {
    const bl = pick(h2, 'border-left')
    if (bl) titleStyle += `border-left:${bl};padding-left:10px;`
    else if (pick(h2, 'border-bottom')) titleStyle += `border-bottom:${pick(h2, 'border-bottom')};padding-bottom:4px;`
  }

  // 引用条：还原边色 + 底色
  const qb = pick(bq, 'border-left')
  const qbg = pick(bq, 'background')
  const quoteStyle = [
    qb ? `border-left:${qb};` : '',
    qbg && qbg !== 'transparent' ? `background:${qbg};` : '',
  ].join('')

  const dark = isDark(t.previewBackground)
  const tagColor = dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.35)'

  return `      <a class="tcard" href="editor.html" style="background:${t.previewBackground}">
        <span class="tc-tag" style="color:${tagColor}">${t.name}</span>
        <span class="tc-h2" style="${titleStyle}">${t.name}</span>
        <span class="tc-line" style="background:${textColor};opacity:.22"></span>
        <span class="tc-line" style="background:${textColor};opacity:.15"></span>
        <span class="tc-line tc-short" style="background:${textColor};opacity:.10"></span>
        <span class="tc-quote" style="${quoteStyle}"></span>
      </a>`
}

const html = groups
  .map((g) => {
    const list = themes.filter((t) => t.category === g.category).slice(0, 4)
    return `    <div class="tgroup">
      <span class="tgroup-label">${g.label} · ${list.map((t) => t.name).join(' / ')}</span>
      <div class="tgrid">
${list.map(cardHtml).join('\n')}
      </div>
    </div>`
  })
  .join('\n')

// 3) 注入 index.html 标记区
const indexFile = resolve(webDir, 'index.html')
const START = '<!-- THEME-SHOWCASE:START -->'
const END = '<!-- THEME-SHOWCASE:END -->'
let source = readFileSync(indexFile, 'utf-8')
if (!source.includes(START) || !source.includes(END)) {
  console.error('index.html 里找不到 THEME-SHOWCASE 标记')
  process.exit(1)
}
source = source.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  `${START}\n${html}\n    ${END}`,
)
writeFileSync(indexFile, source)
rmSync(tmpDir, { recursive: true, force: true })
console.log(`已生成 ${groups.length} 组主题橱窗并注入 index.html`)
