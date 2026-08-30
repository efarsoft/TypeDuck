/**
 * 微信兼容 HTML 工具集
 *
 * 公众号编辑器（ueditor/ProseMirror）会清洗 <style> 块、外部 CSS、大部分 class
 * 以及 script/iframe 等标签——所以符合公众号渲染的 HTML 必须满足：
 *   1. 样式全部内联（style=""）
 *   2. 只用微信认识的安全标签（h1~h6 / p / blockquote / pre / img / table / ul / ol / li / a …）
 *   3. 图片为微信 CDN 地址或本地引用
 * 本模块提供：内容模式检测、粘贴垃圾样式清理、兼容性巡检、公众号阅读样式。
 */

/** 内容以 < 标签开头视为 HTML（镜像参考项目的 isMarkdown 反向判断） */
export function isHtmlContent(content: string): boolean {
  return /^\s*<[a-z!\/]/i.test(content)
}

/** 兼容性问题的严重程度：warn = 微信会直接清洗；info = 可能降级或丢失 */
export type CompatibilityIssue = { level: 'warn' | 'info'; text: string }

/** 微信会清洗/不支持的标签（出现即警告） */
const BAD_TAGS = new Set([
  'script', 'iframe', 'form', 'input', 'select', 'textarea', 'button', 'video',
  'audio', 'embed', 'object', 'canvas', 'svg', 'math', 'style', 'link', 'meta',
  'base', 'frame', 'frameset', 'applet', 'map', 'template',
])

/** 外链图片判定：http(s) 且非微信 CDN / 本地占位 */
function isExternalImage(src: string): boolean {
  return /^https?:\/\//i.test(src) && !/mmbiz\.qpic\.cn|mmbiz\.qq\.com/i.test(src)
}

/**
 * 扫描 HTML 中的微信兼容性问题：
 * - warn：script/iframe/form/style 等会被微信直接清洗的标签
 * - warn：on* 事件属性、href="javascript:" 会被剥除
 * - warn：class 依赖样式（微信会丢 class，需内联）
 * - info：外链图片会被微信拦截（要求上传素材库）
 */
export function checkWechatCompatibility(html: string): CompatibilityIssue[] {
  if (!html.trim()) return []
  const issues: CompatibilityIssue[] = []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.body

  const bad = new Set<string>()
  root.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (BAD_TAGS.has(tag)) bad.add(tag)
  })
  if (bad.size) {
    issues.push({
      level: 'warn',
      text: `包含微信会清洗的标签：${[...bad].slice(0, 6).join(' / ')}${bad.size > 6 ? ' 等' : ''}`,
    })
  }

  // 事件属性 / javascript: 协议
  root.querySelectorAll('*').forEach((el) => {
    const attrs = [...el.attributes]
    const evt = attrs.find((a) => /^on/i.test(a.name))
    if (evt) {
      issues.push({ level: 'warn', text: `事件属性 ${evt.name} 会被微信剥除（请改用样式实现交互）` })
    }
    const href = el.getAttribute('href')
    if (href && /^javascript:/i.test(href.trim())) {
      issues.push({ level: 'warn', text: '发现 javascript: 链接，微信会阻止跳转' })
    }
  })

  // class 依赖（样式未内联）
  const classed = root.querySelectorAll('[class]')
  if (classed.length) {
    issues.push({
      level: 'warn',
      text: `有 ${classed.length} 个元素依赖 class 样式——微信会丢失 class，样式请内联到 style=""`,
    })
  }

  // 外链图片
  const extImgs = new Set<string>()
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    if (isExternalImage(src)) extImgs.add(src)
  })
  if (extImgs.size) {
    issues.push({
      level: 'info',
      text: `${extImgs.size} 张外链图片会被微信拦截，发布前请上传到素材库`,
    })
  }

  return issues
}

/**
 * 清理粘贴带来的垃圾样式（Word / 网页复制）：
 * 展开 font/o:p，删除 meta/style/script/link，清理 mso/Apple class，
 * 移除垃圾属性与空行内元素，保留 pre/code/img/table 的关键样式。
 */
export function cleanPasteStyles(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html

  // 保留 style 的标签（其余标签的 style 一律移除——微信兼容要求样式规范内联）
  const keepStyleTags = new Set(['pre', 'code', 'img', 'video', 'svg', 'table', 'th', 'td'])

  /** 展开元素：子节点上移到父节点位置并移除自身 */
  function unwrap(el: Element) {
    const parent = el.parentNode
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
  }

  // 第一遍：移除垃圾标签与垃圾属性
  const snapshot = [...div.querySelectorAll('*')]
  for (const el of snapshot) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'font' || tag === 'o:p') {
      unwrap(el)
      continue
    }
    if (['meta', 'xml', 'link', 'style', 'script'].includes(tag)) {
      el.parentNode?.removeChild(el)
      continue
    }

    // 清理 class：只保留非 Word/Apple 垃圾类
    if (el.hasAttribute('class')) {
      const classes = (el.getAttribute('class') || '')
        .split(/\s+/)
        .filter((c) => c && !/^mso/i.test(c) && !/^Apple-/i.test(c) && c !== 'Normal')
      if (classes.length) el.setAttribute('class', classes.join(' '))
      else el.removeAttribute('class')
    }

    // 行内 style：仅 keepStyleTags 保留
    if (!keepStyleTags.has(tag) && el.hasAttribute('style')) el.removeAttribute('style')

    // 常见垃圾属性
    for (const attr of ['lang', 'face', 'size', 'color', 'align', 'clear', 'xmlns', 'xml:lang']) {
      el.removeAttribute(attr)
    }
    for (const attr of [...el.attributes]) {
      if (/^data-mso/i.test(attr.name) || /^xmlns:/i.test(attr.name)) el.removeAttribute(attr.name)
    }
  }

  // 第二遍：删除空的行内元素（无内容且无 img/br 等）
  const inlineSnapshot = [...div.querySelectorAll('span, b, i, u, em, strong')]
  for (const el of inlineSnapshot) {
    const text = (el.textContent || '').replace(/ /g, ' ').trim()
    if (!text && !el.querySelector('img, br, input, video')) unwrap(el)
  }

  return div.innerHTML
}

/**
 * 格式化 HTML：DOMParser 解析后按标签层级缩进重排。
 * 行内标签（span/a/b 等）不换行；pre 内容原样保留（防空白被破坏）。
 */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'del', 'em', 'i', 'img', 'kbd',
  'label', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u',
])

export function formatHtml(input: string): string {
  if (!input.trim()) return ''
  // pre 内容先取出，避免解析/缩进破坏空白
  const vault: string[] = []
  const guarded = input.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (m) => {
    vault.push(m)
    return `<div data-pre-format="${vault.length - 1}"></div>`
  })
  const doc = new DOMParser().parseFromString(guarded, 'text/html')

  const lines: string[] = []
  let pending = '' // 当前行的行内缓冲

  const flush = () => {
    if (pending.trim()) {
      lines.push(pending.trim())
      pending = ''
    }
  }
  const attrStr = (el: Element) =>
    [...el.attributes].map((a) => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('')

  /** 行内元素序列化为单行（内部不再换行） */
  function serializeInline(el: Element): string {
    const tag = el.tagName.toLowerCase()
    const attrs = attrStr(el)
    if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`
    const inner = [...el.childNodes]
      .map((c) =>
        c.nodeType === Node.TEXT_NODE
          ? (c.textContent || '').trim()
          : c.nodeType === Node.ELEMENT_NODE
            ? serializeInline(c as Element)
            : '',
      )
      .filter(Boolean)
      .join(' ')
    return `<${tag}${attrs}>${inner}</${tag}>`
  }

  function visit(node: Node, depth: number) {
    const indent = '  '.repeat(depth)
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || '').trim()
        if (t) pending += (pending && !pending.endsWith(' ') ? ' ' : '') + t
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'body') {
        visit(el, depth)
        continue
      }
      // pre 占位：原样还原
      const preIdx = el.getAttribute('data-pre-format')
      if (preIdx != null) {
        flush()
        lines.push(indent + vault[+preIdx])
        continue
      }
      const attrs = attrStr(el)
      if (VOID_TAGS.has(tag)) {
        if (INLINE_TAGS.has(tag)) pending += `<${tag}${attrs}>`
        else {
          flush()
          lines.push(indent + `<${tag}${attrs}>`)
        }
        continue
      }
      const hasBlockChild = [...el.childNodes].some(
        (c) =>
          c.nodeType === Node.ELEMENT_NODE &&
          !INLINE_TAGS.has((c as Element).tagName.toLowerCase()) &&
          (c as Element).getAttribute('data-pre-format') == null,
      )
      if (INLINE_TAGS.has(tag) && !hasBlockChild) {
        const inner = [...el.childNodes]
          .map((c) =>
            c.nodeType === Node.TEXT_NODE
              ? (c.textContent || '').trim()
              : c.nodeType === Node.ELEMENT_NODE
                ? serializeInline(c as Element)
                : '',
          )
          .filter(Boolean)
          .join(' ')
        pending += `<${tag}${attrs}>${inner}</${tag}>`
        continue
      }
      // 块级元素：独立成行，子级缩进
      flush()
      lines.push(indent + `<${tag}${attrs}>`)
      visit(el, depth + 1)
      flush() // 行内文本缓冲先落行，再闭合
      lines.push(indent + `</${tag}>`)
    }
  }

  // 完整页面可能带 head（样式/标题），一并保留
  if (doc.head && doc.head.childNodes.length) visit(doc.head, 0)
  visit(doc.body, 0)
  flush()
  return lines.join('\n')
}

/** 微信会直接清洗的标签（删除整个元素） */
const STRIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'base', 'iframe', 'form', 'input',
  'select', 'textarea', 'button', 'video', 'audio', 'embed', 'object',
  'canvas', 'svg', 'math', 'map', 'template', 'frame', 'frameset', 'applet',
])

/** 标签映射：微信不认识的块级标签转成 section（div 保留为 section 更保险） */
const TAG_MAP: Record<string, string> = { div: 'section', font: 'span' }

/**
 * 转换为「公众号可渲染」的 HTML（微信渲染安全化）：
 * - 白名单：div/font → section/span；script/iframe/form/style 等直接删除
 * - 剥除 on* 事件属性与 javascript: 链接
 * - pre 代码块逐行包 <span style="display:block">（微信会折叠 pre 内换行）
 * - img 兜底 max-width:100%（已有 style 则合并），收集外链图片供转传
 * 返回转换后的 HTML 与需转传素材库的外链图片列表。
 */
export function toWechatHtml(input: string): { html: string; externalImages: string[] } {
  if (!input.trim()) return { html: '', externalImages: [] }
  const doc = new DOMParser().parseFromString(input, 'text/html')
  const externalImages: string[] = []

  function ensureImgStyle(img: Element) {
    let style = img.getAttribute('style') || ''
    if (!/max-width\s*:\s*100%/.test(style)) {
      style = (style ? style.replace(/;?\s*$/, '; ') : '') + 'max-width:100%'
      img.setAttribute('style', style)
    }
  }

  // 第一遍：删除危险标签、映射标签、剥危险属性
  const snapshot = [...doc.body.querySelectorAll('*')]
  for (const el of snapshot) {
    const tag = el.tagName.toLowerCase()
    if (STRIP_TAGS.has(tag)) {
      el.parentNode?.removeChild(el)
      continue
    }
    const mapped = TAG_MAP[tag]
    if (mapped) {
      const repl = doc.createElement(mapped)
      while (el.firstChild) repl.appendChild(el.firstChild)
      for (const attr of [...el.attributes]) repl.setAttribute(attr.name, attr.value)
      el.parentNode?.replaceChild(repl, el)
    }
    // 危险属性
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
      else if (attr.name === 'href' && /^javascript:/i.test((attr.value || '').trim())) el.removeAttribute('href')
    }
    if (el.tagName.toLowerCase() === 'img') {
      ensureImgStyle(el)
      const src = el.getAttribute('src') || ''
      if (/^https?:\/\//i.test(src) && !/mmbiz\.qpic\.cn|mmbiz\.qq\.com/i.test(src) && !externalImages.includes(src)) {
        externalImages.push(src)
      }
    }
  }

  // 第二遍：pre 代码逐行包 display:block span（微信折叠 pre 换行）
  const pres = [...doc.body.querySelectorAll('pre')]
  for (const pre of pres) {
    const text = (pre.textContent || '').replace(/\n$/, '')
    pre.textContent = ''
    for (const line of text.split('\n')) {
      const span = doc.createElement('span')
      span.setAttribute('style', 'display:block')
      span.textContent = line || ' '
      pre.appendChild(span)
    }
  }

  return { html: doc.body.innerHTML, externalImages }
}

/**
 * 公众号阅读样式：模拟微信正文的阅读效果（作用域限定 .td-rich，
 * 由预览容器套用；宽度由容器控制，无需 body 规则）。
 */
export const WECHAT_ARTICLE_CSS = `
.td-rich{--td-text:#353535;--td-title:#252525;--td-link:#576b95;--td-border:#d0d0d0;--td-code-bg:#f6f6f6;--td-code-text:#333;--td-quote-border:#d0d0d0;--td-quote-text:#888;--td-th-bg:#f6f6f6;--td-hr:#e0e0e0;color:var(--td-text);font-size:16px;line-height:1.75;word-wrap:break-word;overflow-wrap:break-word}
.td-rich p{margin:1em 0}
.td-rich h1{font-size:22px;font-weight:bold;color:var(--td-title)}.td-rich h2{font-size:20px;font-weight:bold;color:var(--td-title)}.td-rich h3{font-size:18px;font-weight:bold;color:var(--td-title)}.td-rich h4,.td-rich h5,.td-rich h6{color:var(--td-title)}
.td-rich blockquote{border-left:3px solid var(--td-quote-border);padding-left:12px;margin:1em 0;color:var(--td-quote-text)}
.td-rich a{color:var(--td-link);text-decoration:none}
.td-rich pre,.td-rich code{padding:0;background:var(--td-code-bg);border-radius:3px;font-family:Consolas,Monaco,monospace;font-size:14px;color:var(--td-code-text)}
.td-rich pre{padding:12px;overflow-x:auto;margin:1em 0;line-height:1.6}
.td-rich pre code span{display:block}
.td-rich table{border-collapse:collapse;width:100%;margin:1em 0;font-size:15px}
.td-rich td,.td-rich th{border:1px solid var(--td-border);padding:8px 12px;text-align:left}
.td-rich th{background:var(--td-th-bg);font-weight:bold}
.td-rich hr{border:none;border-top:1px solid var(--td-hr);margin:1.5em 0}
.td-rich ul,.td-rich ol{padding-left:2em;margin:.5em 0}
.td-rich li{margin:.3em 0}
.td-rich img{max-width:100%;height:auto;display:block;margin:1em auto}
.td-rich figure{margin:1em 0;text-align:center}.td-rich figcaption{font-size:13px;color:#999;margin-top:8px}
.td-rich section{margin:0;padding:0}
`.trim()
