import type { Theme } from '../../types'
import { hljsMonokai } from '../../hljs-maps'

/** 全息镭射 */
export const theme: Theme = {
  id: 'holographic',
  name: '全息镭射',
  description: '暗底渐变流光字 + 霓虹光晕',
  category: 'expressive',
  previewBackground: '#0e0e1a',
  hljsStyleMap: hljsMonokai,
  styles: {
    root: 'color:#e8e8f5;font-size:15px;line-height:1.8;letter-spacing:0.3px;word-break:break-word;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    h1: 'margin:1.7em 0 0.8em;font-size:1.6em;font-weight:800;color:#ffffff;text-align:center;',
    h2: 'margin:1.6em 0 0.7em;font-size:1.32em;font-weight:700;color:#ffffff;border-left:4px solid #00e5ff;padding-left:10px;',
    h3: 'margin:1.4em 0 0.6em;font-size:1.15em;font-weight:600;color:#00e5ff;',
    h4: 'margin:1.3em 0 0.5em;font-size:1.05em;font-weight:600;color:#c5c5e0;',
    h5: 'margin:1.2em 0 0.4em;font-size:1em;font-weight:600;color:#9aa0b5;',
    h6: 'margin:1.1em 0 0.4em;font-size:0.92em;font-weight:600;color:#8a8aa0;',
    p: 'margin:1em 0;',
    a: 'color:#00e5ff;text-decoration:none;border-bottom:1px solid #00e5ff;',
    strong: 'font-weight:700;color:#ff8fd0;',
    em: 'font-style:italic;color:#b48cff;',
    del: 'text-decoration:line-through;color:#6b6f80;',
    ul: 'margin:1em 0;padding-left:1.6em;',
    ol: 'margin:1em 0;padding-left:1.6em;',
    li: 'margin:0.4em 0;',
    blockquote: 'margin:1.4em 0;padding:0.8em 1.1em;border-left:4px solid #ff2e97;background:#1a1a2e;color:#c5c5e0;',
    code: 'background:#1a1a2e;color:#7ee7ff;padding:2px 6px;border:1px solid #2a2a3a;border-radius:4px;font-size:0.88em;font-family:"SFMono-Regular",Consolas,Menlo,monospace;',
    codeBlock: 'font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;line-height:1.7;color:#e8e8f5;',
    codeBlockWrapper: 'background:#12121f;padding:16px;border:1px solid #2a2a3a;border-radius:8px;overflow-x:auto;margin:1.4em 0;',
    table: 'border-collapse:collapse;margin:1.4em 0;width:100%;font-size:0.95em;',
    thead: '',
    th: 'border:1px solid #2a2a3a;background:#1a1a2e;padding:9px 13px;font-weight:600;color:#00e5ff;',
    td: 'border:1px solid #2a2a3a;padding:9px 13px;',
    tr: '',
    img: 'max-width:100%;border:1px solid #2a2a3a;border-radius:8px;display:block;margin:1.4em auto;',
    hr: 'border:none;border-top:1px solid #2a2a3a;margin:2.2em 0;',
  },
  customCss: `
.td-rich h1,
.td-rich h2 {
  background: linear-gradient(90deg, #00e5ff, #ff2e97, #ffd23f, #00e5ff);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}
.td-rich h2 { border-left-color: transparent !important; }
.td-rich a {
  background: linear-gradient(90deg, #00e5ff, #ff2e97);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}
.td-rich img {
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.35), 0 0 24px rgba(255, 46, 151, 0.25) !important;
}
.td-rich blockquote {
  box-shadow: 0 0 18px rgba(255, 46, 151, 0.25) !important;
}
`,
}
