import type { Theme } from '../../types'
import { hljsLight } from '../../hljs-maps'

/** 孟菲斯波普 */
export const theme: Theme = {
  id: 'memphis',
  name: '孟菲斯波普',
  description: '撞色几何：硬阴影 + 波点虚线',
  category: 'expressive',
  previewBackground: '#fdf6e3',
  hljsStyleMap: hljsLight,
  styles: {
    root: 'color:#1a1a1a;font-size:15px;line-height:1.8;letter-spacing:0.2px;word-break:break-word;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-weight:500;',
    h1: 'margin:1.6em 0 0.7em;font-size:1.7em;font-weight:900;color:#111;',
    h2: 'margin:1.5em 0 0.7em;font-size:1.3em;font-weight:800;color:#111;',
    h3: 'margin:1.4em 0 0.6em;font-size:1.14em;font-weight:800;color:#e91e63;',
    h4: 'margin:1.3em 0 0.5em;font-size:1.05em;font-weight:700;color:#1a1a1a;',
    h5: 'margin:1.2em 0 0.4em;font-size:1em;font-weight:700;color:#333;',
    h6: 'margin:1.1em 0 0.4em;font-size:0.92em;font-weight:700;color:#555;',
    p: 'margin:1em 0;',
    a: 'color:#e91e63;font-weight:700;text-decoration:none;border-bottom:2px solid #e91e63;',
    strong: 'font-weight:800;color:#e91e63;',
    em: 'font-style:italic;color:#5c2d91;',
    del: 'text-decoration:line-through;color:#999;',
    ul: 'margin:1em 0;padding-left:1.6em;',
    ol: 'margin:1em 0;padding-left:1.6em;',
    li: 'margin:0.5em 0;',
    blockquote: 'margin:1.4em 0;padding:0.9em 1.2em;border:3px dotted #5c2d91;border-radius:16px;background:#ffffff;color:#222;',
    code: 'background:#111;color:#ffe14d;padding:2px 6px;border-radius:4px;font-size:0.88em;font-family:"SFMono-Regular",Consolas,Menlo,monospace;',
    codeBlock: 'font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;line-height:1.7;color:#ffe14d;',
    codeBlockWrapper: 'background:#111;padding:16px;border-radius:10px;overflow-x:auto;margin:1.4em 0;',
    table: 'border-collapse:collapse;margin:1.4em 0;width:100%;font-size:0.95em;',
    thead: '',
    th: 'border:2px solid #111;background:#ffe14d;padding:9px 13px;font-weight:800;color:#111;',
    td: 'border:2px solid #111;padding:9px 13px;',
    tr: '',
    img: 'max-width:100%;border:4px solid #111;border-radius:10px;display:block;margin:1.4em auto;',
    hr: 'border:none;border-top:4px dotted #00b3b3;margin:2.2em 0;',
  },
  customCss: `
.td-rich h2 {
  border-bottom: 5px solid #111 !important;
  box-shadow: 6px 6px 0 #ffd23f !important;
  display: inline-block;
  padding: 0.1em 0.4em;
}
.td-rich h1 {
  text-shadow: 3px 3px 0 #00b3b3, 6px 6px 0 #ff5c8a;
}
.td-rich blockquote {
  box-shadow: 6px 6px 0 #00b3b3 !important;
}
.td-rich img {
  box-shadow: 8px 8px 0 #ffd23f !important;
  transform: rotate(1deg);
}
.td-rich a {
  background: #ffe14d;
  padding: 0 4px;
  border-radius: 3px;
}
`,
}
