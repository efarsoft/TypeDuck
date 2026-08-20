import { Readability } from '@mozilla/readability'

/** 从任意网页 HTML 提取正文（标题 + 纯文本，段落以双换行分隔） */
export interface ExtractedArticle {
  title: string
  text: string
}

/** 公众号文章特殊处理：正文在 #js_content，段落是 <p>/<section>，图片在 data-src */
function extractWechat(doc: Document): ExtractedArticle | null {
  const content = doc.querySelector('#js_content')
  const title = doc.querySelector('#activity-name')?.textContent?.trim() || ''
  if (!content) return null
  const blocks: string[] = []
  content.querySelectorAll('p, section, li, blockquote, h1, h2, h3, h4').forEach((el) => {
    // 只取叶子块，跳过纯容器
    if (el.children.length > 0 && el.tagName !== 'BLOCKQUOTE') return
    const t = el.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (t.length > 1) blocks.push(t)
  })
  return { title, text: blocks.join('\n\n') }
}

export function extractArticle(html: string, url: string): ExtractedArticle {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // 公众号正文结构特殊，先走专用路径
  if (url.includes('mp.weixin.qq.com')) {
    const wx = extractWechat(doc)
    if (wx && wx.text.length > 100) return wx
  }
  const parsed = new Readability(doc).parse()
  const text = (parsed?.textContent || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
  return { title: parsed?.title || doc.title || '', text }
}
