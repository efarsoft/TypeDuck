import { Readability } from '@mozilla/readability'

/** 从任意网页 HTML 提取正文（标题 + 纯文本，段落以双换行分隔） */
export interface ExtractedArticle {
  title: string
  text: string
}

/** 常见站点正文容器的专用选择器（Readability 认不出这些布局时的补充路径） */
const SITE_RULES: { match: RegExp; title: string[]; body: string[] }[] = [
  {
    match: /zhuanlan\.zhihu\.com\/p\//,
    title: ['.Post-Title', 'h1'],
    body: ['.Post-RichTextContainer .RichText', '.Post-RichTextContainer', 'article'],
  },
  {
    match: /zhihu\.com\/(question|answer)\//,
    title: ['.QuestionHeader-title', 'h1'],
    body: ['.QuestionRichText', '.RichContent-inner .RichText', '.RichContent-inner'],
  },
  {
    match: /juejin\.cn\/post\//,
    title: ['h1'],
    body: ['.markdown-body', 'article'],
  },
  {
    match: /36kr\.com\/p\//,
    title: ['.article-title', 'h1'],
    body: ['.article-detail', 'article'],
  },
  {
    match: /sspai\.com\/(a|post)\//,
    title: ['h1'],
    body: ['.article-body', 'article'],
  },
]

/** 容器内的叶子块拼正文（跳过纯容器节点，保段落/标题/列表/引用/代码） */
function blocksToText(root: Element): string {
  const blocks: string[] = []
  root.querySelectorAll('p, section, li, blockquote, h1, h2, h3, h4, pre').forEach((el) => {
    if (el.children.length > 0 && el.tagName !== 'BLOCKQUOTE' && el.tagName !== 'PRE') return
    const t = el.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (t.length > 1) blocks.push(t)
  })
  return blocks.join('\n\n')
}

/** 公众号文章特殊处理：正文在 #js_content，标题在 #activity-name */
function extractWechat(doc: Document, fallbackTitle: string): ExtractedArticle | null {
  const content = doc.querySelector('#js_content')
  if (!content) return null
  const title = doc.querySelector('#activity-name')?.textContent?.trim() || fallbackTitle
  const text = blocksToText(content)
  return text.length > 100 ? { title, text } : null
}

function extractByRule(doc: Document, url: string, fallbackTitle: string): ExtractedArticle | null {
  const rule = SITE_RULES.find((r) => r.match.test(url))
  if (!rule) return null
  const title =
    rule.title.map((s) => doc.querySelector(s)?.textContent?.trim()).find((t) => !!t) || fallbackTitle
  for (const sel of rule.body) {
    const el = doc.querySelector(sel)
    if (!el) continue
    const text = blocksToText(el)
    if (text.length > 120) return { title, text }
  }
  return null
}

export function extractArticle(html: string, url: string): ExtractedArticle {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || ''
  const fallbackTitle = ogTitle || doc.title || ''

  if (url.includes('mp.weixin.qq.com')) {
    const wx = extractWechat(doc, fallbackTitle)
    if (wx) return wx
  }

  const byRule = extractByRule(doc, url, fallbackTitle)
  if (byRule) return byRule

  const parsed = new Readability(doc).parse()
  const text = (parsed?.textContent || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
  return { title: parsed?.title || fallbackTitle, text }
}
