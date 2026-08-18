/**
 * 复制富文本 HTML 到剪贴板（微信公众号编辑器需要 text/html 格式）。
 * 兼容不支持 ClipboardItem 的环境，降级为临时可编辑节点 + execCommand。
 */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = new Blob([html], { type: 'text/html' })
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })])
      return true
    }
  } catch {
    /* 降级处理 */
  }

  try {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.innerHTML = html
    div.style.position = 'fixed'
    div.style.left = '-9999px'
    document.body.appendChild(div)
    const range = document.createRange()
    range.selectNodeContents(div)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.execCommand('copy')
    selection?.removeAllRanges()
    document.body.removeChild(div)
    return true
  } catch {
    return false
  }
}
