/** 导出为独立 HTML 文件：内联所有样式，可直接在浏览器中打开 */
export function exportHtmlFile(
  title: string,
  bodyHtml: string,
  background: string,
  rootStyle = '',
): void {
  const doc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:${background};">
<section style="max-width:677px;margin:0 auto;padding:24px;background:${background === '#242424' ? '#242424' : '#ffffff'};${rootStyle}">
${bodyHtml}
</section>
</body>
</html>`
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(title) + '.html'
  a.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
