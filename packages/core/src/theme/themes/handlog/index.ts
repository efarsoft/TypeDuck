import type { Theme } from '../../types'
import { hljsLight } from '../../hljs-maps'

/** 手账拼贴风 */
export const theme: Theme = {
  id: 'handlog',
  name: '手账拼贴',
  description: '暖纸胶带拼贴：贴纸卡片 + 和纸胶带图',
  category: 'expressive',
  previewBackground: '#fbf6ec',
  hljsStyleMap: hljsLight,
  styles: {
    root: 'color:#4a4036;font-size:15px;line-height:1.85;letter-spacing:0.2px;word-break:break-word;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
    h1: 'margin:1.6em 0 0.7em;font-size:1.6em;font-weight:800;color:#3a2e25;text-align:center;',
    h2: 'margin:1.5em 0 0.7em;font-size:1.3em;font-weight:700;color:#b5651d;border-left:4px solid #d9a441;padding-left:10px;',
    h3: 'margin:1.4em 0 0.6em;font-size:1.14em;font-weight:700;color:#a0522d;',
    h4: 'margin:1.3em 0 0.5em;font-size:1.05em;font-weight:700;color:#8a5a2b;',
    h5: 'margin:1.2em 0 0.4em;font-size:1em;font-weight:700;color:#6b5b4a;',
    h6: 'margin:1.1em 0 0.4em;font-size:0.92em;font-weight:700;color:#7a6a58;',
    p: 'margin:1em 0;',
    a: 'color:#c0392b;text-decoration:none;border-bottom:2px dotted #e0b97d;',
    strong: 'font-weight:700;color:#c0392b;',
    em: 'font-style:italic;color:#a0522d;',
    del: 'text-decoration:line-through;color:#a99a88;',
    ul: 'margin:1em 0;padding-left:1.6em;',
    ol: 'margin:1em 0;padding-left:1.6em;',
    li: 'margin:0.5em 0;',
    blockquote: 'margin:1.4em 0;padding:0.9em 1.2em;border:2px dashed #e0b97d;border-radius:14px;background:#fff8ec;color:#6b5b4a;',
    code: 'background:#fff3e0;color:#c0392b;padding:2px 6px;border-radius:6px;font-size:0.88em;font-family:"SFMono-Regular",Consolas,Menlo,monospace;',
    codeBlock: 'font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;line-height:1.7;color:#4a4036;',
    codeBlockWrapper: 'background:#fffdf7;padding:16px;border:2px dashed #e0b97d;border-radius:14px;overflow-x:auto;margin:1.4em 0;',
    table: 'border-collapse:collapse;margin:1.4em 0;width:100%;font-size:0.95em;',
    thead: '',
    th: 'border:1px solid #e0b97d;background:#fff3e0;padding:9px 13px;font-weight:700;color:#8a5a2b;',
    td: 'border:1px solid #e0b97d;padding:9px 13px;',
    tr: '',
    img: 'max-width:100%;border-radius:14px;display:block;margin:1.4em auto;',
    hr: 'border:none;border-top:2px dotted #e0b97d;margin:2.2em 0;',
  },
  customCss: `
.td-rich p:has(> img) {
  position: relative;
  text-align: center;
}
.td-rich p:has(> img)::before {
  content: "";
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  width: 96px;
  height: 26px;
  background: repeating-linear-gradient(45deg, #ffd6a5, #ffd6a5 6px, #ffe8c9 6px, #ffe8c9 12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  z-index: 2;
}
.td-rich img {
  border: 8px solid #fffdf7 !important;
  border-radius: 6px !important;
  box-shadow: 0 8px 20px rgba(120, 80, 30, 0.18) !important;
  transform: rotate(-1.2deg);
}
.td-rich h2 {
  background: linear-gradient(transparent 62%, #ffe0a3 62%);
  display: inline-block;
  padding: 0 6px;
}
`,
}
