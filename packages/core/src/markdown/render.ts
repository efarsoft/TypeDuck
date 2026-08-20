import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import taskLists from 'markdown-it-task-lists'
import type { Theme } from '../theme/types'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch {
        /* 忽略高亮错误，回退为转义文本 */
      }
    }
    return ''
  },
}).use(taskLists, { enabled: false, label: true })

/** 每条 CSS 声明追加 !important：微信公众号编辑器会重置未加权的行内样式 */
export function withImportant(css: string): string {
  return (
    css
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => (d.includes('!important') ? d : `${d} !important`))
      .join(';') + ';'
  )
}

/**
 * 将主题样式表与 hljs class 映射为内联 style。
 * - important=true 时全声明加 !important（防微信覆盖），并剥离 class/id（公众号不支持 class）。
 * - keepClass=true 时保留 class/id（用于网页预览 / HTML / PDF 导出路径，配合 customCss 的 <style> 生效）。
 * Word 等解析器不识别 !important，导 docx 时须 important=false 且 keepClass=false。
 */
function injectInlineStyles(
  html: string,
  theme: Theme,
  important = true,
  keepClass = false,
): string {
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    const boost = (s: string) => (important ? withImportant(s) : s)
    let style = ''

    // 代码块外层包装
    if (tag === 'pre') {
      style = theme.styles.codeBlockWrapper
      const codeEl = el.querySelector('code')
      if (codeEl) codeEl.setAttribute('style', boost(theme.styles.codeBlock))
    } else if (tag === 'code') {
      const inPre = el.parentElement?.tagName.toLowerCase() === 'pre'
      style = inPre ? theme.styles.codeBlock : theme.styles.code
    } else if (theme.styles[tag] !== undefined) {
      style = theme.styles[tag]
    }

    // 任务列表项：去掉列表圆点，避免「圆点 + 勾选框」并存
    if (tag === 'li' && el.querySelector('input[type="checkbox"]')) {
      style += 'list-style:none;'
    }

    const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)
    for (const cls of classes) {
      if (theme.hljsStyleMap[cls]) style += theme.hljsStyleMap[cls]
    }

    if (style) el.setAttribute('style', boost(style))
    if (!keepClass) {
      el.removeAttribute('class')
      el.removeAttribute('id')
    }
  })

  return container.innerHTML
}

/**
 * 将一段 CSS 的所有顶层选择器加上作用域前缀（默认 `.td-rich`），避免注入到预览/导出文档时污染页面其它部分。
 * 仅处理「扁平规则」（选择器 { 声明 }），不支持嵌套 @media / @keyframes 内部再嵌套规则；
 * 主题 customCss 请保持单层结构（如需动画请用普通 keyframes 在 @规则内直接写，或自行按 .td-rich 前缀书写）。
 */
export function scopeCss(css: string, scope = '.td-rich'): string {
  if (!css) return ''
  return css
    .split('}')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const idx = block.indexOf('{')
      if (idx === -1) return block
      const sel = block.slice(0, idx).trim()
      const body = block.slice(idx + 1).trim()
      // at-rule（@keyframes/@font-face/@media 等）原样透传，不强行加前缀
      if (!sel || sel.startsWith('@')) return `${sel} { ${body} }`
      const scoped = sel
        .split(',')
        .map((s) => `${scope} ${s.trim()}`)
        .join(', ')
      return `${scoped} { ${body} }`
    })
    .join('\n')
}

/** 渲染 Markdown 为 HTML。
 * - 默认（公众号复制路径）：内联样式 + !important + 剥离 class，安全可粘贴。
 * - opts.rich=true（网页预览 / HTML / PDF 导出）：保留 class、不加 !important，
 *   以便主题 customCss 的 <style> 能通过 class/pseudo-element 覆盖，呈现 drop-cap、阴影、渐变等进阶效果。
 */
export function render(
  markdown: string,
  theme: Theme,
  opts: { important?: boolean; rich?: boolean } = {},
): string {
  const raw = md.render(markdown)
  if (opts.rich) {
    // rich 模式：保留 class，且内联样式不加 !important，让 customCss 可覆盖
    return injectInlineStyles(raw, theme, false, true)
  }
  return injectInlineStyles(raw, theme, opts.important !== false, false)
}
