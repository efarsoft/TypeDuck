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

/** 将主题样式表与 hljs class 映射为内联 style，并移除所有 class（公众号不支持 class） */
function injectInlineStyles(html: string, theme: Theme): string {
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    let style = ''

    // 代码块外层包装
    if (tag === 'pre') {
      style = theme.styles.codeBlockWrapper
      const codeEl = el.querySelector('code')
      if (codeEl) codeEl.setAttribute('style', theme.styles.codeBlock)
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

    if (style) el.setAttribute('style', style)
    el.removeAttribute('class')
    el.removeAttribute('id')
  })

  return container.innerHTML
}

/** 渲染 Markdown 为带内联样式的 HTML（预览与复制共用同一份输出） */
export function render(markdown: string, theme: Theme): string {
  const raw = md.render(markdown)
  return injectInlineStyles(raw, theme)
}
