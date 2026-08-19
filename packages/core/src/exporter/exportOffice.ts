/** 导出为 Word（.docx）：html-docx-js-typescript 浏览器端生成真 docx（Word/WPS 直接打开编辑） */
import { asBlob as htmlDocxAsBlob } from 'html-docx-js-typescript'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

export async function exportWordDoc(
  title: string,
  bodyHtml: string,
  background: string,
  rootStyle = '',
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="background:${background};">
<section style="max-width:677px;margin:0 auto;padding:24px;${rootStyle}">
${bodyHtml}
</section>
</body>
</html>`
  const blob = await htmlDocxAsBlob(html, {
    orientation: 'portrait',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // Word twips：2.54cm 默认页边距
    title,
  })
  const url = URL.createObjectURL(blob as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(title) + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}

/** 导出为 PDF：弹出打印窗口（含全部内联样式），由浏览器「另存为 PDF」 */
export function exportPrintPdf(
  title: string,
  bodyHtml: string,
  background: string,
  rootStyle = '',
): void {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm 14mm; }
  @media print { body { padding: 0 !important; background: #fff !important; } }
</style>
</head>
<body style="margin:0;padding:24px 12px;background:${background};">
<section style="max-width:677px;margin:0 auto;padding:24px;background:${
    background === '#242424' ? '#242424' : '#ffffff'
  };${rootStyle}">
${bodyHtml}
</section>
<script>window.onload = function () { window.focus(); window.print(); }</script>
</body>
</html>`)
  win.document.close()
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
}
